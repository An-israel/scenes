"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-forest p-12 text-paper lg:flex">
        <span className="font-mono text-[13px] font-medium uppercase tracking-[0.28em]">
          Scenes<span className="text-ochre">.</span>
        </span>
        <div>
          <p className="label mb-6 text-paper/60">Story shorts</p>
          <p className="display max-w-md text-5xl text-paper">
            Same characters. <span className="text-ochre">Every shot.</span>
          </p>
        </div>
        <p className="label text-paper/50">30–60 second stories, narrated</p>
      </aside>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-14 lg:hidden">
            <Wordmark />
          </div>
          <p className="label mb-4">{mode === "signin" ? "Welcome back" : "New account"}</p>
          <h1 className="display mb-10 text-4xl">{mode === "signin" ? "Sign in" : "Create your account"}</h1>

          <button onClick={handleGoogle} disabled={busy} className="btn-outline w-full">
            Continue with Google
          </button>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-line" />
            <span className="label">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleEmail} className="space-y-5">
            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@studio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {error && <p className="mt-5 text-sm text-clay-dark">{error}</p>}
          {message && <p className="mt-5 text-sm text-forest">{message}</p>}

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-8 text-sm text-forest-soft underline-offset-4 hover:text-clay hover:underline"
          >
            {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
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
