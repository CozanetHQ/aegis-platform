import { requireAuth, ok, err } from '@cozanethq/aegis-shared-sdk';
import { NotificationEngine } from '@/engine';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) return err(new Error('No Aegis ID on this identity'));
    const count = await NotificationEngine().getUnreadCount.execute(auth.aegisId);
    return ok({ count });
  } catch (e) {
    return err(e);
  }
}
