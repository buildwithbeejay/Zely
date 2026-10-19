import { hashToken } from "@/config/hashToken";
import { config } from "@/config/index";
import { SessionModel } from "@/modules/sessions/session.model";
import BadRequestError from "@/shared/errors/badRequest";
import { logger } from "@/shared/utils/logger";
import { UAParser } from "ua-parser-js";
import { v4 as uuidv4 } from "uuid";
import redis from "../cache/redis.cli";

const viaRedis = <T>(ctx: string, fn: () => Promise<T>, fallback: T) =>
  redis.execute(fn, async () => fallback, ctx);

// ioredis pipelines can return per-command errors without throwing.
const assertPipeline = (results: [Error | null, unknown][] | null) => {
  const failed = results?.find(([err]) => err);
  if (failed) throw failed[0];
};

const purgeByPattern = (pattern: string) =>
  redis.execute(
    async () => {
      const client = redis.getClient();
      let cursor = "0";

      do {
        const [next, keys] = await client.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          500,
        );

        cursor = next;

        if (keys.length) {
          await client.del(...keys);
        }
      } while (cursor !== "0");

      return true;
    },
    async () => false,
    `purge:${pattern}`,
  );

// ─── Redis key helpers ──────────────────────────────────────────────

// Stores the HASH of the latest refresh token for a device.
// Do not use this key for access-token JTIs.
const getRefreshLatestKey = (sub: string, deviceId: string) =>
  `${config.redis.sessionLatestPrefix}${sub}:${deviceId}`;

// Stores the JTI of the latest access token for a device.
const getAccessJtiKey = (sub: string, deviceId: string) =>
  `${config.redis.sessionAccessJtiPrefix}${sub}:${deviceId}`;

const getDevicesKey = (sub: string) =>
  `${config.redis.userDevicesPrefix}${sub}`;

// ─── Store refresh token ────────────────────────────────────────────

export const storeRefreshToken = async (
  rawToken: string,
  payload: {
    sub: string;
    jti: string;
    deviceId: string;
    iat: number;
    exp: number;
  },
): Promise<string> => {
  const h = hashToken(rawToken);
  const hashKey = `${config.redis.refreshTokenHashPrefix}${h}`;
  const latestKey = getRefreshLatestKey(payload.sub, payload.deviceId);
  const devicesKey = getDevicesKey(payload.sub);

  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(Number(payload.exp) - now, 1);

  await viaRedis(
    "session:store",
    async () => {
      const results = await redis
        .getClient()
        .pipeline()
        .set(hashKey, JSON.stringify(payload), "EX", ttl)
        .set(latestKey, h, "EX", ttl)
        .sadd(devicesKey, payload.deviceId)
        .expire(devicesKey, ttl)
        .exec();

      assertPipeline(results);
      return true;
    },
    false,
  );

  return h;
};

// ─── Get refresh-token payload ──────────────────────────────────────

export const getPayloadByRefreshToken = async (rawToken: string) => {
  const h = hashToken(rawToken);
  const hashKey = `${config.redis.refreshTokenHashPrefix}${h}`;
  const data = await redis.get(hashKey);

  if (!data) return null;

  return data as {
    sub: string;
    jti: string;
    deviceId: string;
    iat: number;
    exp: number;
  };
};

// ─── Get latest refresh-token hash ──────────────────────────────────

export const getLatestHashForDevice = async (sub: string, deviceId: string) => {
  return redis.get(getRefreshLatestKey(sub, deviceId));
};

// ─── Delete refresh token by its raw value ──────────────────────────

export const deleteRefreshByHash = async (rawToken: string) => {
  const h = hashToken(rawToken);
  const key = `${config.redis.refreshTokenHashPrefix}${h}`;

  await redis.delete(key);
};

// ─── Revoke all sessions in Redis ───────────────────────────────────

