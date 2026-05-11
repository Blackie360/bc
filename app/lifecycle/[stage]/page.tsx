import { notFound } from "next/navigation";
import { LifecycleStagePage } from "@/components/workflow/lifecycle-routes";
import { listProjects } from "@/lib/projects";
import { getLifecycleStage, lifecycleStages } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return lifecycleStages.map((stage) => ({
    stage: stage.slug,
  }));
}

export default async function StagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  const lifecycleStage = getLifecycleStage(stage);

  if (!lifecycleStage) {
    notFound();
  }

  const projects = await listProjects();

  return <LifecycleStagePage stageSlug={stage} projects={projects} />;
}
