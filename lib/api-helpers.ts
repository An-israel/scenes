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

export interface UserKeys {
  gemini: string | null;
  openai: string | null;
}

/** Fetch + decrypt the caller's provider keys (service role read; columns never leave the server). */
export async function getUserKeys(userId: string): Promise<UserKeys> {
  const admin = createAdminClient();
  // Select * so a missing openai column (migration 0003 not run) doesn't error the query.
  const { data } = await admin.from("profiles").select("*").eq("id", userId).single();
  return {
    gemini: data?.gemini_api_key_encrypted ? decryptSecret(data.gemini_api_key_encrypted) : null,
    openai: data?.openai_api_key_encrypted ? decryptSecret(data.openai_api_key_encrypted) : null,
  };
}

export async function getUserGeminiKey(userId: string): Promise<string | null> {
  return (await getUserKeys(userId)).gemini;
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
  "No API key on file. Add your OpenAI key (or free Gemini key) in Settings first.";
