import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell, { PageHead } from "@/components/AppShell";
import { Arrow } from "@/components/ui";
import { getStyle } from "@/lib/styles";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STATUS: Record<string, { label: string; className: string }> = {
  done: { label: "Ready", className: "bg-forest-tint text-forest" },
  error: { label: "Needs attention", className: "bg-clay-tint text-clay-dark" },
  draft: { label: "Draft", className: "bg-paper text-forest-soft" },
  splitting: { label: "Storyboarding", className: "bg-ochre-tint text-forest" },
  generating: { label: "In progress", className: "bg-ochre-tint text-forest" },
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (projects ?? []) as Project[];

  return (
    <AppShell>
      <PageHead eyebrow={`Projects — ${String(list.length).padStart(2, "0")}`} title="Your stories.">
        <Link href="/new" className="btn-primary">
          New story
        </Link>
      </PageHead>

      {list.length === 0 ? (
        <div className="rounded-xl border border-line bg-card px-8 py-20 text-center">
          <p className="label mb-5">Nothing here yet</p>
          <h2 className="display text-3xl sm:text-4xl">Start with a short story.</h2>
          <p className="lede mx-auto mt-4 max-w-md">A few sentences is enough — about 75 to 150 words makes a 30 to 60 second short.</p>
          <Link href="/new" className="btn-primary mt-10">
            Write your first story
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          {list.map((p, i) => {
            const st = STATUS[p.status] ?? STATUS.draft;
            return (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className={`group grid items-center gap-4 px-6 py-6 transition-colors hover:bg-paper sm:grid-cols-[3rem_1fr_auto_auto_auto] sm:px-8 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="font-mono text-xs text-forest-mute">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight group-hover:text-clay">{p.title}</h2>
                  <p className="mt-1 text-sm text-forest-mute">
                    {new Date(p.created_at).toLocaleDateString()} · {getStyle(p.style).label} ·{" "}
                    {p.aspect_ratio === "16:9" ? "16:9" : "9:16"}
                  </p>
                </div>
                <span className="font-mono text-sm text-forest-soft">{formatDuration(p.total_duration_ms)}</span>
                <span className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${st.className}`}>
                  {st.label}
                </span>
                <Arrow className="hidden text-forest-mute group-hover:text-clay sm:block" />
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
