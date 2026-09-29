import HttpException, { ErrorOutput } from "./customAPIError";
import { StatusCodes } from "http-status-codes";

interface FieldError {
  field: string;
  message: string;
}

export interface BadRequestMeta {
  code?: string;
  locked?: boolean; // ← add this
  attemptsLeft?: number; // ← rename from attemptsRemaining to match what we discussed
  lockedUntil?: string | null;
}

class BadRequestError extends HttpException {
  private errors: FieldError[];
  private meta?: BadRequestMeta;

  constructor(
    message: string,
    errors: FieldError[] = [],
    meta?: BadRequestMeta,
  ) {
    super(message, StatusCodes.BAD_REQUEST, "VALIDATION_ERROR");

    this.errors = errors;
    this.meta = meta;
  }

  serializeErrors(): ErrorOutput[] {
    if (this.errors.length > 0) {
      return this.errors.map((err) => ({
        message: err.message,
        status: this.statusCode,
        code: "INVALID_FIELD",
        extension: {
          field: err.field,
          ...this.meta,
        },
      }));
    }

    return [
      {
        message: this.message,
        status: this.statusCode,
        code: this.meta?.code ?? this.errorCode,
        extension: this.meta,
      },
    ];
  }
}

export default BadRequestError;
