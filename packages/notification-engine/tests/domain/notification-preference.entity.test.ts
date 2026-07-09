import { describe, it, expect } from 'vitest';
import { NotificationPreference } from '../../src/domain/entities/notification-preference.entity';

describe('NotificationPreference entity', () => {
  it('creates sane defaults — SECURITY on, MARKETING off, everywhere', () => {
    const pref = NotificationPreference.createDefault('aegis_123');
    expect(pref.isEnabled('SECURITY', 'IN_APP')).toBe(true);
    expect(pref.isEnabled('SECURITY', 'EMAIL')).toBe(true);
    expect(pref.isEnabled('MARKETING', 'IN_APP')).toBe(false);
    expect(pref.isEnabled('MARKETING', 'EMAIL')).toBe(false);
  });

  it('allows disabling a single channel for a suppressible category', () => {
    const pref = NotificationPreference.createDefault('aegis_123');
    pref.set('TRANSACTIONS', 'EMAIL', false);
    expect(pref.isEnabled('TRANSACTIONS', 'EMAIL')).toBe(false);
    expect(pref.isEnabled('TRANSACTIONS', 'IN_APP')).toBe(true);
  });

  it('refuses to fully silence SECURITY across every channel', () => {
    const pref = NotificationPreference.createDefault('aegis_123');
    // Turn off every channel the defaults have on for SECURITY.
    expect(() => {
      pref.set('SECURITY', 'IN_APP', false);
      pref.set('SECURITY', 'EMAIL', false);
      pref.set('SECURITY', 'PUSH', false);
    }).toThrow();
  });

  it('allows disabling all channels for a suppressible category', () => {
    const pref = NotificationPreference.createDefault('aegis_123');
    expect(() => {
      pref.set('MARKETING', 'IN_APP', false);
      pref.set('MARKETING', 'EMAIL', false);
    }).not.toThrow();
  });

  it('applyPartialUpdate updates multiple category/channel pairs at once', () => {
    const pref = NotificationPreference.createDefault('aegis_123');
    pref.applyPartialUpdate({
      TRANSACTIONS: { EMAIL: false },
      NEWS: { IN_APP: false, EMAIL: true },
    });
    expect(pref.isEnabled('TRANSACTIONS', 'EMAIL')).toBe(false);
    expect(pref.isEnabled('NEWS', 'IN_APP')).toBe(false);
    expect(pref.isEnabled('NEWS', 'EMAIL')).toBe(true);
  });
});
