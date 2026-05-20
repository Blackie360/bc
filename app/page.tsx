import { RoleRoutesIndex } from "@/components/workflow/role-routes";
import { listProjectsForPage } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { projects, dataUnavailable } = await listProjectsForPage();
  return <RoleRoutesIndex projects={projects} dataUnavailable={dataUnavailable} />;
}
