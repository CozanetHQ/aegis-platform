/**
 * GET  /api/v2/identity/me   — full identity card (owner only)
 * PATCH /api/v2/identity/me  — update mutable profile fields
 * DELETE /api/v2/identity/me — user self-close account
 */
export const dynamic = "force-dynamic";

import { z }             from "zod";
import { requireAuth }   from "@cozanethq/aegis-shared-sdk";
import { validateBody }  from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";
import { ok, err }        from "@cozanethq/aegis-shared-sdk";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const card = await IdentityEngine.getMyCard(auth.userId);
    return ok(card);
  } catch (e) {
    return err(e);
  }
}

const UpdateSchema = z.object({
  fullName:     z.string().min(1).max(100).nullable().optional(),
  username:     z.string().regex(/^[a-zA-Z0-9_]{3,30}$/).nullable().optional(),
  countryCode:  z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  languageCode: z.string().max(10).optional(),
  avatarUrl:    z.string().url().startsWith("https://").nullable().optional(),
  preferences:  z.record(z.unknown()).optional(),
}).strict(); // reject unknown fields — prevents immutable field tampering

export async function PATCH(request: Request) {
  try {
    const auth    = await requireAuth(request);
    const body    = await validateBody(request, UpdateSchema);
    const profile = await IdentityEngine.updateProfile(auth.userId, body);
    return ok(profile);
  } catch (e) {
    return err(e);
  }
}

const CloseSchema = z.object({
  reason: z.string().min(1).max(500).default("User-requested account closure"),
});

/** DELETE /api/v2/identity/me — user self-closes their account */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    const body = await validateBody(request, CloseSchema);
    await IdentityEngine.closeAccount(auth.userId, body.reason);
    return ok({ closed: true });
  } catch (e) {
    return err(e);
  }
}