export const revokeAllSessions = async (
  sub: string,
  excludeDeviceId?: string,
) => {
  const devicesKey = getDevicesKey(sub);

  await viaRedis(
    "session:revokeAll",
    async () => {
      const client = redis.getClient();
      const deviceIds = await client.smembers(devicesKey);
      const pipeline = client.pipeline();
      const revoked: string[] = [];

      for (const deviceId of deviceIds) {
        if (deviceId === excludeDeviceId) continue;

        const refreshLatestKey = getRefreshLatestKey(sub, deviceId);
        const accessJtiKey = getAccessJtiKey(sub, deviceId);

        const refreshHash = await client.get(refreshLatestKey);

        if (refreshHash) {
          pipeline.del(`${config.redis.refreshTokenHashPrefix}${refreshHash}`);
        }

        // Remove both kinds of per-device cache entries.
        pipeline.del(refreshLatestKey);
        pipeline.del(accessJtiKey);

        revoked.push(deviceId);
      }

      if (excludeDeviceId) {
        if (revoked.length) {
          pipeline.srem(devicesKey, ...revoked);
        }
      } else {
        pipeline.del(devicesKey);
      }

      assertPipeline(await pipeline.exec());
      return true;
    },
    false,
  );
};

// ─── Revoke a single device session in Redis ────────────────────────

export const revokeSession = async (sub: string, deviceId: string) => {
  if (!sub) {
    throw new BadRequestError("revokeSession called with undefined sub");
  }

  if (!deviceId) {
    throw new BadRequestError("revokeSession called with undefined deviceId");
  }

  const refreshLatestKey = getRefreshLatestKey(sub, deviceId);
  const accessJtiKey = getAccessJtiKey(sub, deviceId);
  const devicesKey = getDevicesKey(sub);

  await viaRedis(
    "session:revoke",
    async () => {
      const client = redis.getClient();
      const refreshHash = await client.get(refreshLatestKey);
      const pipeline = client.pipeline();

      if (refreshHash) {
        pipeline.del(`${config.redis.refreshTokenHashPrefix}${refreshHash}`);
      }

      pipeline.del(refreshLatestKey);
      pipeline.del(accessJtiKey);
      pipeline.srem(devicesKey, deviceId);

      assertPipeline(await pipeline.exec());
      return true;
    },
    false,
  );
};

// ─── Create or update MongoDB session ───────────────────────────────

