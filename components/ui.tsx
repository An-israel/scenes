import Link from "next/link";

/** Thin drawn arrow used in text links — the only "icon" in the product. */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 10"
      width="18"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M1 5h15M12 1l4 4-4 4" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-mono text-[13px] font-medium uppercase tracking-[0.28em] text-forest">
      Scenes<span className="text-clay">.</span>
    </Link>
  );
}

/** Eyebrow label + large heading, optional link on the right (e.g. "ALL STYLES →"). */
export function SectionHead({
  eyebrow,
  title,
  link,
}: {
  eyebrow: string;
  title: React.ReactNode;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="label mb-5">{eyebrow}</p>
        <h2 className="display text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
      </div>
      {link && (
        <Link href={link.href} className="label inline-flex items-center gap-3 text-forest hover:text-clay">
          {link.label} <Arrow />
        </Link>
      )}
    </div>
  );
}

/** Short horizontal rule that sits above card titles. */
export function Tick({ className = "bg-forest" }: { className?: string }) {
  return <span aria-hidden="true" className={`mb-7 block h-px w-10 ${className}`} />;
}
