import {
  getKeyByIP,
  getKeyByEmail,
  getKeyByUserId,
  getKeyByIPAndEmail,
} from "@/config/ratelimiter.config";

import { createRateLimitMiddleware } from "@/shared/middleware/ratelimit.middleware";
import { Response, Request, NextFunction } from "express";
import { logger } from "@/shared/utils/logger";

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ============================================================================
// LOGIN — Critical
// Prevent brute force on credentials.
// Layered: per IP+email (single device spam) + per IP (cross-email scanning)
// ============================================================================

export const loginLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 8,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:login:ipemail",
    failMode: "closed",
    message: "Too many login attempts.",
  }),
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:login:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// REGISTER — Critical
// Prevent mass account creation. IP-based only (account doesn't exist yet).
// ============================================================================

export const registerLimiters = [
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 5,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:register:ip",
    failMode: "closed",
    message:
      "Too many registration attempts from this device. Please try again in an hour.",
  }),
];

// ============================================================================
// VERIFY EMAIL — High
// Submitting OTP for email verification. Prevent brute-force code guessing.
// (Note: the OTPManager itself caps maxAttempts to 5 per OTP — this is the HTTP backstop.)
// ============================================================================

export const verifyEmailLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 10,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:verify-email:ipemail",
    failMode: "closed",
    message: "Too many verification attempts. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:verify-email:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// RESEND VERIFICATION — High
// Triggers OTP creation. HTTP layer is more permissive than the OTP throttle
// (which is the precise gate at 5/hour per email).
// ============================================================================

export const resendVerificationLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:resend-verification:ipemail",
    failMode: "closed",
    message: "Too many resend requests. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByEmail,
    keyPrefix: "rl:resend-verification:email",
    failMode: "closed",
    message: "Too many resend requests. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 20,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:resend-verification:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// FORGOT PASSWORD — High
// Same shape as resend-verification but slightly more lenient since users
// hit this less frequently.
// ============================================================================

export const forgotPasswordLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 8,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:forgot-password:ipemail",
    failMode: "closed",
    message: "Too many password reset requests. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 15,
    keyGenerator: getKeyByEmail,
    keyPrefix: "rl:forgot-password:email",
    failMode: "closed",
    message: "Too many password reset requests. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:forgot-password:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// CONFIRM RESET CODE — High
// Submitting OTP for password reset. Brute-force protection.
// ============================================================================

export const confirmResetCodeLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 10,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:confirm-reset:ipemail",
    failMode: "closed",
    message: "Too many verification attempts. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:confirm-reset:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// RESET PASSWORD — Critical
// The actual password change with a valid reset code. Strict to prevent
// account takeover via stolen codes.
// ============================================================================

export const resetPasswordLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:reset-password:ipemail",
    failMode: "closed",
    message: "Too many password reset attempts. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 10,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:reset-password:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const changePasswordLimiters = [
  // Per IP + email: 5 attempts per 15 minutes
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:change-password:ipemail",
    failMode: "closed",
    message: "Too many password change attempts. Please try again later.",
  }),
  // Per email: 10 attempts per hour
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByEmail,
    keyPrefix: "rl:change-password:email",
    failMode: "closed",
    message: "Too many password change attempts. Please try again later.",
  }),
  // Per IP: 20 attempts per 15 minutes
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 20,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:change-password:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const pinSetupLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:pin-setup:ipemail",
    failMode: "closed",
    message: "Too many PIN setup attempts. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:pin-setup:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const pinChangeLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:pin-change:ipemail",
    failMode: "closed",
    message: "Too many PIN change attempts. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:pin-change:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const pinForgotLimiters = [
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 3,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:pin-forgot:ipemail",
    failMode: "closed",
    message: "Too many PIN reset requests. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 5,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:pin-forgot:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const pinResetLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:pin-reset:ipemail",
    failMode: "closed",
    message: "Too many PIN reset attempts. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:pin-reset:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const pinRequestChangeOtpLimiters = [
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 3,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:pin-change-otp:ipemail",
    failMode: "closed",
    message: "Too many OTP requests. Please try again later.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 5,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:pin-change-otp:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// REFRESH TOKEN — Medium
