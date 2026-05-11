import { LifecycleIndex } from "@/components/workflow/lifecycle-routes";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function LifecyclePage() {
  const projects = await listProjects();
  return <LifecycleIndex projects={projects} />;
}
