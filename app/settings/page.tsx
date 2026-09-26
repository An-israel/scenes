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
          <span className="label">Plan</span>
          <span className="text-forest-soft">Free while Scenes is new. Paid plans are coming.</span>
        </div>
      </div>
    </AppShell>
  );
}
