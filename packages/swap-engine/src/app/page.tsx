export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Aegis Swap Engine</h1>
      <p>Swap orchestration · PancakeSwap V2 on BSC · Phase 1 (quoting only)</p>
      <hr />
      <ul>
        <li><a href="/api/v1/health">/api/v1/health</a></li>
        <li><a href="/api/v1/version">/api/v1/version</a></li>
        <li><a href="/api/v1/metrics">/api/v1/metrics</a></li>
        <li><a href="/api/v1/openapi.json">/api/v1/openapi.json</a></li>
        <li>GET /api/v1/swap/tokens</li>
        <li>POST /api/v1/swap/quote</li>
      </ul>
    </div>
  );
}
