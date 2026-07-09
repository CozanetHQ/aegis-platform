import type { NotificationPreference } from '../../domain/entities/notification-preference.entity';

export interface PreferenceRepository {
  findByAegisId(aegisId: string): Promise<NotificationPreference | null>;
  save(preference: NotificationPreference): Promise<void>;
}
