/**
 * notification-client.ts — AEGIS Identity Engine · Infrastructure Layer
 *
 * Calls the Notification Engine directly (service-to-service), the same
 * bilateral-secret pattern already used for Wallet Vault
 * (see wallet-vault-client.ts: WALLET_VAULT_URL / WALLET_VAULT_API_KEY).
 *
 * Deliberately NOT routed through the Gateway's connect-by-code registry —
 * that registry's AGS-XXXX codes are for UI-to-engine traffic. Engine-to-
 * engine calls use a plain, descriptive env pair per engine instead, so
 * it's obvious from the name alone which engine you're calling.
 *
 * Uses the ingest endpoint (POST /api/v1/notifications) synchronously — that
 * endpoint attempts delivery inline before responding (see
 * ProcessEventUseCase), so we get a real, immediate delivered/failed result
 * instead of guessing.
 */

export interface OtpEmailResult {
  delivered: boolean;
  error?: string;
}

export interface NotificationPort {
  sendOtpEmail(params: { aegisId: string; code: string; eventId: string }): Promise<OtpEmailResult>;
}

interface DeliveryResultShape {
  channel: string;
  delivered: boolean;
  error?: string;
}

export class NotificationClient implements NotificationPort {
  private readonly baseUrl = process.env.NOTIFICATION_ENGINE_URL ?? "";
  private readonly apiKey  = process.env.NOTIFICATION_ENGINE_API_KEY ?? "";

  get isConfigured(): boolean {
    return this.baseUrl.length > 0 && this.apiKey.length > 0;
  }

  async sendOtpEmail(params: { aegisId: string; code: string; eventId: string }): Promise<OtpEmailResult> {
    if (!this.isConfigured) {
      return { delivered: false, error: "NOTIFICATION_ENGINE_URL / NOTIFICATION_ENGINE_API_KEY not configured" };
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Engine-Api-Key": this.apiKey,
        },
        body: JSON.stringify({
          eventId: params.eventId,
          eventType: "EmailOtpRequested",
          recipientAegisId: params.aegisId,
          payload: { code: params.code },
        }),
      });
    } catch (err) {
      return { delivered: false, error: err instanceof Error ? err.message : String(err) };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { delivered: false, error: `Notification Engine responded ${res.status}: ${text.slice(0, 300)}` };
    }

    const json = (await res.json().catch(() => ({}))) as {
      data?: { deliveryResults?: DeliveryResultShape[] };
    };
    const emailResult = json.data?.deliveryResults?.find((d) => d.channel === "EMAIL");

    if (!emailResult) {
      // Notification Engine accepted the event but reported no EMAIL delivery
      // attempt at all (e.g. preference skip) — treat as failure since an
      // OTP that silently never sends strands the user with no path forward.
      return { delivered: false, error: "Notification Engine did not attempt EMAIL delivery" };
    }

    return emailResult.delivered ? { delivered: true } : { delivered: false, error: emailResult.error };
  }
}
