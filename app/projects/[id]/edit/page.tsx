import { notFound } from "next/navigation";
import { updateProjectAction } from "@/app/projects/actions";
import { ProjectForm } from "@/components/workflow/project-form";
import { canEditProject, getProject } from "@/lib/projects";
import { roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }
  if (!canEditProject(project)) {
    notFound();
  }

  const roleRoute = roleRoutes.find((route) => route.role === project.roleQueue);
  const dashboardHref = roleRoute?.href ?? "/roles";
  const projectsHref = roleRoute ? `/projects?role=${roleRoute.slug}` : "/projects";

  return (
    <ProjectForm
      action={updateProjectAction.bind(null, project.id)}
      badgeLabel={project.roleQueue}
      dashboardHref={dashboardHref}
      project={project}
      projectsHref={projectsHref}
      showWorkflowLinks={false}
      title={`Edit ${project.id}`}
    />
  );
}
