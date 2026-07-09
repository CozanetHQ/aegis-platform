import type { SupabaseClient } from '@supabase/supabase-js';
import { NotificationPreference, type PreferenceMatrix } from '../../domain/entities/notification-preference.entity';
import type { PreferenceRepository } from '../../application/ports/preference-repository.port';

interface Row {
  aegis_id: string;
  matrix: PreferenceMatrix;
  updated_at: string;
}

export class SupabasePreferenceRepository implements PreferenceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByAegisId(aegisId: string): Promise<NotificationPreference | null> {
    const { data, error } = await this.db
      .from('notification_preferences')
      .select('*')
      .eq('aegis_id', aegisId)
      .maybeSingle();
    if (error) throw new Error(`SupabasePreferenceRepository.findByAegisId: ${error.message}`);
    if (!data) return null;
    const row = data as Row;
    return NotificationPreference.hydrate({ aegisId: row.aegis_id, matrix: row.matrix, updatedAt: row.updated_at });
  }

  async save(preference: NotificationPreference): Promise<void> {
    const props = preference.toProps();
    const { error } = await this.db
      .from('notification_preferences')
      .upsert(
        { aegis_id: props.aegisId, matrix: props.matrix, updated_at: props.updatedAt },
        { onConflict: 'aegis_id' }
      );
    if (error) throw new Error(`SupabasePreferenceRepository.save: ${error.message}`);
  }
}
