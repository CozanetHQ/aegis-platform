/**
 * POST /api/v1/identity/refresh
 *
 * Public endpoint — exchanges a refresh token for a new access token.
 * Called by the UI when the access token expires (typically after 1 hour).
 *
 * Body: { refreshToken: string }
 * Returns: { accessToken, refreshToken, expiresIn }
 */
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { ok, err } from "@cozanethq/aegis-shared-sdk";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.refreshToken) {
      return err(new Error("refreshToken required"));
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refreshToken,
    });

    if (error || !data.session) {
      return err(new Error(error?.message ?? "Token refresh failed"));
    }

    return ok({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    });
  } catch (error) {
    return err(error);
  }
}
