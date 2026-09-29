import { hashToken } from "@/config/hashToken";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { hashedPassword, verifyPassword } from "@/config/password";
import {
  emitOutboxEvent,
  getLockTime,
} from "@/infrastructure/helpers/emit.audit.helper";
import BadRequestError from "@/shared/errors/badRequest";
import { generateEventId } from "@/shared/utils/id.generator";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import AuditLogger from "../audit/audit.service";
import User from "../auth/authmodel";
import OTPManager, { OTPConfigs, OTPPurpose } from "../helpers/otp.manager";
import emailQueue from "@/infrastructure/queues/email.queue";

class PinService {
  private userModel = User;
  private otpManager = new OTPManager();

  // ─── Setup PIN
  public async setupPin(
    userId: string,
    pin: string,
    confirmPin: string,
    context: IRequestContext,
  ) {
    const eventId = generateEventId();

    if (pin !== confirmPin) {
      throw new BadRequestError("PINs do not match");
    }

    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestError("PIN must be 4 to 6 digits");
    }

    const user = await this.userModel
      .findOne({ userId })
      .select("+transactionPin.hash")
      .exec();

    if (!user) throw new BadRequestError("User not found");

    if (user.transactionPin?.hash) {
      throw new BadRequestError("PIN already set. Use change PIN instead");
    }

    const pinHash = await hashedPassword(pin);

    await this.userModel.updateOne(
      { userId },
      {
        $set: {
          "transactionPin.hash": pinHash,
          "transactionPin.setAt": new Date(),
          "transactionPin.failedAttempts": 0,
          "transactionPin.lockedUntil": null,
        },
        $inc: { pinVersion: 1 },
      },
    );

    await emitOutboxEvent({
      topic: "pin.events",
      eventId,
      eventType: AuditAction.PIN_SETUP,
      action: AuditAction.PIN_SETUP,
      status: AuditStatus.PENDING,
      payload: { userId, email: user.email, name: user.name },
      aggregateType: "PIN_SETUP",
      aggregateId: userId,
      version: 1,
      context,
    });

    AuditLogger.logUserAction(
      context,
      AuditAction.PIN_SETUP,
      AuditStatus.SUCCESS,
      userId,
    );

