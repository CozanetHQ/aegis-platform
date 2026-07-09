// ── Audit Engine · Domain Entity: AuditEvent ─────────────────────────
//
// Immutable, append-only record. Once created, no field may change.
// Corrections are new events with a `correctionFor` reference.

import {
  AuditEventId, CorrelationId, EventCategoryVO, SeverityVO,
  ActorTypeVO, EventOutcomeVO, EngineSourceVO, PlatformVO, Timestamp,
} from '../value-objects/audit-value-objects';
import type {
  EventCategory, Severity, ActorType, EventOutcome,
  EngineSource, Platform,
} from '../enums/audit-enums';

export interface AuditEventProps {
  eventId:            string;
  timestamp:          string;          // ISO 8601 UTC
  engine:             string;          // EngineSource
  category:           string;          // EventCategory
  eventName:          string;
  severity:           string;          // Severity
  correlationId:      string;
  userId:             string | null;
  actorId:            string | null;
  actorType:          string;          // ActorType
  walletId:           string | null;
  walletAddress:      string | null;
  deviceId:           string | null;
  ipAddress:          string | null;
  country:            string | null;
  platform:           string;          // Platform
  metadata:           Record<string, unknown>;
  requestId:          string | null;
  sessionId:          string | null;
  previousState:      Record<string, unknown> | null;
  newState:           Record<string, unknown> | null;
  outcome:            string;          // EventOutcome
  notes:              string | null;
  correctionFor:      string | null;   // eventId of the event this corrects
  createdAt:          string;
}

export interface CreateAuditEventInput {
  engine:        string;
  category:      string;
  eventName:     string;
  severity?:     string;
  correlationId: string;
  userId?:       string | null;
  actorId?:      string | null;
  actorType?:    string;
  walletId?:     string | null;
  walletAddress?:string | null;
  deviceId?:     string | null;
  ipAddress?:    string | null;
  country?:      string | null;
  platform?:     string;
  metadata?:     Record<string, unknown>;
  requestId?:    string | null;
  sessionId?:    string | null;
  previousState?:Record<string, unknown> | null;
  newState?:     Record<string, unknown> | null;
  outcome?:      string;
  notes?:        string | null;
  correctionFor?:string | null;
}

export class AuditEvent {
  private constructor(
    private readonly _eventId:       AuditEventId,
    private readonly _timestamp:     Timestamp,
    private readonly _engine:        EngineSourceVO,
    private readonly _category:      EventCategoryVO,
    private readonly _eventName:     string,
    private readonly _severity:      SeverityVO,
    private readonly _correlationId: CorrelationId,
    private readonly _userId:        string | null,
    private readonly _actorId:       string | null,
    private readonly _actorType:     ActorTypeVO,
    private readonly _walletId:      string | null,
    private readonly _walletAddress: string | null,
    private readonly _deviceId:      string | null,
    private readonly _ipAddress:     string | null,
    private readonly _country:       string | null,
    private readonly _platform:      PlatformVO,
    private readonly _metadata:      Record<string, unknown>,
    private readonly _requestId:     string | null,
    private readonly _sessionId:     string | null,
    private readonly _previousState: Record<string, unknown> | null,
    private readonly _newState:      Record<string, unknown> | null,
    private readonly _outcome:       EventOutcomeVO,
    private readonly _notes:         string | null,
    private readonly _correctionFor: string | null,
    private readonly _createdAt:     Timestamp,
  ) {}

  static create(input: CreateAuditEventInput): AuditEvent {
    const now = Timestamp.now();
    return new AuditEvent(
      AuditEventId.generate(),
      now,
      EngineSourceVO.create(input.engine),
      EventCategoryVO.create(input.category),
      input.eventName,
      input.severity ? SeverityVO.create(input.severity) : SeverityVO.default(),
      CorrelationId.create(input.correlationId),
      input.userId ?? null,
      input.actorId ?? null,
      input.actorType ? ActorTypeVO.create(input.actorType) : ActorTypeVO.create('SYSTEM'),
      input.walletId ?? null,
      input.walletAddress ?? null,
      input.deviceId ?? null,
      input.ipAddress ?? null,
      input.country ?? null,
      input.platform ? PlatformVO.create(input.platform) : PlatformVO.default(),
      input.metadata ?? {},
      input.requestId ?? null,
      input.sessionId ?? null,
      input.previousState ?? null,
      input.newState ?? null,
      input.outcome ? EventOutcomeVO.create(input.outcome) : EventOutcomeVO.default(),
      input.notes ?? null,
      input.correctionFor ?? null,
      now,
    );
  }

