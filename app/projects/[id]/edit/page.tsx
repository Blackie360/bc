import { notFound } from "next/navigation";
import { updateProjectAction } from "@/app/projects/actions";
import { ProjectForm } from "@/components/workflow/project-form";
import { getProject } from "@/lib/projects";

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

  return (
    <ProjectForm
      action={updateProjectAction.bind(null, project.id)}
      project={project}
      title={`Edit ${project.id}`}
    />
  );
}
