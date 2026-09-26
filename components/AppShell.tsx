"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Projects" },
  { href: "/new", label: "New story" },
  { href: "/clips", label: "Clip finder" },
  { href: "/settings", label: "Account" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const linkClass = (href: string) =>
    `label transition-colors ${pathname.startsWith(href) ? "text-clay" : "text-forest hover:text-clay"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="page flex h-[72px] items-center justify-between">
          <Wordmark href="/dashboard" />
          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
            <button onClick={signOut} className="label text-forest-mute hover:text-forest">
              Sign out
            </button>
          </nav>
          <button onClick={() => setOpen((o) => !o)} className="label text-forest md:hidden" aria-expanded={open}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <nav className="page flex flex-col gap-5 border-t border-line py-6 md:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
            <button onClick={signOut} className="label text-left text-forest-mute">
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main className="page flex-1 pb-24 pt-12 sm:pt-16">{children}</main>
    </div>
  );
}

/** Page heading used across app screens: mono eyebrow + display title. */
export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-10">
      <div>
        <p className="label mb-4">{eyebrow}</p>
        <h1 className="display text-4xl sm:text-6xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
