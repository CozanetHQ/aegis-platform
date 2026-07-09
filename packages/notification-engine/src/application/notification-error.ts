/**
 * notification-error.ts — Notification Engine · Application Layer
 * Engine-scoped error class, matching the AegisError shape used by every
 * other engine (TransferError, PaymentError, ...) — code + correct
 * httpStatus + correlationId + timestamp.
 *
 * Added during the 2026-07 contract-first audit: this engine previously
 * threw plain `Error('NOTIFICATION_NOT_FOUND')` / `Error('FORBIDDEN')`
 * from mark-read.use-case.ts. @cozanethq/aegis-shared-sdk's err() only
 * recognizes AegisError subclasses for status mapping — anything else
 * falls through to a generic 500, regardless of what the message says.
 * So a "you don't own this notification" 403 and a "no such notification"
 * 404 were both actually being returned to callers as 500s.
 */
import { AegisError } from "@cozanethq/aegis-shared-sdk";

export type NotificationErrorCode =
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_FORBIDDEN"
  | "NOTIFICATION_VALIDATION_ERROR";

const HTTP_STATUS: Record<NotificationErrorCode, number> = {
  NOTIFICATION_NOT_FOUND:        404,
  NOTIFICATION_FORBIDDEN:        403,
  NOTIFICATION_VALIDATION_ERROR: 400,
};

export class NotificationError extends AegisError {
  constructor(code: NotificationErrorCode, message: string, details?: unknown) {
    super(code, message, HTTP_STATUS[code], details);
    this.name = "NotificationError";
  }
}
