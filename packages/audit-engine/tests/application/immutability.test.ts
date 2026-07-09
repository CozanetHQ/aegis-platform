import { describe, it, expect } from 'vitest';
import { AuditEvent } from '../../src/domain/entities/audit-event.entity';

describe('Audit Immutability', () => {
  it('should not expose any update method on AuditEvent', () => {
    const event = AuditEvent.create({
      engine: 'IDENTITY',
      category: 'AUTHENTICATION',
      eventName: 'LOGIN',
      correlationId: 'corr_1',
    });
    // Verify no mutating methods exist
    expect(typeof (event as any).update).toBe('undefined');
    expect(typeof (event as any).delete).toBe('undefined');
    expect(typeof (event as any).setSeverity).toBe('undefined');
    expect(typeof (event as any).setOutcome).toBe('undefined');
  });

  it('should produce identical toProps on rehydrate', () => {
    const event = AuditEvent.create({
      engine: 'TRANSFER',
      category: 'TRANSFER',
      eventName: 'TRANSFER_EXECUTED',
      correlationId: 'corr_immutable',
      severity: 'HIGH',
      outcome: 'SUCCESS',
      userId: 'u1',
      metadata: { txHash: '0xabc' },
    });
    const props1 = event.toProps();
    const rehydrated = AuditEvent.rehydrate(props1);
    const props2 = rehydrated.toProps();
    expect(props1).toEqual(props2);
  });

  it('should create corrections as new events, not modify originals', () => {
    const original = AuditEvent.create({
      engine: 'IDENTITY',
      category: 'AUTHENTICATION',
      eventName: 'LOGIN',
      correlationId: 'corr_correction',
      outcome: 'SUCCESS',
    });
    const originalId = original.eventId;
    const originalOutcome = original.outcome;

    // Create a correction event
    const correction = AuditEvent.create({
      engine: 'IDENTITY',
      category: 'AUTHENTICATION',
      eventName: 'CORRECTION',
      correlationId: 'corr_correction',
      outcome: 'FAILURE',
      correctionFor: originalId,
      notes: 'Actually failed',
    });

    // Original is unchanged
    expect(original.eventId).toBe(originalId);
    expect(original.outcome).toBe(originalOutcome);
    // Correction references the original
    expect(correction.correctionFor).toBe(originalId);
    expect(correction.outcome).toBe('FAILURE');
  });
});
