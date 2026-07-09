// ── Audit Engine · Domain Entity: AuditExport ────────────────────────

import type { ExportFormat, ExportStatus } from '../enums/audit-enums';

export interface ExportProps {
  exportId:     string;
  requestedBy:  string;
  format:       ExportFormat;
  filters:      Record<string, unknown>;
  status:       ExportStatus;
  fileUrl:      string | null;
  totalEvents:  number;
  error:        string | null;
  createdAt:    string;
  completedAt:  string | null;
  expiresAt:    string | null;
}

export interface CreateExportInput {
  requestedBy: string;
  format:      string;
  filters:     Record<string, unknown>;
}

export class AuditExport {
  private _status:      ExportStatus;
  private _fileUrl:     string | null;
  private _totalEvents: number;
  private _error:       string | null;
  private _completedAt: Date | null;

  private constructor(
    private readonly _exportId:    string,
    private readonly _requestedBy: string,
    private readonly _format:      ExportFormat,
    private readonly _filters:     Record<string, unknown>,
    status:       ExportStatus,
    fileUrl:      string | null,
    totalEvents:  number,
    error:        string | null,
    private readonly _createdAt:   Date,
    completedAt:  Date | null,
    private readonly _expiresAt:   Date | null,
  ) {
    this._status = status;
    this._fileUrl = fileUrl;
    this._totalEvents = totalEvents;
    this._error = error;
    this._completedAt = completedAt;
  }

  static create(input: CreateExportInput): AuditExport {
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h expiry
    return new AuditExport(
      `exp_${crypto.randomUUID()}`,
      input.requestedBy,
      input.format as ExportFormat,
      input.filters,
      'PENDING',
      null,
      0,
      null,
      now,
      null,
      expires,
    );
  }

  static rehydrate(props: ExportProps): AuditExport {
    return new AuditExport(
      props.exportId,
      props.requestedBy,
      props.format,
      props.filters,
      props.status,
      props.fileUrl,
      props.totalEvents,
      props.error,
      new Date(props.createdAt),
      props.completedAt ? new Date(props.completedAt) : null,
      props.expiresAt ? new Date(props.expiresAt) : null,
    );
  }

  get exportId():    string { return this._exportId; }
  get requestedBy(): string { return this._requestedBy; }
  get format():      ExportFormat { return this._format; }
  get filters():     Record<string, unknown> { return this._filters; }
  get status():      ExportStatus { return this._status; }
  get fileUrl():     string | null { return this._fileUrl; }
  get totalEvents(): number { return this._totalEvents; }
  get error():       string | null { return this._error; }
  get createdAt():   string { return this._createdAt.toISOString(); }
  get completedAt(): string | null { return this._completedAt?.toISOString() ?? null; }
  get expiresAt():   string | null { return this._expiresAt?.toISOString() ?? null; }

  markProcessing(): void { this._status = 'PROCESSING'; }
  markCompleted(fileUrl: string, totalEvents: number): void {
    this._status = 'COMPLETED';
    this._fileUrl = fileUrl;
    this._totalEvents = totalEvents;
    this._completedAt = new Date();
  }
  markFailed(error: string): void {
    this._status = 'FAILED';
    this._error = error;
    this._completedAt = new Date();
  }

  toProps(): ExportProps {
    return {
      exportId: this.exportId,
      requestedBy: this.requestedBy,
      format: this.format,
      filters: this.filters,
      status: this.status,
      fileUrl: this.fileUrl,
      totalEvents: this.totalEvents,
      error: this.error,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      expiresAt: this.expiresAt,
    };
  }

  toPublicJSON(): Record<string, unknown> {
    return {
      exportId: this.exportId,
      requestedBy: this.requestedBy,
      format: this.format,
      status: this.status,
      fileUrl: this.fileUrl,
      totalEvents: this.totalEvents,
      error: this.error,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      expiresAt: this.expiresAt,
    };
  }
}
