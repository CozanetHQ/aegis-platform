/**
 * POST /api/v1/identity/signup
 *
 * Public endpoint — creates a Supabase Auth user (auto-confirmed),
 * then creates the identity record. Fires a UserRegistered event to
 * the Notification Engine for welcome email delivery. Returns the
 * session token immediately (no email verification required).
 *
 * Body: { email, password, firstName, lastName, accountType? }
 *
 * BUGFIX 2026-07-04: identity creation errors were all treated as
 * "identity might already exist" and silently swallowed (just logged),
 * regardless of the actual cause — a real failure (DB unreachable, bad
 * accountType, etc.) for a genuinely NEW user looked identical to the
 * expected "already exists" case, and the caller got back a 201 with
 * aegisId: null instead of an error. Now checks for the specific
 * IDENTITY_EMAIL_EXISTS code before falling through to the existing-card
 * lookup; anything else is surfaced as a real error.
 *
 * BUGFIX 2026-07-04: UserRegistered event firing switched from an awaited
 * fetch (added latency to every signup) to @vercel/functions' waitUntil,
 * matching the fix applied to login/route.ts's security events.
 */
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { ok, err } from "@cozanethq/aegis-shared-sdk";
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";

async function fireUserRegisteredEvent(userId: string, aegisId: string, email: string, firstName: string, lastName: string): Promise<void> {
  try {
    const notifUrl = process.env.NOTIFICATION_ENGINE_URL;
    const notifKey = process.env.NOTIFICATION_ENGINE_API_KEY;
    if (!notifUrl || !notifKey) return;

    await fetch(`${notifUrl}/api/v1/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-API-Key": notifKey,
      },
      body: JSON.stringify({
        eventId: `signup-${userId}-${Date.now()}`,
        eventType: "UserRegistered",
        recipientAegisId: aegisId,
        payload: { email, firstName, lastName },
      }),
    });
  } catch (notifError) {
    console.error("Failed to fire UserRegistered event:", notifError);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return err(new Error("email and password required"));
    }

    // Step 1: Create the auth user with auto-confirm using service role
    const adminSupabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: adminData, error: adminError } = await adminSupabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirm — no email verification needed
      user_metadata: {
        firstName: body.firstName ?? "",
        lastName: body.lastName ?? "",
      },
    });

    if (adminError || !adminData.user) {
      // If user already exists, try to sign in instead
      if (adminError?.message?.includes("already") || adminError?.message?.includes("exists")) {
        // Fall through to sign-in below
      } else {
        return err(new Error(adminError?.message ?? "Signup failed"));
      }
    }

    // Step 2: Sign in with the anon key to get a real session token
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (signInError || !signInData.session) {
      return err(new Error(signInError?.message ?? "Login failed after signup"));
    }

    const accessToken = signInData.session.access_token;
    const userId = adminData?.user?.id ?? signInData.user.id;

    // Step 3: Create identity record (if not already created)
    let aegisId: string | null = null;
    try {
      const identity = await IdentityEngine.createIdentity({
        authProviderId: userId,
        email: body.email,
        accountType: body.accountType ?? "INDIVIDUAL",
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      });
      aegisId = identity.aegisId;
    } catch (identityError: any) {
      const isExpectedDuplicate = identityError instanceof AegisError && identityError.code === "IDENTITY_EMAIL_EXISTS";
      if (!isExpectedDuplicate) {
        // A real failure (DB error, rate limit, bad input) for what should
        // be a brand-new identity — don't paper over it as "already exists".
        console.error("Identity creation failed during signup (unexpected):", identityError);
        return err(identityError);
      }
      // Expected: user record exists from a previous partial signup attempt.
      try {
        const card = await IdentityEngine.getMyCard(userId);
        aegisId = card.aegisId;
      } catch {
        // No identity record — user will need to onboard
      }
    }

    // Step 4: Fire UserRegistered event to Notification Engine for welcome
    // email — scheduled via waitUntil so it reliably completes without
    // adding latency to the signup response.
    if (aegisId) {
      waitUntil(fireUserRegisteredEvent(userId, aegisId, body.email, body.firstName ?? "", body.lastName ?? ""));
    }

    // Step 5: Get full identity card for response
    let identityCard: any = null;
    try {
      identityCard = await IdentityEngine.getMyCard(userId);
    } catch {
      // No identity yet
    }

    return ok({
      accessToken,
      refreshToken: signInData.session.refresh_token,
      expiresIn: signInData.session.expires_in,
      user: {
        id: userId,
        email: body.email,
      },
      needsVerification: false,
      aegisId,
      firstName: body.firstName ?? identityCard?.profile?.fullName?.split(" ")[0] ?? "",
      lastName: body.lastName ?? identityCard?.profile?.fullName?.split(" ").slice(1).join(" ") ?? "",
      accountType: body.accountType ?? "INDIVIDUAL",
      wallets: identityCard?.wallets ?? [],
      profile: identityCard?.profile ?? null,
    }, 201);
  } catch (error) {
    return err(error);
  }
}
