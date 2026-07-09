import { describe, it, expect } from 'vitest';
import { AuditInvestigation } from '../../src/domain/entities/audit-investigation.entity';

describe('AuditInvestigation Entity', () => {
  it('should create an investigation', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'aegis_admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'aegis_user_123',
      title: 'Suspicious activity check',
    });
    expect(inv.investigationId).toMatch(/^inv_/);
    expect(inv.status).toBe('OPEN');
    expect(inv.eventIds).toHaveLength(0);
    expect(inv.anomalies).toHaveLength(0);
    expect(inv.closedAt).toBeNull();
  });

  it('should start investigation (OPEN -> IN_PROGRESS)', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'admin_1',
      pivotType: 'CORRELATION_ID',
      pivotValue: 'corr_123',
    });
    inv.start();
    expect(inv.status).toBe('IN_PROGRESS');
  });

  it('should add events without duplicates', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'admin_1',
      pivotType: 'WALLET_ADDRESS',
      pivotValue: '0xabc123',
    });
    inv.addEvent('aev_1');
    inv.addEvent('aev_2');
    inv.addEvent('aev_1'); // duplicate
    expect(inv.eventIds).toHaveLength(2);
  });

  it('should add anomalies', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'admin_1',
      pivotType: 'DEVICE_ID',
      pivotValue: 'dev_123',
    });
    inv.addAnomaly({ type: 'MULTIPLE_IP_ADDRESSES', severity: 'MEDIUM' });
    expect(inv.anomalies).toHaveLength(1);
  });

  it('should complete investigation', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'user_123',
    });
    inv.start();
    inv.complete();
    expect(inv.status).toBe('COMPLETED');
    expect(inv.closedAt).not.toBeNull();
  });

  it('should archive investigation', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'user_123',
    });
    inv.archive();
    expect(inv.status).toBe('ARCHIVED');
  });

  it('should rehydrate from props', () => {
    const inv = AuditInvestigation.create({
      initiatedBy: 'admin_1',
      pivotType: 'EMAIL',
      pivotValue: 'test@test.com',
    });
    inv.addEvent('aev_1');
    inv.start();
    const props = inv.toProps();
    const rehydrated = AuditInvestigation.rehydrate(props);
    expect(rehydrated.investigationId).toBe(inv.investigationId);
    expect(rehydrated.status).toBe(inv.status);
    expect(rehydrated.eventIds).toEqual(inv.eventIds);
  });
});