export const createMongoSession = async (params: {
  userId: string;
  userPublicId: string;
  deviceId: string;
  userAgent: string;
  ipAddress: string;
  refreshTokenJti: string;
  accessTokenJti: string;
  passwordVersion: number;
  refreshTokenHash: string;
  expiresAt: Date;
  accessTokenExpiresAt: Date;
}) => {
  const parser = new UAParser(params.userAgent);
  const browser = parser.getBrowser().name ?? "Unknown";
  const os = parser.getOS().name ?? "Unknown";
  const deviceName = `${browser} on ${os}`;
  const sessionId = `SES_${uuidv4().replace(/-/g, "").substring(0, 16)}`;

  await SessionModel.findOneAndUpdate(
    {
      userId: params.userId,
      deviceId: params.deviceId,
    },
    {
      $set: {
        userPublicId: params.userPublicId,
        deviceName,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        refreshTokenJti: params.refreshTokenJti,
        accessTokenJti: params.accessTokenJti,
        passwordVersion: params.passwordVersion,
        refreshTokenHash: params.refreshTokenHash,
        accessTokenExpiresAt: params.accessTokenExpiresAt,
        isActive: true,
        lastUsedAt: new Date(),
        expiresAt: params.expiresAt,
      },
      $setOnInsert: {
        sessionId,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  return sessionId;
};

// ─── Access-token JTI blacklist ─────────────────────────────────────

export const blacklistJti = async (
  jti: string,
  expiresAt: Date,
): Promise<void> => {
  const ttl = Math.max(
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    0,
  );

  if (ttl > 0) {
    // Redis may be unavailable. MongoDB remains the fallback
    // source of truth for whether a session is active.
    await redis.set(`${config.redis.blacklistPrefix}${jti}`, "1", ttl);
  }
};

export const isJtiBlacklisted = async (jti: string): Promise<boolean> => {
  const result = await redis.get(
    `${config.redis.blacklistPrefix}${jti}`,
    false,
  );

  return result === "1";
};

// ─── Revoke one session in MongoDB and Redis ────────────────────────

export const revokeSessionFull = async (
  sub: string,
  deviceId: string,
  accessTokenJti?: string,
  accessTokenExpiresAt?: Date,
) => {
  // Mark the MongoDB session inactive even if Redis is unavailable.
  await SessionModel.updateOne(
    {
      userId: sub,
      deviceId,
      isActive: true,
    },
    {
      $set: {
        isActive: false,
      },
    },
  );

  // Remove refresh-token and access-JTI cache keys.
  await revokeSession(sub, deviceId);

  // Blacklist the access token until it expires.
  if (accessTokenJti && accessTokenExpiresAt) {
    await blacklistJti(accessTokenJti, accessTokenExpiresAt);
  }
};

// ─── Revoke multiple sessions in MongoDB and Redis ──────────────────

export const revokeAllSessionsFull = async (
  sub: string,
  excludeDeviceId?: string,
) => {
  const filter: {
    userId: string;
    isActive: boolean;
    deviceId?: { $ne: string };
  } = {
    userId: sub,
    isActive: true,
  };

  if (excludeDeviceId) {
    filter.deviceId = { $ne: excludeDeviceId };
  }

  // Read the active sessions before marking them inactive.
  const sessions = await SessionModel.find(filter).lean();

  // MongoDB is the source of truth for session revocation.
  await SessionModel.updateMany(filter, {
    $set: {
      isActive: false,
    },
  });

  // Best-effort blacklist for still-valid access tokens.
  const now = new Date();

  for (const session of sessions) {
    if (
      session.accessTokenJti &&
      session.accessTokenExpiresAt &&
      session.accessTokenExpiresAt > now
    ) {
      await blacklistJti(session.accessTokenJti, session.accessTokenExpiresAt);
    }
  }

  // Remove Redis cache entries for revoked devices.
  await revokeAllSessions(sub, excludeDeviceId);

  // Preserve the excluded device in the Redis device set.
  if (excludeDeviceId) {
    const devicesKey = getDevicesKey(sub);

    await viaRedis(
      "session:sadd",
      async () => {
        await redis.getClient().sadd(devicesKey, excludeDeviceId);

        return true;
      },
      false,
    );
  }
};

// ─── Get active user sessions ───────────────────────────────────────

export const getUserSessions = async (
  userPublicId: string,
  currentDeviceId: string,
) => {
  const sessions = await SessionModel.find({
    userPublicId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastUsedAt: -1 })
    .lean();

  return sessions.map((session) => ({
    sessionId: session.sessionId,
    deviceName: session.deviceName,
    ipAddress: session.ipAddress,
    lastUsedAt: session.lastUsedAt,
    createdAt: session.createdAt,
    isCurrent: session.deviceId === currentDeviceId,
  }));
};

// ─── Redis reconnect: rehydrate blacklist ───────────────────────────

export const rehydrateBlacklistOnRedisReconnect = async () => {
  logger.info("Redis reconnected — rehydrating authentication cache");

  // Rebuild the blacklist from revoked MongoDB sessions
  // whose access tokens have not expired yet.
  const killed = await SessionModel.find({
    isActive: false,
    accessTokenJti: { $exists: true, $ne: null },
    accessTokenExpiresAt: { $gt: new Date() },
  })
    .select("accessTokenJti accessTokenExpiresAt")
    .lean();

  for (const session of killed) {
    if (session.accessTokenJti && session.accessTokenExpiresAt) {
      await blacklistJti(session.accessTokenJti, session.accessTokenExpiresAt);
    }
  }

  // Remove potentially stale authentication caches.
  // requireAuth can rebuild them from MongoDB when needed.
  await purgeByPattern(`${config.redis.pwdverPrefix}*`);
  await purgeByPattern(`${config.redis.sessionAccessJtiPrefix}*`);

  // Existing application counter recovery.
  await purgeByPattern("daily_tx:*");
  await purgeByPattern("velocity:*");

  logger.info("Authentication cache rehydration complete", {
    blacklistedSessionCount: killed.length,
  });
};
