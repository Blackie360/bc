import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listProjects } from "@/lib/projects";
import { lifecycleStages, roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();
  const delayedCount = projects.filter((project) => project.variance > 10).length;

  return (
    <AdminShell
      code="PRJ"
      title="Project Register"
      subtitle="CRUD and queue visibility"
      badgeLabel="Admin"
      primaryActive="projects"
      workflowLinks={[
        ...roleRoutes.map((route) => ({ href: route.href, label: route.role })),
        ...lifecycleStages.slice(0, 5).map((stage) => ({
          href: stage.href,
          label: `${stage.index + 1}. ${stage.state}`,
        })),
      ]}
    >
      <ShellHeading
        title="Projects"
        subtitle="Create, read, update, and delete workflow projects."
        action={
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New BC
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 px-6 pb-8 pt-6">
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                Total Projects
              </p>
              <p className="mt-1 text-2xl font-semibold text-[color:var(--color-primary)]">
                {projects.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                In Progress
              </p>
              <p className="mt-1 text-2xl font-semibold text-[color:var(--color-primary)]">
                {projects.filter((project) => project.state !== "Project Closure & Reporting").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                Delayed
              </p>
              <p className="mt-1 text-2xl font-semibold text-[color:var(--color-primary)]">{delayedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                Open Queues
              </p>
              <p className="mt-1 text-2xl font-semibold text-[color:var(--color-primary)]">
                {new Set(projects.map((project) => project.roleQueue)).size}
              </p>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Project Register</CardTitle>
            <span className="text-xs text-[color:var(--color-muted)]">
              {projects.length}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Role Queue</th>
                    <th className="px-4 py-3 font-medium">Decision</th>
                    <th className="px-4 py-3 font-medium">Budget / Revenue</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Last Updated</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-[color:var(--color-surface-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-medium">{project.customer}</p>
                        <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">{project.id}</p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.createdAt}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.state}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.roleQueue}</td>
                      <td className="px-4 py-4">
                        <Badge variant="info">{project.decision}</Badge>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        <p>{new Intl.NumberFormat("en-US").format(project.approvedBudget)}</p>
                        <p className="mt-1 text-xs">
                          MRR {new Intl.NumberFormat("en-US").format(project.totalMrr)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.due}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.updatedAt}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/projects/${project.id}`}>
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/projects/${project.id}/edit`}>
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Link>
                          </Button>
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
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
