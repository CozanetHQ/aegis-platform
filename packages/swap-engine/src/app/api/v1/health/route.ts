export const dynamic = "force-dynamic";

/**
 * This engine has no database (phase 1: read-only quoting, no persisted
 * state). Its critical dependency is the BSC RPC — so that's what health
 * checks instead of a DB ping.
 */
async function checkRpc(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://bsc-dataseed.binance.org/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, error: `RPC HTTP ${res.status}` };
    const json = await res.json();
    return { ok: !!json.result, error: json.error?.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const rpc = await checkRpc();
  const healthy = rpc.ok;

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      engine: "swap-engine",
      checks: { bscRpc: rpc },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
