import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteProjectAction } from "@/app/projects/actions";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject } from "@/lib/projects";
import { roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function DeleteProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const roleRoute = roleRoutes.find((route) => route.role === project.roleQueue);
  const dashboardHref = roleRoute?.href ?? "/roles";
  const projectsHref = roleRoute ? `/projects?role=${roleRoute.slug}` : "/projects";

  return (
    <AdminShell
      code="PRJ"
      title="Delete Project"
      subtitle={project.id}
      badgeLabel={project.roleQueue}
      primaryActive="projects"
      workflowLinks={[]}
      showWorkflowLinks={false}
      dashboardHref={dashboardHref}
      projectsHref={projectsHref}
    >
      <ShellHeading
        title="Delete Project"
        subtitle="This action permanently removes all linked workflow records."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={projectsHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Projects
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-4 px-6 pb-8 pt-6">
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle>Delete Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="rounded-md border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-surface)] p-4">
              <p className="font-medium">{project.customer}</p>
              <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">{project.id}</p>
              <p className="mt-3 text-sm text-[color:var(--color-warning-text)]">
                This permanently deletes the project, business case versions,
                assignments, actuals, documents, approvals, and audit rows linked to it.
              </p>
            </div>

            <form action={deleteProjectAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={project.id} />
              <Button type="submit" variant="warning">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Project
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/projects/${project.id}`}>Cancel</Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
