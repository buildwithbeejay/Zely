import HttpException, { ErrorOutput } from "./customAPIError";
import { StatusCodes } from "http-status-codes";

enum ForbiddenErrorCode {
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  RESOURCE_OWNERSHIP_REQUIRED = "RESOURCE_OWNERSHIP_REQUIRED",
  ADMIN_ONLY = "ADMIN_ONLY",
  ACCOUNT_RESTRICTED = "ACCOUNT_RESTRICTED",
  FORBIDDEN = "FORBIDDEN_ACCESS", // generic fallback, matches your existing default
}

class Unauthorized extends HttpException {
  public code: ForbiddenErrorCode;

  constructor(
    message: string,
    code: ForbiddenErrorCode = ForbiddenErrorCode.FORBIDDEN,
  ) {
    super(message, StatusCodes.FORBIDDEN, code);
    this.code = code;
  }

  serializeErrors(): ErrorOutput[] {
    return [
      {
        message: this.message,
        status: this.statusCode,
        code: this.code,
        extension: {
          details:
            "The authenticated user does not have permission to perform this action.",
        },
      },
    ];
  }
}

export default Unauthorized;
export { ForbiddenErrorCode };
