import { requireAuth, ok, err } from '@cozanethq/aegis-shared-sdk';
import { NotificationEngine } from '@/engine';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) return err(new Error('No Aegis ID on this identity'));
    const { id } = await params;
    await NotificationEngine().markRead.execute({ notificationId: id, requesterAegisId: auth.aegisId });
    return ok({ id, read: true });
  } catch (e) {
    return err(e);
  }
}
