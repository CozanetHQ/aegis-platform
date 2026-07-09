import { describe, it, expect } from 'vitest';
import { AuditEvent } from '../../src/domain/entities/audit-event.entity';

describe('AuditEvent Entity', () => {
  const validInput = {
    engine: 'IDENTITY',
    category: 'AUTHENTICATION',
    eventName: 'USER_LOGIN',
    correlationId: 'corr_test_123',
    userId: 'aegis_123',
    actorId: 'aegis_123',
    actorType: 'USER',
    ipAddress: '192.168.1.1',
    country: 'NG',
    platform: 'WEB',
  };

  it('should create an event with all fields', () => {
    const event = AuditEvent.create(validInput);
    expect(event.eventId).toMatch(/^aev_/);
    expect(event.engine).toBe('IDENTITY');
    expect(event.category).toBe('AUTHENTICATION');
    expect(event.eventName).toBe('USER_LOGIN');
    expect(event.severity).toBe('INFO');
    expect(event.correlationId).toBe('corr_test_123');
    expect(event.userId).toBe('aegis_123');
    expect(event.outcome).toBe('SUCCESS');
    expect(event.platform).toBe('WEB');
  });

  it('should default severity to INFO', () => {
    const event = AuditEvent.create({ ...validInput, severity: undefined });
    expect(event.severity).toBe('INFO');
  });

  it('should default outcome to SUCCESS', () => {
    const event = AuditEvent.create({ ...validInput, outcome: undefined });
    expect(event.outcome).toBe('SUCCESS');
  });

  it('should default actorType to SYSTEM', () => {
    const event = AuditEvent.create({ ...validInput, actorType: undefined });
    expect(event.actorType).toBe('SYSTEM');
  });

  it('should default platform to UNKNOWN', () => {
    const event = AuditEvent.create({ ...validInput, platform: undefined });
    expect(event.platform).toBe('UNKNOWN');
  });

  it('should handle null optional fields', () => {
    const event = AuditEvent.create({
      engine: 'TRANSFER',
      category: 'TRANSFER',
      eventName: 'TRANSFER_CREATED',
      correlationId: 'corr_abc',
    });
    expect(event.userId).toBeNull();
    expect(event.walletId).toBeNull();
    expect(event.ipAddress).toBeNull();
    expect(event.deviceId).toBeNull();
    expect(event.previousState).toBeNull();
    expect(event.newState).toBeNull();
  });

  it('should detect high risk events', () => {
    const high = AuditEvent.create({ ...validInput, severity: 'HIGH' });
    const critical = AuditEvent.create({ ...validInput, severity: 'CRITICAL' });
    const info = AuditEvent.create({ ...validInput, severity: 'INFO' });
    expect(high.isHighRisk).toBe(true);
    expect(critical.isHighRisk).toBe(true);
    expect(info.isHighRisk).toBe(false);
  });

  it('should detect failure events', () => {
    const failed = AuditEvent.create({ ...validInput, outcome: 'FAILURE' });
    const success = AuditEvent.create({ ...validInput, outcome: 'SUCCESS' });
    expect(failed.isFailure).toBe(true);
    expect(success.isFailure).toBe(false);
  });

  it('should detect security events', () => {
    const auth = AuditEvent.create({ ...validInput, category: 'AUTHENTICATION' });
    const security = AuditEvent.create({ ...validInput, category: 'SECURITY' });
    const transfer = AuditEvent.create({ ...validInput, category: 'TRANSFER' });
    expect(auth.isSecurity).toBe(true);
    expect(security.isSecurity).toBe(true);
    expect(transfer.isSecurity).toBe(false);
  });

  it('should rehydrate from props correctly', () => {
    const original = AuditEvent.create(validInput);
    const props = original.toProps();
    const rehydrated = AuditEvent.rehydrate(props);
    expect(rehydrated.eventId).toBe(original.eventId);
    expect(rehydrated.engine).toBe(original.engine);
    expect(rehydrated.eventName).toBe(original.eventName);
    expect(rehydrated.correlationId).toBe(original.correlationId);
  });

  it('should throw on invalid category', () => {
    expect(() => AuditEvent.create({ ...validInput, category: 'INVALID_CAT' })).toThrow();
  });

  it('should throw on invalid severity', () => {
    expect(() => AuditEvent.create({ ...validInput, severity: 'EXTREME' })).toThrow();
  });

  it('should throw on invalid engine', () => {
    expect(() => AuditEvent.create({ ...validInput, engine: 'NONEXISTENT' })).toThrow();
  });

  it('should support correctionFor for append-only corrections', () => {
    const original = AuditEvent.create(validInput);
    const correction = AuditEvent.create({
      ...validInput,
      eventName: 'CORRECTION',
      correctionFor: original.eventId,
      notes: 'Correcting previous event',
    });
    expect(correction.correctionFor).toBe(original.eventId);
    expect(correction.notes).toBe('Correcting previous event');
  });

  it('should produce public JSON without createdAt', () => {
    const event = AuditEvent.create(validInput);
    const json = event.toPublicJSON();
    expect(json.eventId).toBe(event.eventId);
    expect(json).not.toHaveProperty('createdAt');
  });
});
