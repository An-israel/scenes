import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { GeminiError } from "@/lib/gemini";

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase, error: jsonError("Not signed in", 401) };
  return { user, supabase, error: null };
}

/** Fetch + decrypt the caller's Gemini key (service role read; column never leaves the server). */
export async function getUserGeminiKey(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("gemini_api_key_encrypted")
    .eq("id", userId)
    .single();
  if (!data?.gemini_api_key_encrypted) return null;
  return decryptSecret(data.gemini_api_key_encrypted);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(e: unknown) {
  if (e instanceof GeminiError) {
    // Pass 429 through so the client orchestrator can back off.
    return jsonError(e.message, e.status === 429 ? 429 : 502);
  }
  console.error(e);
  return jsonError(e instanceof Error ? e.message : "Internal error", 500);
}

export const NO_KEY_MESSAGE =
  "No Gemini API key on file. Add your free AI Studio key in Settings first.";
