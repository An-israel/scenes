import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STATUS_STYLES: Record<string, string> = {
  done: "text-gold",
  error: "text-red-400",
  draft: "text-white/40",
  splitting: "text-white/60",
  generating: "text-white/60",
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, total_duration_ms, created_at, zip_path")
    .order("created_at", { ascending: false });

  const list = (projects ?? []) as Pick<
    Project,
    "id" | "title" | "status" | "total_duration_ms" | "created_at" | "zip_path"
  >[];

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your projects</h1>
        <Link href="/new" className="btn-gold">
          + New project
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <p className="text-lg text-white/60">No projects yet.</p>
          <p className="mt-2 max-w-sm text-sm text-white/40">
            Paste a script, pick a voice, and SceneForge will forge your narration and scene
            images. First, add your free Gemini key in{" "}
            <Link href="/settings" className="text-gold underline">
              Settings
            </Link>
            .
          </p>
          <Link href="/new" className="btn-gold mt-6">
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((p) => (
            <Link key={p.id} href={`/project/${p.id}`} className="card transition hover:border-gold/50">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{p.title}</h2>
                <span className={`text-xs uppercase tracking-wide ${STATUS_STYLES[p.status] ?? "text-white/40"}`}>
                  {p.status}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-sm text-white/40">
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
                <span>{formatDuration(p.total_duration_ms)}</span>
                {p.zip_path && <span className="text-gold">ZIP ready</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
