"use client";

import { useEffect, useState } from "react";

type Theme = "color" | "mono";
const KEY = "scenes-theme";

/** Runs before first paint (inlined in <head>) so the saved theme never flashes. */
export const themeBootScript = `try{if(localStorage.getItem("${KEY}")==="mono")document.documentElement.dataset.theme="mono"}catch(e){}`;

/** Two-option text toggle: Color / B&W. */
export default function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("color");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "mono" ? "mono" : "color");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    if (next === "mono") document.documentElement.dataset.theme = "mono";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  const option = (value: Theme, label: string) => (
    <button
      type="button"
      onClick={() => choose(value)}
      aria-pressed={theme === value}
      className={`px-2.5 py-1.5 transition-colors ${
        theme === value ? "bg-forest text-paper" : "text-forest-soft hover:text-forest"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={`inline-flex overflow-hidden rounded-md border border-line font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${className}`}
    >
      {option("color", "Color")}
      {option("mono", "B&W")}
    </div>
  );
}
