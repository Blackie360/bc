import { notFound, redirect } from "next/navigation";
import { RoleRoutePage } from "@/components/workflow/role-routes";
import { getCurrentUserEmail } from "@/lib/current-user";
import { listProjectsForPage } from "@/lib/projects";
import { getAssignedRoleForEmail } from "@/lib/role-assignments";
import { getRoleRoute, roleRoutes, roleSlug } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return roleRoutes.map((route) => ({
    role: route.slug,
  }));
}

export default async function RolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: slug } = await params;
  const route = getRoleRoute(slug);

  if (!route) {
    notFound();
  }

  const currentEmail = await getCurrentUserEmail();
  const assignedRole = await getAssignedRoleForEmail(currentEmail ?? undefined);

  if (assignedRole && assignedRole !== route.role) {
    redirect(`/roles/${roleSlug(assignedRole)}`);
  }

  const { projects, dataUnavailable } = await listProjectsForPage();

  return <RoleRoutePage role={route.role} projects={projects} dataUnavailable={dataUnavailable} />;
}
