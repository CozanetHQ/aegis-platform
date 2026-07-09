export const dynamic = "force-dynamic";

import pkg from "../../../../../package.json";

export async function GET() {
  return Response.json({
    engine:      "audit-engine",
    version:     pkg.version,
    commitSha:   process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    commitRef:   process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
    deployedAt:  new Date().toISOString(),
    nodeVersion: process.version,
  });
}
