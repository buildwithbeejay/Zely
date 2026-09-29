import { verifyPassword } from "@/config/password";
import {
  emitOutboxEvent,
  getLockTime,
} from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import AuditLogger from "@/modules/audit/audit.service";
import User from "@/modules/auth/authmodel";
import BadRequestError from "@/shared/errors/badRequest";
import { generateEventId } from "@/shared/utils/id.generator";
import { NextFunction, Request, Response } from "express";

export const MAX_PIN_ATTEMPTS = 5;

export const requirePin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    const { pin } = req.body;

    if (!userId) {
      return next(new BadRequestError("User not found"));
    }

    if (!pin) {
      return next(
        new BadRequestError("Transaction PIN is required", [], {
          code: "PIN_REQUIRED",
        }),
      );
    }

    const user = await User.findOne({ userId })
      .select(
        "+transactionPin.hash " +
          "+transactionPin.failedAttempts " +
          "+transactionPin.lockedUntil",
      )
      .exec();

    if (!user) {
      return next(new BadRequestError("User not found"));
    }

    if (!user.transactionPin?.hash) {
      return next(
        new BadRequestError("PIN_NOT_SET", [], {
          code: "PIN_NOT_SET",
        }),
      );
    }

    const now = new Date();

    /**
     * Check whether the PIN is currently locked.
     */
    if (
      user.transactionPin.lockedUntil &&
      user.transactionPin.lockedUntil > now
    ) {
      delete req.body.pin;

      return next(
        new BadRequestError("PIN locked", [], {
          locked: true,
          attemptsLeft: 0,
          lockedUntil: user.transactionPin.lockedUntil.toISOString(),
        }),
      );
    }

    /**
     * If a previous lock has expired, clear it.
     */
    if (
      user.transactionPin.lockedUntil &&
      user.transactionPin.lockedUntil <= now
    ) {
      await User.updateOne(
        { userId },
        {
          $set: {
            "transactionPin.failedAttempts": 0,
            "transactionPin.lockedUntil": null,
          },
        },
      );

      user.transactionPin.failedAttempts = 0;
      user.transactionPin.lockedUntil = null;
    }

    /**
     * Verify PIN.
     */
    const isValid = await verifyPassword(pin, user.transactionPin.hash);

    /**
     * CORRECT PIN — reset any failure streak and continue the request.
     */
    if (isValid) {
      if (
        user.transactionPin.failedAttempts ||
        user.transactionPin.lockedUntil
      ) {
        await User.updateOne(
          { userId },
          {
            $set: {
              "transactionPin.failedAttempts": 0,
              "transactionPin.lockedUntil": null,
            },
          },
        );
      }

      delete req.body.pin;

      return next();
    }

    /**
     * WRONG PIN
     */
    const currentFailedAttempts = user.transactionPin.failedAttempts || 0;
    const failedAttempts = currentFailedAttempts + 1;
    const attemptsRemaining = Math.max(MAX_PIN_ATTEMPTS - failedAttempts, 0);

    /**
     * Maximum attempts reached.
     */
    if (failedAttempts >= MAX_PIN_ATTEMPTS) {
      const lockDurationMs = getLockTime(failedAttempts);
      const lockedUntil = lockDurationMs
        ? new Date(Date.now() + lockDurationMs)
        : new Date(Date.now() + 15 * 60 * 1000);

      const wasLocked = Boolean(user.transactionPin.lockedUntil);

      await User.updateOne(
        { userId },
        {
          $set: {
            "transactionPin.failedAttempts": failedAttempts,
            "transactionPin.lockedUntil": lockedUntil,
          },
        },
      );

      // Emit only on transition — same pattern as login
      if (!wasLocked) {
        await emitOutboxEvent({
          topic: "pin.events",
          eventId: generateEventId(),
          eventType: AuditAction.PIN_LOCKED,
          action: AuditAction.PIN_LOCKED,
          status: AuditStatus.PENDING,
          payload: {
            userId,
            email: user.email, // ← add this
            name: user.name, // ← add this
            reason: `Too many failed PIN attempts (${failedAttempts})`,
          },
          aggregateType: "PIN_LOCKED",
          aggregateId: userId,
          version: 1,
          context: req.context,
        });
      }

      AuditLogger.logUserAction(
        req.context,
        AuditAction.PIN_VERIFY_FAILED,
        AuditStatus.FAILED,
        userId,
      );

      delete req.body.pin;

      return next(
        new BadRequestError("PIN locked", [], {
          locked: true,
          attemptsLeft: 0,
          lockedUntil: lockedUntil.toISOString(),
        }),
      );
    }

    // Wrong PIN but still has attempts
    await User.updateOne(
      { userId },
      {
        $set: {
          "transactionPin.failedAttempts": failedAttempts,
          "transactionPin.lockedUntil": null,
        },
      },
    );

    AuditLogger.logUserAction(
      req.context,
      AuditAction.PIN_VERIFY_FAILED,
      AuditStatus.FAILED,
      userId,
    );

    delete req.body.pin;

    return next(
      new BadRequestError("Incorrect PIN", [], {
        code: "INVALID_PIN",
        locked: false,
        attemptsLeft: attemptsRemaining,
        lockedUntil: null,
      }),
    );
  } catch (error) {
    next(error);
  }
};
