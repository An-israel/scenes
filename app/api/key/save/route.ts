import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { validateKey } from "@/lib/gemini";
import { validateOpenAIKey } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const { apiKey, provider } = await req.json();
    const which = provider === "openai" ? "openai" : "gemini";
    if (typeof apiKey !== "string" || apiKey.trim().length < 20) {
      return jsonError("That doesn't look like an API key.", 400);
    }
    const key = apiKey.trim();

    if (which === "openai") await validateOpenAIKey(key);
    else await validateKey(key);

    const column = which === "openai" ? "openai_api_key_encrypted" : "gemini_api_key_encrypted";
    const admin = createAdminClient();
    const { error: dbError } = await admin
      .from("profiles")
      .upsert({ id: user.id, email: user.email, [column]: encryptSecret(key) });
    if (dbError) {
      if (/openai_api_key_encrypted/.test(dbError.message)) {
        return jsonError(
          "Database missing the OpenAI key column — run migration 0003_openai_key.sql in Supabase first.",
          500
        );
      }
      return jsonError(dbError.message, 500);
    }

    return NextResponse.json({ ok: true, provider: which, masked: maskKey(key) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const { provider } = await req.json();
    const column = provider === "openai" ? "openai_api_key_encrypted" : "gemini_api_key_encrypted";
    const admin = createAdminClient();
    const { error: dbError } = await admin
      .from("profiles")
      .update({ [column]: null })
      .eq("id", user.id);
    if (dbError) return jsonError(dbError.message, 500);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function GET() {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();

    return NextResponse.json({
      gemini: !!data?.gemini_api_key_encrypted,
      openai: !!data?.openai_api_key_encrypted,
      // legacy field kept for older clients
      hasKey: !!data?.gemini_api_key_encrypted,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

function maskKey(key: string): string {
  return key.slice(0, 4) + "…" + key.slice(-4);
}
