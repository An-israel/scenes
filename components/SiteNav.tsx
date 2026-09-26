"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/ui";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#styles", label: "Styles" },
  { href: "/#output", label: "What you get" },
  { href: "/login", label: "Sign in" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="page flex h-[72px] items-center justify-between">
        <Wordmark />
        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="label text-forest hover:text-clay">
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="label rounded-md border border-forest px-5 py-3 text-forest transition-colors hover:bg-forest hover:text-paper"
          >
            Start a story
          </Link>
        </nav>
        <button
          onClick={() => setOpen((o) => !o)}
          className="label text-forest md:hidden"
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav className="page flex flex-col gap-5 border-t border-line py-6 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="label text-forest">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
