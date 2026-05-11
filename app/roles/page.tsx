import { RoleRoutesIndex } from "@/components/workflow/role-routes";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const projects = await listProjects();
  return <RoleRoutesIndex projects={projects} />;
}
