export class AuditError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuditError';
  }

  static validation(msg: string): AuditError    { return new AuditError('AUDIT_VALIDATION_ERROR', msg, 400); }
  static notFound(msg: string): AuditError      { return new AuditError('AUDIT_NOT_FOUND', msg, 404); }
  static unauthorized(msg: string): AuditError  { return new AuditError('AUDIT_UNAUTHORIZED', msg, 401); }
  static forbidden(msg: string): AuditError     { return new AuditError('AUDIT_FORBIDDEN', msg, 403); }
  static immutable(msg: string): AuditError     { return new AuditError('AUDIT_IMMUTABLE', msg, 405); }
  static internal(msg: string): AuditError      { return new AuditError('AUDIT_INTERNAL', msg, 500); }
}
