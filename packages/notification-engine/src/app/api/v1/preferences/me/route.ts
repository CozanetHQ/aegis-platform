import { requireAuth, ok, err } from '@cozanethq/aegis-shared-sdk';
import { NotificationEngine } from '@/engine';
import { CHANNELS, NOTIFICATION_CATEGORIES } from '@/domain/enums/notification-enums';
import { z } from 'zod';

const updateSchema = z.record(
  z.enum(NOTIFICATION_CATEGORIES as unknown as [string, ...string[]]),
  z.record(z.enum(CHANNELS as unknown as [string, ...string[]]), z.boolean())
);

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) return err(new Error('No Aegis ID on this identity'));
    const pref = await NotificationEngine().getPreferences.execute(auth.aegisId);
    return ok(pref.toProps());
  } catch (e) {
    return err(e);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) return err(new Error('No Aegis ID on this identity'));
    const body = await request.json();
    const updates = updateSchema.parse(body);
    const pref = await NotificationEngine().updatePreferences.execute({
      aegisId: auth.aegisId,
      updates: updates as never,
    });
    return ok(pref.toProps());
  } catch (e) {
    return err(e);
  }
}
