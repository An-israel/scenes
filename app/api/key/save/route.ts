import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { validateKey } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const { apiKey } = await req.json();
    if (typeof apiKey !== "string" || apiKey.trim().length < 20) {
      return jsonError("That doesn't look like a Gemini API key.", 400);
    }
    const key = apiKey.trim();

    await validateKey(key);

    const admin = createAdminClient();
    const { error: dbError } = await admin
      .from("profiles")
      .upsert({ id: user.id, email: user.email, gemini_api_key_encrypted: encryptSecret(key) });
    if (dbError) return jsonError(dbError.message, 500);

    return NextResponse.json({ ok: true, masked: maskKey(key) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function GET() {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("gemini_api_key_encrypted")
      .eq("id", user.id)
      .single();

    return NextResponse.json({ hasKey: !!data?.gemini_api_key_encrypted });
  } catch (e) {
    return handleRouteError(e);
  }
}

function maskKey(key: string): string {
  return key.slice(0, 4) + "…" + key.slice(-4);
}
