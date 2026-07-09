/**
 * identity-contact-resolver.ts — Notification Engine · Infrastructure Layer
 *
 * Resolves recipient contact information through the Identity Engine instead
 * of depending on producing engines to include email addresses in their
 * event payloads. This is the primary email resolver — it calls the Identity
 * Engine's internal lookup endpoint (GET /api/v1/identity/internal/:aegis_id)
 * which returns the identity's email, state, and wallet mappings.
 *
 * Backward compatibility: if the event payload already contains an email
 * (e.g. Identity Engine's outbox events carry it), the resolver uses that
 * without making a network call — the Identity Engine lookup is a fallback,
 * not a replacement for fast-path payload resolution.
 *
 * Auth: X-Identity-API-Key (bilateral engine trust — same key the Identity
 * Engine validates on its internal route).
 */
import type { RecipientAddressResolver } from '../../application/ports/channel-provider.port';
import type { Notification } from '../../domain/entities/notification.entity';
import type { Channel } from '../../domain/enums/notification-enums';

export class IdentityContactResolver implements RecipientAddressResolver {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout = 10_000;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl ?? process.env.IDENTITY_ENGINE_URL ?? '';
    this.apiKey  = apiKey  ?? process.env.IDENTITY_ENGINE_API_KEY ?? '';
  }

  async resolve(notification: Notification, channel: Channel): Promise<string | null> {
    if (channel !== 'EMAIL') return null;

    // ── Fast path: payload already carries the email ──────────────────
    // Backward-compatible — events from Identity Engine's outbox already
    // include email in the payload. No network call needed.
    const data = notification.toProps().data;
    if (typeof data.email === 'string' && data.email.includes('@')) {
      return data.email;
    }

    // ── Fallback: look up contact info via Identity Engine ────────────
    if (!this.baseUrl || !this.apiKey) {
      // Can't resolve — fail honestly. The notification's delivery will
      // record a failure with a clear message, never silently skip.
      return null;
    }

    const aegisId = notification.recipientAegisId;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/identity/internal/${aegisId}`,
        {
          headers: { 'X-Identity-API-Key': this.apiKey },
          signal: ctrl.signal,
        }
      );

      if (!res.ok) return null;

      const json = (await res.json()) as { data?: { email?: string; found?: boolean } };
      const email = json.data?.email;

      if (typeof email === 'string' && email.includes('@')) {
        return email;
      }

      return null;
    } catch {
      // Network error, timeout, or parse failure — return null so the
      // delivery use-case records a failure (not a silent skip).
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
