import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ProjectFactory from "@/components/ProjectFactory";
import type { Project, Scene } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!project) notFound();

  const { data: scenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("project_id", params.id)
    .order("idx");

  return (
    <AppShell>
      <ProjectFactory
        initialProject={project as Project}
        initialScenes={(scenes ?? []) as Scene[]}
      />
    </AppShell>
  );
}
