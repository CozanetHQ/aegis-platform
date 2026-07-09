export const dynamic = "force-dynamic";

/**
 * GET /api/v1/version — build/version metadata (Rule 4). No auth required.
 */
import pkg from "../../../../../package.json";

export async function GET() {
  return Response.json({
    engine:      "wallet-vault-engine",
    version:     pkg.version,
    commitSha:   process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    commitRef:   process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
    deployedAt:  process.env.VERCEL_DEPLOYMENT_ID ? new Date().toISOString() : "unknown",
    nodeVersion: process.version,
  });
}
