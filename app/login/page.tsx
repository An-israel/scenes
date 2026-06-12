"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.push(next);
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-center text-xl font-bold">
        Scene<span className="text-gold">Forge</span>
      </Link>

      <button onClick={handleGoogle} disabled={busy} className="btn-ghost w-full py-3">
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-white/30">
        <div className="h-px flex-1 bg-edge" /> or <div className="h-px flex-1 bg-edge" />
      </div>

      <form onSubmit={handleEmail} className="space-y-4">
        <input
          className="input"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button type="submit" disabled={busy} className="btn-gold w-full">
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {message && <p className="mt-4 text-sm text-gold">{message}</p>}

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 text-sm text-white/50 hover:text-white"
      >
        {mode === "signin" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
