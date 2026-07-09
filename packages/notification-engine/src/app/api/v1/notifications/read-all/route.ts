import { requireAuth, ok, err } from '@cozanethq/aegis-shared-sdk';
import { NotificationEngine } from '@/engine';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) return err(new Error('No Aegis ID on this identity'));
    const result = await NotificationEngine().markAllRead.execute(auth.aegisId);
    return ok(result);
  } catch (e) {
    return err(e);
  }
}
