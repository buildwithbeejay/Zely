import { config } from "@/config/index";
import redis from "@/infrastructure/cache/redis.cli";
import { verifyAccessToken } from "@/infrastructure/helpers/token.helper";
import { SessionModel } from "@/modules/sessions/session.model";
import { NextFunction, Request, Response } from "express";
import User from "modules/auth/authmodel";
import { extractRequestContext } from "./request.context";
import { UserRole } from "@/modules/auth/authinterface";
import UnauthenticatedError from "@/shared/errors/unaunthenticated";
import Unauthorized, { ForbiddenErrorCode } from "@/shared/errors/unauthorized";
import { memoryRateLimitStore } from "@/infrastructure/cache/memory-rate-limit.store";

export interface AccessPayload {
  userId: string;
  email: string;
  role: string;
  deviceId: string;
  iat?: number;
  exp?: number;
  sub: string;
  jti: string;
  passwordVersion: number;
}

const ADMIN_ROLES: string[] = [UserRole.ADMIN];

type AuthCache =
  | { up: false }
  | {
      up: true;
      latestHash: string | null;
      storedPwdVer: string | null;
      confirmed: string | null;
      blacklisted: string | null;
    };

export const requireAuth = async (
  req: Request & { user?: any },
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthenticatedError("Unauthorized"));
  }

  const token = header.substring(7).replace(/^['"]|['"]$/g, "");

  let payload: AccessPayload;

  try {
    payload = await verifyAccessToken(token);
  } catch {
    return next(new UnauthenticatedError("Unauthorized"));
  }

  try {
    const expectedPasswordVersion = payload.passwordVersion ?? 0;

    // This key stores the latest ACCESS-token JTI, not a refresh hash.
    const latestKey = `${config.redis.sessionAccessJtiPrefix}${payload.sub}:${payload.deviceId}`;

    const pwdVerKey = `${config.redis.pwdverPrefix}${payload.sub}`;

    const confirmKey = `${config.redis.SESSION_CONFIRM_PREFIX}${payload.sub}:${payload.deviceId}:${payload.jti}`;

    const blacklistKey = payload.jti
      ? `${config.redis.blacklistPrefix}${payload.jti}`
      : null;

    const cache = await redis.execute<AuthCache>(
      async () => {
        const client = redis.getClient();

        const [latestHash, storedPwdVer, confirmed, blacklisted] =
          await Promise.all([
            client.get(latestKey),
            client.get(pwdVerKey),
            client.get(confirmKey),
            blacklistKey ? client.get(blacklistKey) : Promise.resolve(null),
          ]);

        return {
          up: true,
          latestHash,
          storedPwdVer,
          confirmed,
          blacklisted,
        };
      },
      async () => ({ up: false }),
      "auth:cache",
    );

    if (cache.up && cache.blacklisted === "1") {
      return next(new UnauthenticatedError("Session terminated"));
    }

    let sessionValidated = false;

    // Fast path: use Redis only when both cache entries exist
    // and Redis identifies this exact access token as current.
    if (
      cache.up &&
      cache.latestHash === payload.jti &&
      cache.storedPwdVer !== null
    ) {
      if (Number(cache.storedPwdVer) !== expectedPasswordVersion) {
        return next(
          new UnauthenticatedError("Password changed — please login again"),
        );
      }

      if (cache.confirmed) {
        sessionValidated = true;
      } else {
        // Confirm the session against MongoDB before trusting
        // this token's cache entry for the confirmation period.
        const stillActive = await SessionModel.exists({
          userId: payload.sub,
          deviceId: payload.deviceId,
          accessTokenJti: payload.jti,
          isActive: true,
          expiresAt: { $gt: new Date() },
          accessTokenExpiresAt: { $gt: new Date() },
        });

        if (!stillActive) {
          return next(
            new UnauthenticatedError("Session expired or logged out"),
          );
        }

        await redis.set(confirmKey, "1", 120);
        sessionValidated = true;
      }
    }

    // MongoDB fallback:
    // Also handles a missing or stale Redis JTI. A cache mismatch
    // alone is not enough to reject a token; MongoDB decides
    // whether this exact token still belongs to the active session.
    if (!sessionValidated) {
      const [session, user] = await Promise.all([
        SessionModel.findOne({
          userId: payload.sub,
          deviceId: payload.deviceId,
          accessTokenJti: payload.jti,
          isActive: true,
          expiresAt: { $gt: new Date() },
          accessTokenExpiresAt: { $gt: new Date() },
        }).lean(),

        User.findById(payload.sub).select("passwordVersion").lean(),
      ]);

      if (!session) {
        return next(new UnauthenticatedError("Session expired or logged out"));
      }

      if (!user) {
        return next(new UnauthenticatedError("Unauthorized"));
      }

      if ((user.passwordVersion ?? 0) !== expectedPasswordVersion) {
        return next(
          new UnauthenticatedError("Password changed — please login again"),
        );
      }

      // Repair the cache only if Redis is available.
      // The access-JTI key must not outlive the access token.
      if (cache.up) {
        const accessTtl = Math.max(
          Math.floor(
            (session.accessTokenExpiresAt.getTime() - Date.now()) / 1000,
          ),
          0,
        );

        const sessionTtl = Math.max(
          Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
          0,
        );

        if (accessTtl > 0 && sessionTtl > 0) {
          await redis.execute(
            async () => {
              const pipeline = redis.getClient().pipeline();

              pipeline.set(latestKey, session.accessTokenJti, "EX", accessTtl);

              pipeline.set(
                pwdVerKey,
                String(user.passwordVersion ?? 0),
                "EX",
                sessionTtl,
              );

              const results = await pipeline.exec();
              const failed = results?.find(([err]) => err);

              if (failed) throw failed[0];

              return true;
            },
            async () => false,
            "auth:rehydrate",
          );
        }
      }
    }

    // Update lastUsedAt at most once per five minutes per device.
    const throttleKey = `${config.redis.lastusedPrefix}${payload.sub}:${payload.deviceId}`;

    const shouldTouch = await redis.execute<boolean>(
      async () =>
        (await redis.getClient().set(throttleKey, "1", "EX", 300, "NX")) ===
        "OK",
      async () => memoryRateLimitStore.hit(throttleKey, 300_000).count === 1,
      "auth:lastused",
    );

    if (shouldTouch) {
      SessionModel.updateOne(
        {
          userId: payload.sub,
          deviceId: payload.deviceId,
          accessTokenJti: payload.jti,
          isActive: true,
        },
        {
          $set: { lastUsedAt: new Date() },
        },
      ).catch(() => {});
    }

    req.user = {
      sub: payload.sub,
      role: payload.role,
      deviceId: payload.deviceId,
      userId: payload.userId,
      email: payload.email,
      jti: payload.jti,
    };

    req.context = extractRequestContext(req);

    return next();
  } catch (err) {
    // Infrastructure errors should not be converted into
    // authentication failures that force the frontend to log out.
    return next(err);
  }
};

export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userSub = req.user?.sub;

  if (!userSub) {
    return res.status(401).json({
      ok: false,
      message: "UNAUTHORIZED",
    });
  }

  const user = await User.findById(userSub).select("role").lean();

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return next(
      new Unauthorized("Admin access required", ForbiddenErrorCode.ADMIN_ONLY),
    );
  }

  return next();
};

export const requireFreshSession = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;

    if (!user?.sub || !user?.deviceId || !user?.jti) {
      return next(new UnauthenticatedError("Unauthorized"));
    }

    const session = await SessionModel.findOne({
      userId: user.sub,
      deviceId: user.deviceId,
      accessTokenJti: user.jti,
      isActive: true,
      expiresAt: { $gt: new Date() },
      accessTokenExpiresAt: { $gt: new Date() },
    }).lean();

    if (!session) {
      return next(new UnauthenticatedError("Session expired or logged out"));
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
