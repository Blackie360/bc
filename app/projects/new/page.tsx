import { createProjectAction } from "@/app/projects/actions";
import { ProjectForm } from "@/components/workflow/project-form";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return <ProjectForm action={createProjectAction} title="Create Project" />;
}
