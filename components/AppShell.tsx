"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Projects" },
  { href: "/new", label: "New" },
  { href: "/settings", label: "Settings" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Scene<span className="text-gold">Forge</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                pathname.startsWith(item.href)
                  ? "bg-panel text-gold"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button onClick={signOut} className="rounded-lg px-3 py-2 text-sm text-white/40 hover:text-white">
            Sign out
          </button>
        </nav>
      </header>
      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}