// IP-based since the refresh token is in cookies/headers, not body.
// Fail-open: refresh failures during a Redis outage shouldn't lock users out.
// ============================================================================

export const refreshTokenLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:refresh:ip",
    failMode: "open",
    message: "Too many refresh attempts. Please try again shortly.",
  }),
];

// ============================================================================
// LOGOUT — Low
// Lenient — logout shouldn't be hard to do. Fail-open.
// ============================================================================

export const logoutLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:logout:ip",
    failMode: "open",
  }),
];

// ============================================================================
// LOGOUT ALL — Medium (auth required)
// Per user since requireAuth has run before this. Fail-open.
// ============================================================================

export const logoutAllLimiters = [
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 5,
    keyGenerator: getKeyByUserId,
    keyPrefix: "rl:logout-all:user",
    failMode: "open",
    message: "Too many session termination requests. Please try again later.",
  }),
];

// ============================================================================
// ME — Auth-required user data
// Generous — this is just a profile read.
// ============================================================================

export const meLimiters = [
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 100,
    keyGenerator: getKeyByUserId,
    keyPrefix: "rl:me:user",
    failMode: "open",
  }),
];

// ============================================================================
// PLACEHOLDERS — uncomment when these endpoints are built
// ============================================================================

export const paymentInitLimiters = [
  // Per-user limit — max 5 initializations per 15 minutes
  createRateLimitMiddleware({
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByUserId, // keyed to the user, not IP
    keyPrefix: "rl:payment-init:user",
    failMode: "open",
    message: "Too many payment attempts. Please wait before trying again.",
  }),
  // Per-IP limit — catches unauthenticated abuse before auth runs
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 20,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:payment-init:ip",
    failMode: "open",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const paymentListLimiter = createRateLimitMiddleware({
  windowMs: ONE_MINUTE,
  maxRequests: 20,
  keyGenerator: getKeyByUserId,
  keyPrefix: "rl:payment-list:user",
  failMode: "open",
  message: "Too many requests. Please slow down.",
});

export const paymentReferenceLimiter = createRateLimitMiddleware({
  windowMs: ONE_MINUTE,
  maxRequests: 30,
  keyGenerator: getKeyByUserId,
  keyPrefix: "rl:payment-ref:user",
  failMode: "open",
  message: "Too many requests. Please slow down.",
});

//Not important at the moment, but will be used to protect payment reference lookup and listing endpoints in payment.controller.ts.
export const paystackIpWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const allowedIPs = ["52.31.139.75", "52.49.173.169", "52.214.14.220"]; // Paystack's published IPs

  const requestIP = req.ip || req.socket.remoteAddress;

  if (!allowedIPs.includes(requestIP!)) {
    logger.warn("Webhook request from unknown IP", { ip: requestIP });
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  next();
};

// ============================================================================
// KYC RESUBMIT — Medium
// Authenticated (requireAuth runs first), so keyed by user. Protects the
// admin review queue and the Cloudinary upload pipeline from resubmission
// spam. Fail-open: a Redis outage shouldn't block a legitimate resubmission.
// ============================================================================

export const kycResubmitLimiters = [
  createRateLimitMiddleware({
    windowMs: TWENTY_FOUR_HOURS,
    maxRequests: 5,
    keyGenerator: getKeyByUserId,
    keyPrefix: "rl:kyc-resubmit:user",
    failMode: "open",
    message:
      "Too many resubmission attempts. Please try again tomorrow, or contact support if your documents were incorrectly rejected.",
  }),
  createRateLimitMiddleware({
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:kyc-resubmit:ip",
    failMode: "open",
    message: "Too many requests from this device. Please try again later.",
  }),
];
