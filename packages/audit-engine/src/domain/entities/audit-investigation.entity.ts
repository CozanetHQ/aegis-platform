// ── Audit Engine · Domain Entity: AuditInvestigation ─────────────────
//
// Admin-only investigation that groups events by a pivot point
// (user, wallet, correlation ID, device, email, phone) and
// constructs a cross-engine timeline.

import type { InvestigationStatus } from '../enums/audit-enums';

export interface InvestigationProps {
  investigationId: string;
  initiatedBy:     string;          // admin aegis_id
  pivotType:       string;          // USER_ID | WALLET_ADDRESS | TX_HASH | CORRELATION_ID | DEVICE_ID | EMAIL | PHONE
  pivotValue:      string;
  title:           string;
  description:     string | null;
  status:          InvestigationStatus;
  eventIds:        string[];
  anomalies:       Record<string, unknown>[];
  createdAt:       string;
  updatedAt:       string;
  closedAt:        string | null;
}

export interface CreateInvestigationInput {
  initiatedBy: string;
  pivotType:   string;
  pivotValue:  string;
  title?:      string;
  description?:string;
}

export class AuditInvestigation {
  private _status:    InvestigationStatus;
  private _eventIds:  string[];
  private _anomalies: Record<string, unknown>[];
  private _updatedAt: Date;
  private _closedAt:  Date | null;

  private constructor(
    private readonly _investigationId: string,
    private readonly _initiatedBy:     string,
    private readonly _pivotType:       string,
    private readonly _pivotValue:      string,
    private readonly _title:           string,
    private readonly _description:     string | null,
    status:          InvestigationStatus,
    eventIds:        string[],
    anomalies:       Record<string, unknown>[],
    createdAt:       Date,
    updatedAt:       Date,
    closedAt:        Date | null,
  ) {
    this._status = status;
    this._eventIds = eventIds;
    this._anomalies = anomalies;
    this._updatedAt = updatedAt;
    this._closedAt = closedAt;
  }

  static create(input: CreateInvestigationInput): AuditInvestigation {
    const now = new Date();
    return new AuditInvestigation(
      `inv_${crypto.randomUUID()}`,
      input.initiatedBy,
      input.pivotType,
      input.pivotValue,
      input.title ?? `Investigation: ${input.pivotType}=${input.pivotValue}`,
      input.description ?? null,
      'OPEN',
      [],
      [],
      now,
      now,
      null,
    );
  }

  static rehydrate(props: InvestigationProps): AuditInvestigation {
    return new AuditInvestigation(
      props.investigationId,
      props.initiatedBy,
      props.pivotType,
      props.pivotValue,
      props.title,
      props.description,
      props.status,
      props.eventIds,
      props.anomalies,
      new Date(props.createdAt),
      new Date(props.updatedAt),
      props.closedAt ? new Date(props.closedAt) : null,
    );
  }

  get investigationId(): string { return this._investigationId; }
  get initiatedBy():     string { return this._initiatedBy; }
  get pivotType():       string { return this._pivotType; }
  get pivotValue():      string { return this._pivotValue; }
  get title():           string { return this._title; }
  get description():     string | null { return this._description; }
  get status():          InvestigationStatus { return this._status; }
  get eventIds():        string[] { return [...this._eventIds]; }
  get anomalies():       Record<string, unknown>[] { return [...this._anomalies]; }
  get createdAt():       string { return new Date(this._updatedAt).toISOString(); }
  get updatedAt():       string { return this._updatedAt.toISOString(); }
  get closedAt():        string | null { return this._closedAt?.toISOString() ?? null; }

  addEvent(eventId: string): void {
    if (!this._eventIds.includes(eventId)) this._eventIds.push(eventId);
    this._updatedAt = new Date();
  }

  addAnomaly(anomaly: Record<string, unknown>): void {
    this._anomalies.push(anomaly);
    this._updatedAt = new Date();
  }

  start(): void {
    if (this._status === 'OPEN') {
      this._status = 'IN_PROGRESS';
      this._updatedAt = new Date();
    }
  }

  complete(): void {
    this._status = 'COMPLETED';
    this._closedAt = new Date();
    this._updatedAt = new Date();
  }

  archive(): void {
    this._status = 'ARCHIVED';
    this._updatedAt = new Date();
  }

  toProps(): InvestigationProps {
    return {
      investigationId: this.investigationId,
      initiatedBy:     this.initiatedBy,
      pivotType:       this.pivotType,
      pivotValue:      this.pivotValue,
      title:           this.title,
      description:     this.description,
      status:          this.status,
      eventIds:        this.eventIds,
      anomalies:       this.anomalies,
      createdAt:       this.createdAt,
      updatedAt:       this.updatedAt,
      closedAt:        this.closedAt,
    };
  }

  toPublicJSON(): Record<string, unknown> {
    return {
      investigationId: this.investigationId,
      initiatedBy:     this.initiatedBy,
      pivotType:       this.pivotType,
      pivotValue:      this.pivotValue,
      title:           this.title,
      description:     this.description,
      status:          this.status,
      eventCount:      this.eventIds.length,
      anomalyCount:    this.anomalies.length,
      createdAt:       this.createdAt,
      updatedAt:       this.updatedAt,
      closedAt:        this.closedAt,
    };
  }
}
