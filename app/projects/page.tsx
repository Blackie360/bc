import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleChip } from "@/components/workflow/role-chip";
import { canEditProject, listProjectsForPage } from "@/lib/projects";
import { getRoleRoute, roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; role?: string; saved?: string; submitted?: string }>;
}) {
  const query = await searchParams;
  const roleRoute = query.role ? getRoleRoute(query.role) : undefined;
  const { projects, dataUnavailable } = await listProjectsForPage();
  const visibleProjects = [...(roleRoute
    ? projects.filter((project) => project.roleQueue === roleRoute.role)
    : projects)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const badgeLabel = roleRoute?.role ?? "Admin";
  const dashboardHref = roleRoute ? roleRoute.href : "/roles";
  const projectsHref = roleRoute ? `/projects?role=${roleRoute.slug}` : "/projects";
  const canCreateProject = roleRoute?.role !== "Fiber Planning Team";

  return (
    <AdminShell
      code="PRJ"
      title="Project Register"
      badgeLabel={badgeLabel}
      primaryActive="projects"
      workflowLinks={roleRoutes.map((route) => ({ href: route.href, label: route.role }))}
      showWorkflowLinks={false}
      dashboardHref={dashboardHref}
      projectsHref={projectsHref}
    >
      <ShellHeading
        title="Projects"
        subtitle="Create, read, update, and delete workflow projects."
        action={
          canCreateProject ? (
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Project
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="space-y-4 px-6 pb-8 pt-6">
        {dataUnavailable ? (
          <div className="rounded-md border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-surface)] px-4 py-3 text-sm text-[color:var(--color-warning-text)]">
            Project data is unavailable because the app could not connect to MySQL. Check the database values in .env and reload.
          </div>
        ) : null}
        {query.submitted === "bc" ? (
          <div className="rounded-md border border-[color:var(--color-success-border)] bg-[color:var(--color-success-surface)] px-4 py-3 text-sm text-[color:var(--color-success-text)]">
            BC submitted and routed according to the approval rules. The saved project is listed below.
          </div>
        ) : null}
        {query.submitted === "pboq" ? (
          <div className="rounded-md border border-[color:var(--color-success-border)] bg-[color:var(--color-success-surface)] px-4 py-3 text-sm text-[color:var(--color-success-text)]">
            PBOQ request submitted to Fiber Planning for processing. Your Account Manager queue is shown below.
          </div>
        ) : null}
        {query.submitted === "fiber" ? (
          <div className="rounded-md border border-[color:var(--color-success-border)] bg-[color:var(--color-success-surface)] px-4 py-3 text-sm text-[color:var(--color-success-text)]">
            Fiber Planning completed the PBOQ pack. The project is back with Account Manager for BC preparation.
          </div>
        ) : null}
        {query.draft === "saved" ? (
          <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-4 py-3 text-sm text-[color:var(--color-muted-strong)]">
            Draft saved. The project draft is listed below.
          </div>
        ) : null}
        {query.saved === "project" ? (
          <div className="rounded-md border border-[color:var(--color-success-border)] bg-[color:var(--color-success-surface)] px-4 py-3 text-sm text-[color:var(--color-success-text)]">
            Project saved. The latest version is listed below.
          </div>
        ) : null}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">{roleRoute ? "Projects" : "All projects"}</CardTitle>
            <span className="text-xs text-[color:var(--color-muted)]">{visibleProjects.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1060px] text-left text-sm">
                <thead className="border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Role Queue</th>
                    <th className="px-4 py-3 font-medium">Decision</th>
                    <th className="px-4 py-3 font-medium">Budget / Revenue</th>
                    <th className="px-4 py-3 font-medium">Last Updated</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {visibleProjects.map((project) => (
                    // Fiber Planning projects are updated via the Fiber Planning form, not generic edit.
                    <tr key={project.id} className="hover:bg-[color:var(--color-primary-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-medium">{project.customer}</p>
                        <p className="mt-1 text-xs text-[color:var(--color-muted-strong)]">
                          {project.siteName} · {project.requiredService}
                        </p>
                        <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">{project.id}</p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{formatDateTime(project.createdAt)}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.state}</td>
                      <td className="px-4 py-4">
                        {project.roleQueue ? (
                          <RoleChip role={project.roleQueue} />
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="info">{project.decision}</Badge>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        <p>{new Intl.NumberFormat("en-US").format(project.approvedBudget)}</p>
                        <p className="mt-1 text-xs">
                          MRR {new Intl.NumberFormat("en-US").format(project.totalMrr)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{formatDateTime(project.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/projects/${project.id}`}>
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View
                            </Link>
                          </Button>
                          {canEditProject(project) ? (
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/projects/${project.id}/edit`}>
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                Edit
                              </Link>
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="warning">
                            <Link href={`/projects/${project.id}/delete`}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleProjects.length === 0 ? (
                    <tr>
                      <td className="px-4 py-5 text-sm text-[color:var(--color-muted)]" colSpan={8}>
                        {roleRoute
                          ? "No projects are assigned to this role in the register."
                          : "No projects yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
