/**
 * POST /api/v1/identity/login
 *
 * Public endpoint — authenticates against Supabase Auth and returns
 * the session tokens + full identity info. If email is not confirmed,
 * auto-confirms it (we don't require email verification for login).
 * Fires SecurityLogin event on success, SecurityLoginFailed on failure.
 *
 * Body: { email: string, password: string }
 * Returns: { accessToken, refreshToken, expiresIn, user, aegisId, firstName, lastName, accountType, wallets, profile }
 *
 * BUGFIX 2026-07-04: fireSecurityEvent was called without `await` and
 * without keeping the serverless invocation alive — on Vercel's Node.js
 * runtime the function can freeze the moment the response is sent, so the
 * "non-blocking" background fetch to the Notification Engine frequently
 * never actually completes. Now scheduled via @vercel/functions' waitUntil,
 * which is the supported way to do post-response work on Vercel.
 *
 * BUGFIX 2026-07-04: SecurityLoginFailed previously used the raw email as
 * recipientAegisId when no identity was found (aegisId is always null on a
 * failed login — there's no session to derive it from). The Notification
 * Engine keys everything (preferences, the in-app feed) by aegisId, so that
 * alert was being filed under a fake "user" that doesn't exist and would
 * never reach the real account's notification feed. Now resolves the email
 * to a real aegisId via IdentityEngine.findAegisIdByEmail first.
 */
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { ok, err } from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";

/** Fire a security event to the Notification Engine (best-effort). Always
 * awaited by the caller via waitUntil(), never left to race the response. */
async function fireSecurityEvent(
  eventType: "SecurityLogin" | "SecurityLoginFailed",
  aegisId: string | null,
  email: string,
  request: Request
): Promise<void> {
  try {
    const notifUrl = process.env.NOTIFICATION_ENGINE_URL;
    const notifKey = process.env.NOTIFICATION_ENGINE_API_KEY;
    if (!notifUrl || !notifKey || !aegisId) return; // no known aegisId — nothing to notify

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const timestamp = new Date().toISOString();

    await fetch(`${notifUrl}/api/v1/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-API-Key": notifKey,
      },
      body: JSON.stringify({
        eventId: `${eventType}-${aegisId}-${Date.now()}`,
        eventType,
        recipientAegisId: aegisId,
        payload: {
          email,
          ipAddress,
          deviceName: userAgent,
          timestamp,
        },
      }),
    });
  } catch (e) {
    console.error(`Failed to fire ${eventType} event:`, e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return err(new Error("email and password required"));
    }

    // Create a Supabase client with the anon key
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Try to authenticate
    let { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    // If email not confirmed, auto-confirm via admin API and retry
    if (error?.message === "Email not confirmed") {
      try {
        const adminSupabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Look up the user by email
        const { data: userList, error: listError } = await adminSupabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        const user = userList?.users?.find(
          (u) => u.email === body.email
        );

        if (user) {
          // Auto-confirm the email
          await adminSupabase.auth.admin.updateUserById(user.id, {
            email_confirm: true,
          });

          // Retry login
          const retry = await supabase.auth.signInWithPassword({
            email: body.email,
            password: body.password,
          });
          data = retry.data;
          error = retry.error;
        }
      } catch (confirmError) {
        console.error("Auto-confirm failed:", confirmError);
      }
    }

    if (error || !data.session) {
      // Fire SecurityLoginFailed — resolve the real aegisId first so the
      // alert lands on the actual account, not a fake email-keyed record.
      waitUntil(
        IdentityEngine.findAegisIdByEmail(body.email)
          .catch(() => null)
          .then((aegisId) => fireSecurityEvent("SecurityLoginFailed", aegisId, body.email, request))
      );

      return err(new Error(error?.message ?? "Invalid credentials"));
    }

    const accessToken = data.session.access_token;
    const refreshToken = data.session.refresh_token;
    const expiresIn = data.session.expires_in;
    const user = data.user;

    // Fetch full identity profile (including wallets)
    let identityCard: any = null;
    try {
      identityCard = await IdentityEngine.getMyCard(user.id);
    } catch {
      // No identity record yet — user can onboard
    }

    const aegisId = identityCard?.aegisId ?? null;

    // Fire SecurityLogin event — scheduled via waitUntil so it reliably
    // completes even after the response has been sent, without adding
    // latency to the login response itself.
    waitUntil(fireSecurityEvent("SecurityLogin", aegisId, body.email, request));

    return ok({
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
      },
      aegisId,
      firstName: identityCard?.profile?.fullName?.split(" ")[0] ?? user.user_metadata?.firstName ?? "",
      lastName: identityCard?.profile?.fullName?.split(" ").slice(1).join(" ") ?? user.user_metadata?.lastName ?? "",
      accountType: identityCard?.accountType ?? "INDIVIDUAL",
      wallets: identityCard?.wallets ?? [],
      profile: identityCard?.profile ?? null,
    });
  } catch (error) {
    return err(error);
  }
}
