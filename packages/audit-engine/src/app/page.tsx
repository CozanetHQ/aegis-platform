export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Aegis Audit Engine</h1>
      <p>The permanent memory of the AEGIS ecosystem.</p>
      <p>Every important action performed by every engine is recorded here.</p>
      <hr />
      <h2>Endpoints</h2>
      <ul>
        <li><code>GET  /api/v1/health</code> — Liveness check</li>
        <li><code>GET  /api/v1/version</code> — Build info</li>
        <li><code>GET  /api/v1/metrics</code> — Prometheus metrics</li>
        <li><code>GET  /api/v1/openapi.json</code> — OpenAPI spec</li>
        <li><code>POST /api/v1/events</code> — Create audit event</li>
        <li><code>GET  /api/v1/events</code> — Search audit events</li>
        <li><code>GET  /api/v1/events/:id</code> — Get single event</li>
        <li><code>GET  /api/v1/timeline</code> — Timeline (filter by user/correlation/wallet/session)</li>
        <li><code>POST /api/v1/investigations</code> — Start investigation (admin)</li>
        <li><code>GET  /api/v1/investigations</code> — List investigations</li>
        <li><code>GET  /api/v1/investigations/:id</code> — Get investigation details</li>
        <li><code>POST /api/v1/exports</code> — Export audit data</li>
        <li><code>GET  /api/v1/exports</code> — List exports</li>
        <li><code>GET  /api/v1/statistics</code> — Platform statistics</li>
        <li><code>GET  /api/v1/statistics/engines</code> — Engine activity</li>
        <li><code>GET  /api/v1/recent</code> — Recent events</li>
        <li><code>GET  /api/v1/history/users/:userId</code> — User history</li>
        <li><code>GET  /api/v1/history/wallets/:walletId</code> — Wallet history</li>
        <li><code>GET  /api/v1/history/correlations/:correlationId</code> — Correlation lookup</li>
        <li><code>GET  /api/v1/history/admins/:adminId</code> — Admin history</li>
      </ul>
    </div>
  );
}
