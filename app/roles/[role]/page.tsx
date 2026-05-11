import { notFound } from "next/navigation";
import { RoleRoutePage } from "@/components/workflow/role-routes";
import { listProjects } from "@/lib/projects";
import { getRoleRoute, roleRoutes } from "@/lib/workflow";

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

  const projects = await listProjects();

  return <RoleRoutePage role={route.role} projects={projects} />;
}
