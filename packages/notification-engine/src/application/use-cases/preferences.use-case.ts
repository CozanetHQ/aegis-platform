import { NotificationPreference } from '../../domain/entities/notification-preference.entity';
import type { PreferenceRepository } from '../ports/preference-repository.port';
import type { Channel, NotificationCategory } from '../../domain/enums/notification-enums';

export class GetPreferencesUseCase {
  constructor(private readonly preferences: PreferenceRepository) {}

  async execute(aegisId: string): Promise<NotificationPreference> {
    const existing = await this.preferences.findByAegisId(aegisId);
    if (existing) return existing;
    const created = NotificationPreference.createDefault(aegisId);
    await this.preferences.save(created);
    return created;
  }
}

export class UpdatePreferencesUseCase {
  constructor(private readonly preferences: PreferenceRepository) {}

  async execute(input: {
    aegisId: string;
    updates: Partial<Record<NotificationCategory, Partial<Record<Channel, boolean>>>>;
  }): Promise<NotificationPreference> {
    let pref = await this.preferences.findByAegisId(input.aegisId);
    if (!pref) pref = NotificationPreference.createDefault(input.aegisId);
    pref.applyPartialUpdate(input.updates);
    await this.preferences.save(pref);
    return pref;
  }
}