  static rehydrate(props: AuditEventProps): AuditEvent {
    return new AuditEvent(
      AuditEventId.create(props.eventId),
      Timestamp.fromISOString(props.timestamp),
      EngineSourceVO.create(props.engine),
      EventCategoryVO.create(props.category),
      props.eventName,
      SeverityVO.create(props.severity),
      CorrelationId.create(props.correlationId),
      props.userId,
      props.actorId,
      ActorTypeVO.create(props.actorType),
      props.walletId,
      props.walletAddress,
      props.deviceId,
      props.ipAddress,
      props.country,
      PlatformVO.create(props.platform),
      props.metadata,
      props.requestId,
      props.sessionId,
      props.previousState,
      props.newState,
      EventOutcomeVO.create(props.outcome),
      props.notes,
      props.correctionFor,
      Timestamp.fromISOString(props.createdAt),
    );
  }

  // ── Immutable getters ────────────────────────────────────────────
  get eventId():       string        { return this._eventId.value; }
  get timestamp():     string        { return this._timestamp.toISOString(); }
  get engine():        EngineSource  { return this._engine.value; }
  get category():      EventCategory { return this._category.value; }
  get eventName():     string        { return this._eventName; }
  get severity():      Severity      { return this._severity.value; }
  get correlationId(): string        { return this._correlationId.value; }
  get userId():        string | null { return this._userId; }
  get actorId():       string | null { return this._actorId; }
  get actorType():     ActorType     { return this._actorType.value; }
  get walletId():      string | null { return this._walletId; }
  get walletAddress(): string | null { return this._walletAddress; }
  get deviceId():      string | null { return this._deviceId; }
  get ipAddress():     string | null { return this._ipAddress; }
  get country():       string | null { return this._country; }
  get platform():      Platform      { return this._platform.value; }
  get metadata():      Record<string, unknown> { return this._metadata; }
  get requestId():     string | null { return this._requestId; }
  get sessionId():     string | null { return this._sessionId; }
  get previousState(): Record<string, unknown> | null { return this._previousState; }
  get newState():      Record<string, unknown> | null { return this._newState; }
  get outcome():       EventOutcome  { return this._outcome.value; }
  get notes():         string | null { return this._notes; }
  get correctionFor(): string | null { return this._correctionFor; }
  get createdAt():     string        { return this._createdAt.toISOString(); }

  get isHighRisk(): boolean { return this._severity.isAtLeast('HIGH'); }
  get isFailure():  boolean { return this._outcome.value === 'FAILURE'; }
  get isSecurity(): boolean { return this._category.value === 'SECURITY' || this._category.value === 'AUTHENTICATION'; }

  toProps(): AuditEventProps {
    return {
      eventId:       this.eventId,
      timestamp:     this.timestamp,
      engine:        this.engine,
      category:      this.category,
      eventName:     this.eventName,
      severity:      this.severity,
      correlationId: this.correlationId,
      userId:        this.userId,
      actorId:       this.actorId,
      actorType:     this.actorType,
      walletId:      this.walletId,
      walletAddress: this.walletAddress,
      deviceId:      this.deviceId,
      ipAddress:     this.ipAddress,
      country:       this.country,
      platform:      this.platform,
      metadata:      this.metadata,
      requestId:     this.requestId,
      sessionId:     this.sessionId,
      previousState: this.previousState,
      newState:      this.newState,
      outcome:       this.outcome,
      notes:         this.notes,
      correctionFor: this.correctionFor,
      createdAt:     this.createdAt,
    };
  }

  toPublicJSON(): Record<string, unknown> {
    return {
      eventId:       this.eventId,
      timestamp:     this.timestamp,
      engine:        this.engine,
      category:      this.category,
      eventName:     this.eventName,
      severity:      this.severity,
      correlationId: this.correlationId,
      userId:        this.userId,
      actorId:       this.actorId,
      actorType:     this.actorType,
      walletId:      this.walletId,
      walletAddress: this.walletAddress,
      deviceId:      this.deviceId,
      ipAddress:     this.ipAddress,
      country:       this.country,
      platform:      this.platform,
      metadata:      this.metadata,
      requestId:     this.requestId,
      sessionId:     this.sessionId,
      previousState: this.previousState,
      newState:      this.newState,
      outcome:       this.outcome,
      notes:         this.notes,
      correctionFor: this.correctionFor,
    };
  }
}