    return { success: true, message: "Transaction PIN set successfully" };
  }

  // ─── Request OTP for PIN change ───────────────────────────────────────────
  public async requestChangePinOtp(userId: string, context: IRequestContext) {
    const user = await this.userModel.findOne({ userId }).exec();
    if (!user) throw new BadRequestError("User not found");

    // Generate OTP — throttle handled inside OTPManager
    const { code, expiryMinutes } = await this.otpManager.create(
      user.email,
      OTPPurpose.PIN_CHANGE,
      OTPConfigs.pinChange,
    );

    // Enqueue email directly — no Kafka needed for this
    // This is a synchronous user action, not an async event
    await emailQueue.add(
      "sendPinChangeOtp",
      {
        email: user.email,
        name: user.name,
        otp: code,
        expiryMinutes,
        type: "PIN_CHANGE_OTP",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        jobId: `pin_change_otp_${user.email}_${code}`,
      },
    );

    AuditLogger.logUserAction(
      context,
      AuditAction.PIN_RESET_REQUESTED,
      AuditStatus.SUCCESS,
      userId,
    );

    return {
      success: true,
      message: "Verification code sent to your email",
    };
  }

  // ─── Change PIN ───────────────────────────────────────────────────────────
  public async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
    confirmNewPin: string,
    authType: "password" | "otp",
    authValue: string, // password string or OTP string depending on authType
    context: IRequestContext,
  ) {
    const eventId = generateEventId();

    if (newPin !== confirmNewPin) {
      throw new BadRequestError("New PINs do not match");
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      throw new BadRequestError("PIN must be 4 to 6 digits");
    }

    const user = await this.userModel
      .findOne({ userId })
      .select(
        "+transactionPin.hash +transactionPin.failedAttempts +transactionPin.lockedUntil +password",
      )
      .exec();

    if (!user) throw new BadRequestError("User not found");

    if (!user.transactionPin?.hash) {
      throw new BadRequestError("No PIN set. Please set up a PIN first");
    }

    // Check lock
    if (
      user.transactionPin.lockedUntil &&
      user.transactionPin.lockedUntil > new Date()
    ) {
      const minutesLeft = Math.ceil(
        (user.transactionPin.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new BadRequestError(
        `PIN locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}`,
      );
    }

    // ─── Step 1: Verify current PIN ───────────────────────────────────────
    const isCurrentPinValid = await verifyPassword(
      currentPin,
      user.transactionPin.hash,
    );

    if (!isCurrentPinValid) {
      const failedAttempts = (user.transactionPin.failedAttempts || 0) + 1;
      const lockDurationMs = getLockTime(failedAttempts);
      const lockedUntil = lockDurationMs
        ? new Date(Date.now() + lockDurationMs)
        : null;

      await this.userModel.updateOne(
        { userId },
        {
          $set: {
            "transactionPin.failedAttempts": failedAttempts,
            "transactionPin.lockedUntil": lockedUntil,
          },
        },
      );

      AuditLogger.logUserAction(
        context,
        AuditAction.PIN_VERIFY_FAILED,
        AuditStatus.FAILED,
        userId,
      );

      throw new BadRequestError("Incorrect current PIN");
    }

    // ─── Step 2: Secondary authorization ─────────────────────────────────
    if (authType === "password") {
      // Verify account password
      const isPasswordValid = await verifyPassword(authValue, user.password);

      if (!isPasswordValid) {
        throw new BadRequestError("Incorrect password");
      }
    } else {
      // Verify OTP
      const verifyResult = await this.otpManager.verify(
        user.email,
        authValue,
        OTPPurpose.PIN_CHANGE,
      );

      if (!verifyResult.success) {
        throw new BadRequestError(verifyResult.message);
      }

      // Clean up OTP after successful verification
      await this.otpManager.invalidate(user.email, OTPPurpose.PIN_CHANGE);
    }

    // ─── Step 3: Same PIN check ───────────────────────────────────────────
    const isSamePin = await verifyPassword(newPin, user.transactionPin.hash);
    if (isSamePin) {
      throw new BadRequestError("New PIN cannot be the same as current PIN");
    }

    // ─── Step 4: Hash and save ────────────────────────────────────────────
    const newPinHash = await hashedPassword(newPin);

    await this.userModel.updateOne(
      { userId },
      {
        $set: {
          "transactionPin.hash": newPinHash,
          "transactionPin.setAt": new Date(),
          "transactionPin.failedAttempts": 0,
          "transactionPin.lockedUntil": null,
          "transactionPin.lockReason": null,
        },
        $inc: { pinVersion: 1 },
      },
    );

    await emitOutboxEvent({
      topic: "pin.events",
      eventId,
      eventType: AuditAction.PIN_CHANGE,
      action: AuditAction.PIN_CHANGE,
      status: AuditStatus.PENDING,
      payload: { userId, email: user.email, name: user.name },
      aggregateType: "PIN_CHANGE",
      aggregateId: userId,
      version: 1,
      context,
    });

    AuditLogger.logUserAction(
      context,
      AuditAction.PIN_CHANGE,
      AuditStatus.SUCCESS,
      userId,
    );

    return { success: true, message: "Transaction PIN changed successfully" };
  }

  // ─── Forgot PIN — emit event, consumer handles OTP ───────────────────────
  public async forgotPin(userId: string, context: IRequestContext) {
    const eventId = generateEventId();

    const user = await this.userModel.findOne({ userId }).exec();
    if (!user) throw new BadRequestError("User not found");

    await emitOutboxEvent({
      topic: "pin.events",
      eventId,
      eventType: AuditAction.PIN_RESET_REQUESTED,
      action: AuditAction.PIN_RESET_REQUESTED,
      status: AuditStatus.PENDING,
      payload: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
      aggregateType: "PIN_RESET_REQUESTED",
      aggregateId: userId,
      version: 1,
      context,
    });

    AuditLogger.logUserAction(
      context,
      AuditAction.PIN_RESET_REQUESTED,
      AuditStatus.SUCCESS,
      userId,
    );

    return {
      success: true,
      message:
        "If your account exists, a PIN reset code has been sent to your email",
    };
  }

  // ─── Reset PIN — verify OTP then set new PIN ──────────────────────────────
  public async resetPin(
    userId: string,
    otp: string,
    newPin: string,
    confirmPin: string,
    context: IRequestContext,
  ) {
    const eventId = generateEventId();

    if (newPin !== confirmPin) {
      throw new BadRequestError("PINs do not match");
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      throw new BadRequestError("PIN must be 4 to 6 digits");
    }

    const user = await this.userModel.findOne({ userId }).exec();
    if (!user) throw new BadRequestError("User not found");

    const verifyResult = await this.otpManager.verify(
      user.email,
      otp,
      OTPPurpose.PIN_RESET,
    );

    if (!verifyResult.success) {
      throw new BadRequestError(verifyResult.message);
    }

    const newPinHash = await hashedPassword(newPin);

    await this.userModel.updateOne(
      { userId },
      {
        $set: {
          "transactionPin.hash": newPinHash,
          "transactionPin.setAt": new Date(),
          "transactionPin.failedAttempts": 0,
          "transactionPin.lockedUntil": null,
          "transactionPin.lockReason": null,
        },
        $inc: { pinVersion: 1 },
      },
    );

    await this.otpManager.invalidate(user.email, OTPPurpose.PIN_RESET);

    await emitOutboxEvent({
      topic: "pin.events",
      eventId,
      eventType: AuditAction.PIN_RESET_SUCCESS,
      action: AuditAction.PIN_RESET_SUCCESS,
      status: AuditStatus.PENDING,
      payload: { userId: user.userId, email: user.email, name: user.name },
      aggregateType: "PIN_RESET_SUCCESS",
      aggregateId: userId,
      version: 1,
      context,
    });

    AuditLogger.logUserAction(
      context,
      AuditAction.PIN_RESET_SUCCESS,
      AuditStatus.SUCCESS,
      userId,
    );

    return { success: true, message: "Transaction PIN reset successfully" };
  }

  // ─── Get PIN status ───────────────────────────────────────────────────────
  public async getPinStatus(userId: string) {
    const user = await this.userModel
      .findOne({ userId })
      .select("+transactionPin.hash")
      .exec();

    return {
      isPinSet: Boolean(user?.transactionPin?.hash),
    };
  }
}

export default PinService;
