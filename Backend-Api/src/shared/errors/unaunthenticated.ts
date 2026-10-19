import { StatusCodes } from "http-status-codes";
import HttpException, { ErrorOutput } from "./customAPIError";

export enum AuthErrorCode {
  SESSION_INVALIDATED = "SESSION_INVALIDATED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_REVOKED = "SESSION_REVOKED",
  TOKEN_REUSE_DETECTED = "TOKEN_REUSE_DETECTED",
  TOKEN_ALREADY_ROTATED = "TOKEN_ALREADY_ROTATED",
  UNAUTHORIZED = "UNAUTHORIZED",
  AUTH_SERVICE_UNAVAILABLE = "AUTH_SERVICE_UNAVAILABLE",
}

class UnauthenticatedError extends HttpException {
  public statusCode: number;
  public code: AuthErrorCode;

  constructor(
    message: string,
    code: AuthErrorCode = AuthErrorCode.UNAUTHORIZED,
  ) {
    super(message, StatusCodes.UNAUTHORIZED, code);
    this.statusCode = StatusCodes.UNAUTHORIZED;
    this.code = code;
  }

  serializeErrors(): ErrorOutput[] {
    return [
      {
        message: this.message,
        status: this.statusCode,
        code: this.code,
      },
    ];
  }
}

export default UnauthenticatedError;
