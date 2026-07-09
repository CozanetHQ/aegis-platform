import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '../../src/application/template-resolver';
import { EVENT_TYPES } from '../../src/domain/enums/notification-enums';

describe('resolveTemplate', () => {
  it('resolves every known event type without throwing', () => {
    for (const eventType of EVENT_TYPES) {
      const rendered = resolveTemplate(eventType, {});
      expect(rendered.title.length).toBeGreaterThan(0);
      expect(rendered.category).toBeDefined();
      expect(rendered.priority).toBeDefined();
    }
  });

  it('marks security events as HIGH or CRITICAL priority', () => {
    expect(resolveTemplate('SecurityLogin', {}).priority).toBe('HIGH');
    expect(resolveTemplate('SecurityLoginFailed', {}).priority).toBe('CRITICAL');
  });

  it('interpolates payload fields into the body', () => {
    const rendered = resolveTemplate('TransferCompleted', { transferRef: 'TRF-123' });
    expect(rendered.body).toContain('TRF-123');
  });

  it('falls back gracefully when payload fields are missing', () => {
    const rendered = resolveTemplate('TransferCompleted', {});
    expect(rendered.body.length).toBeGreaterThan(0);
  });
});
