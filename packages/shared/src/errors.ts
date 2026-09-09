export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "SAFETY_BLOCKED"
  | "UNWINNABLE"
  | "ILLEGAL_TRANSITION"
  | "FEATURE_DISABLED"
  | "INTERNAL";

export class CinchError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CinchError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): CinchError {
  return new CinchError("BAD_REQUEST", message, 400, details);
}

export function unauthorized(message = "Unauthorized"): CinchError {
  return new CinchError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Forbidden"): CinchError {
  return new CinchError("FORBIDDEN", message, 403);
}

export function notFound(message = "Not found"): CinchError {
  return new CinchError("NOT_FOUND", message, 404);
}

export function conflict(message: string): CinchError {
  return new CinchError("CONFLICT", message, 409);
}

export function safetyBlocked(message: string, details?: Record<string, unknown>): CinchError {
  return new CinchError("SAFETY_BLOCKED", message, 422, details);
}

export function illegalTransition(from: string, to: string): CinchError {
  return new CinchError(
    "ILLEGAL_TRANSITION",
    `Cannot transition from ${from} to ${to}`,
    409,
    { from, to },
  );
}
