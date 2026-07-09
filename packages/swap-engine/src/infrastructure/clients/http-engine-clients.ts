/**
 * http-engine-clients.ts — Swap Engine · concrete HTTP adapters for the
 * outbound engine-client ports. Every cross-engine call has a timeout +
 * AbortController per the certification checklist's "Events & Integration" rule.
 */
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import type {
  WalletVaultClient, WalletInfo,
  TreasuryClient, FeeQuote, GasSponsorshipResult,
  AuditClient, NotificationClient, PortfolioClient,
} from "../../application/ports/engine-clients.port";

const DEFAULT_TIMEOUT_MS = 10_000;

async function callJson(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = json?.error?.code ?? "ENGINE_CALL_FAILED";
      const message = json?.error?.message ?? `Request to ${url} failed with status ${res.status}`;
      throw new AegisError(code, message, res.status >= 400 && res.status < 600 ? res.status : 502);
    }
    return json;
  } catch (e) {
    if (e instanceof AegisError) throw e;
    throw new AegisError("ENGINE_CALL_FAILED", `Request to ${url} failed: ${e instanceof Error ? e.message : "unknown error"}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

export class HttpWalletVaultClient implements WalletVaultClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async getWallets(aegisId: string): Promise<WalletInfo[]> {
    const url = `${this.baseUrl}/api/v1/wallet-vault/wallets?aegisId=${encodeURIComponent(aegisId)}`;
    const json = await callJson(url, { headers: { "x-vault-api-key": this.apiKey } });
    return json.wallets ?? [];
  }

  async signTransaction(walletId: string, aegisId: string, unsignedTx: Record<string, unknown>): Promise<string> {
    const url = `${this.baseUrl}/api/v1/wallet-vault/sign`;
    const json = await callJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vault-api-key": this.apiKey },
      body: JSON.stringify({ walletId, aegisId, unsignedTx }),
    });
    return json.signedTx;
  }
}

export class HttpTreasuryClient implements TreasuryClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async calculateFee(aegisId: string, swapAmountWei: string, correlationId: string): Promise<FeeQuote> {
    const url = `${this.baseUrl}/api/v1/treasury/calculate-fee`;
    const json = await callJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-treasury-api-key": this.apiKey },
      body: JSON.stringify({ aegisId, swapAmountWei, correlationId }),
    });
    return json;
  }

  async sponsorGasIfNeeded(aegisId: string, userWalletAddress: string, correlationId: string): Promise<GasSponsorshipResult> {
    const url = `${this.baseUrl}/api/v1/treasury/sponsor-gas`;
    const json = await callJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-treasury-api-key": this.apiKey },
      body: JSON.stringify({ aegisId, userWalletAddress, correlationId }),
    });
    return json;
  }

  async recordTransaction(input: { aegisId: string; correlationId: string; chain: string; txHash: string; feeAmountWei: string; metadata?: Record<string, unknown> }): Promise<void> {
    const url = `${this.baseUrl}/api/v1/treasury/record-transaction`;
    await callJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-treasury-api-key": this.apiKey },
      body: JSON.stringify(input),
    });
  }
}

export class HttpAuditClient implements AuditClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async emitEvent(input: { engine: string; category: string; eventName: string; severity: string; outcome: string; actorId: string; actorType: string; correlationId: string; details: Record<string, unknown> }): Promise<void> {
    const url = `${this.baseUrl}/api/v1/events`;
    // Audit failures must never break the user-facing swap flow — log and swallow.
    try {
      await callJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-audit-api-key": this.apiKey },
        body: JSON.stringify(input),
      });
    } catch (e) {
      console.error("[swap-engine] audit event emission failed (non-fatal)", e);
    }
  }
}

export class HttpNotificationClient implements NotificationClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async notify(input: { eventId: string; eventType: string; recipientAegisId: string; payload: Record<string, unknown> }): Promise<void> {
    const url = `${this.baseUrl}/api/v1/notifications`;
    // Notification failures must never break the user-facing swap flow — log and swallow.
    try {
      await callJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-engine-api-key": this.apiKey },
        body: JSON.stringify(input),
      });
    } catch (e) {
      console.error("[swap-engine] notification emission failed (non-fatal)", e);
    }
  }
}

export class HttpPortfolioClient implements PortfolioClient {
  constructor(private baseUrl: string) {}

  async refresh(aegisId: string, payload: Record<string, unknown>): Promise<void> {
    const url = `${this.baseUrl}/api/v1/snapshot`;
    try {
      await callJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": aegisId },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("[swap-engine] portfolio refresh failed (non-fatal)", e);
    }
  }
}
