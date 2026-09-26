"use client";

import AppShell, { PageHead } from "@/components/AppShell";
import { useMember } from "@/components/useMember";

export default function AccountPage() {
  const me = useMember();

  return (
    <AppShell>
      <PageHead eyebrow="Account" title="Your account." />

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="grid gap-2 px-8 py-7 sm:grid-cols-[14rem_1fr]">
          <span className="label">Email</span>
          <span>{me?.email ?? "…"}</span>
        </div>
        <div className="grid gap-2 border-t border-line px-8 py-7 sm:grid-cols-[14rem_1fr]">
          <span className="label">Access</span>
          <span>
            {me == null ? (
              "…"
            ) : me.allowed ? (
              <span className="rounded bg-forest-tint px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em]">
                Full access
              </span>
            ) : (
              <span className="rounded bg-ochre-tint px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em]">
                Waiting list
              </span>
            )}
          </span>
        </div>
        <div className="grid gap-2 border-t border-line px-8 py-7 sm:grid-cols-[14rem_1fr]">
          <span className="label">Plan</span>
          <span className="text-forest-soft">Paid plans are coming soon. Early accounts are first in line.</span>
        </div>
      </div>
    </AppShell>
  );
}
