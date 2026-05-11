import Link from "next/link";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
              New Project
            </Link>
          </Button>
        }
      />
      <div className="space-y-5 px-6 pb-8 pt-6">
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Total Projects
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {projects.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                In Progress
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {projects.filter((project) => project.state !== "Project Closure & Reporting").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Delayed
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">{delayedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Open Queues
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {new Set(projects.map((project) => project.roleQueue)).size}
              </p>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Search Projects</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]" />
              <input
                readOnly
                value=""
                placeholder="Search by project name"
                className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white pl-10 pr-3 text-sm placeholder:text-[color:var(--color-muted)]"
              />
            </label>
            <input
              readOnly
              value=""
              placeholder="Stage filter"
              className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 text-sm placeholder:text-[color:var(--color-muted)]"
            />
            <input
              readOnly
              value=""
              placeholder="Status filter"
              className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 text-sm placeholder:text-[color:var(--color-muted)]"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Project Register</CardTitle>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-surface-soft)] px-1.5 text-xs font-bold text-[color:var(--color-primary)]">
              {projects.length}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1180px] overflow-hidden rounded-lg border border-[color:var(--color-border)] text-left text-sm">
                <thead className="bg-[color:var(--color-surface-soft)] text-[11px] uppercase text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Project</th>
                    <th className="px-4 py-3 font-bold">Created</th>
                    <th className="px-4 py-3 font-bold">Stage</th>
                    <th className="px-4 py-3 font-bold">Role Queue</th>
                    <th className="px-4 py-3 font-bold">Decision</th>
                    <th className="px-4 py-3 font-bold">Budget</th>
                    <th className="px-4 py-3 font-bold">Due</th>
                    <th className="px-4 py-3 font-bold">Last Updated</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-[color:var(--color-surface-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-bold">{project.customer}</p>
                        <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">{project.id}</p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.createdAt}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.state}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{project.roleQueue}</td>
                      <td className="px-4 py-4">
                        <Badge variant="info">{project.decision}</Badge>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        {new Intl.NumberFormat("en-US").format(project.approvedBudget)}
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
