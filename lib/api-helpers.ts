import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GeminiError } from "@/lib/gemini";
import { isAllowed } from "@/lib/access";

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase, error: jsonError("Not signed in", 401) };
  return { user, supabase, error: null };
}

/** Signed in AND on the allowlist — required for anything that spends API credit. */
export async function requireMember() {
  const result = await requireUser();
  if (result.error || !result.user) return result;
  if (!isAllowed(result.user.email)) {
    return {
      ...result,
      error: jsonError("Your account doesn't have generation access yet.", 403),
    };
  }
  return result;
}

/** The owner's server-side Gemini key. Throws a clear error if it isn't configured. */
export function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ConfigError("GEMINI_API_KEY is not set on the server.");
  return key;
}

export class ConfigError extends Error {}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(e: unknown) {
  if (e instanceof GeminiError) {
    // Pass 429 through so the client orchestrator can back off.
    return jsonError(e.message, e.status === 429 ? 429 : 502);
  }
  if (e instanceof ConfigError) return jsonError(e.message, 500);
  console.error(e);
  return jsonError(e instanceof Error ? e.message : "Internal error", 500);
}
