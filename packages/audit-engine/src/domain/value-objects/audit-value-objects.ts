// ── Audit Engine · Domain Value Objects ──────────────────────────────

import {
  EVENT_CATEGORIES, SEVERITIES, ACTOR_TYPES, EVENT_OUTCOMES,
  ENGINE_SOURCES, PLATFORMS,
  type EventCategory, type Severity, type ActorType,
  type EventOutcome, type EngineSource, type Platform,
} from '../enums/audit-enums';

export class AuditEventId {
  private constructor(public readonly value: string) {}
  static create(value: string): AuditEventId {
    if (!value || value.trim().length === 0) throw new Error('AuditEventId cannot be empty');
    return new AuditEventId(value);
  }
  static generate(): AuditEventId {
    return new AuditEventId(`aev_${crypto.randomUUID()}`);
  }
  equals(other: AuditEventId): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}

export class CorrelationId {
  private constructor(public readonly value: string) {}
  static create(value: string): CorrelationId {
    if (!value || value.trim().length === 0) throw new Error('CorrelationId cannot be empty');
    return new CorrelationId(value);
  }
  static generate(): CorrelationId {
    return new CorrelationId(`corr_${crypto.randomUUID()}`);
  }
  equals(other: CorrelationId): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}

export class EventCategoryVO {
  private constructor(public readonly value: EventCategory) {}
  static create(value: string): EventCategoryVO {
    if (!EVENT_CATEGORIES.includes(value as EventCategory))
      throw new Error(`Invalid event category: ${value}`);
    return new EventCategoryVO(value as EventCategory);
  }
  equals(other: EventCategoryVO): boolean { return this.value === other.value; }
}

export class SeverityVO {
  private constructor(public readonly value: Severity) {}
  static create(value: string): SeverityVO {
    if (!SEVERITIES.includes(value as Severity))
      throw new Error(`Invalid severity: ${value}`);
    return new SeverityVO(value as Severity);
  }
  static default(): SeverityVO { return new SeverityVO('INFO'); }

  isAtLeast(min: Severity): boolean {
    const order: Record<Severity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return order[this.value] >= order[min];
  }
  equals(other: SeverityVO): boolean { return this.value === other.value; }
}

export class ActorTypeVO {
  private constructor(public readonly value: ActorType) {}
  static create(value: string): ActorTypeVO {
    if (!ACTOR_TYPES.includes(value as ActorType))
      throw new Error(`Invalid actor type: ${value}`);
    return new ActorTypeVO(value as ActorType);
  }
  equals(other: ActorTypeVO): boolean { return this.value === other.value; }
}

export class EventOutcomeVO {
  private constructor(public readonly value: EventOutcome) {}
  static create(value: string): EventOutcomeVO {
    if (!EVENT_OUTCOMES.includes(value as EventOutcome))
      throw new Error(`Invalid event outcome: ${value}`);
    return new EventOutcomeVO(value as EventOutcome);
  }
  static default(): EventOutcomeVO { return new EventOutcomeVO('SUCCESS'); }
  equals(other: EventOutcomeVO): boolean { return this.value === other.value; }
}

export class EngineSourceVO {
  private constructor(public readonly value: EngineSource) {}
  static create(value: string): EngineSourceVO {
    if (!ENGINE_SOURCES.includes(value as EngineSource))
      throw new Error(`Invalid engine source: ${value}`);
    return new EngineSourceVO(value as EngineSource);
  }
  equals(other: EngineSourceVO): boolean { return this.value === other.value; }
}

export class PlatformVO {
  private constructor(public readonly value: Platform) {}
  static create(value: string): PlatformVO {
    if (!PLATFORMS.includes(value as Platform))
      throw new Error(`Invalid platform: ${value}`);
    return new PlatformVO(value as Platform);
  }
  static default(): PlatformVO { return new PlatformVO('UNKNOWN'); }
  equals(other: PlatformVO): boolean { return this.value === other.value; }
}

export class Timestamp {
  private constructor(public readonly value: Date) {}
  static now(): Timestamp { return new Timestamp(new Date()); }
  static fromISOString(iso: string): Timestamp { return new Timestamp(new Date(iso)); }
  toISOString(): string { return this.value.toISOString(); }
  equals(other: Timestamp): boolean { return this.value.getTime() === other.value.getTime(); }
}
