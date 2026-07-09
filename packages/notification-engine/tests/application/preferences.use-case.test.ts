import { describe, it, expect, beforeEach } from 'vitest';
import { GetPreferencesUseCase, UpdatePreferencesUseCase } from '../../src/application/use-cases/preferences.use-case';
import { InMemoryPreferenceRepository } from '../fakes';

describe('Preferences use-cases', () => {
  let repo: InMemoryPreferenceRepository;

  beforeEach(() => {
    repo = new InMemoryPreferenceRepository();
  });

  it('GetPreferences creates and persists defaults for a first-time user', async () => {
    const useCase = new GetPreferencesUseCase(repo);
    const pref = await useCase.execute('aegis_new');
    expect(pref.isEnabled('SECURITY', 'IN_APP')).toBe(true);
    expect(await repo.findByAegisId('aegis_new')).not.toBeNull();
  });

  it('GetPreferences returns the same preference on a second call, not fresh defaults', async () => {
    const useCase = new GetPreferencesUseCase(repo);
    const first = await useCase.execute('aegis_1');
    first.set('MARKETING', 'IN_APP', true);
    await repo.save(first);

    const second = await useCase.execute('aegis_1');
    expect(second.isEnabled('MARKETING', 'IN_APP')).toBe(true);
  });

  it('UpdatePreferences applies a partial update and persists it', async () => {
    const updateUseCase = new UpdatePreferencesUseCase(repo);
    const updated = await updateUseCase.execute({
      aegisId: 'aegis_1',
      updates: { NEWS: { EMAIL: true }, TRANSACTIONS: { EMAIL: false } },
    });
    expect(updated.isEnabled('NEWS', 'EMAIL')).toBe(true);
    expect(updated.isEnabled('TRANSACTIONS', 'EMAIL')).toBe(false);

    const persisted = await repo.findByAegisId('aegis_1');
    expect(persisted!.isEnabled('NEWS', 'EMAIL')).toBe(true);
  });

  it('UpdatePreferences rejects fully silencing SECURITY', async () => {
    const updateUseCase = new UpdatePreferencesUseCase(repo);
    await expect(
      updateUseCase.execute({
        aegisId: 'aegis_1',
        updates: { SECURITY: { IN_APP: false, EMAIL: false, PUSH: false, SMS: false, WEBHOOK: false } },
      })
    ).rejects.toThrow();
  });
});
