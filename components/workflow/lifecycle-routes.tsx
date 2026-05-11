import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Plus,
  Search,
} from "lucide-react";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectRecord } from "@/lib/projects";
import {
  getLifecycleStagesForRole,
  lifecycleStages,
  roleRoutes,
} from "@/lib/workflow";

export function LifecycleIndex({ projects }: { projects: ProjectRecord[] }) {
  return (
    <AdminShell
      code="LC"
      title="Lifecycle Console"
      subtitle="Project stage governance"
      badgeLabel="Admin"
      primaryActive="lifecycle"
      workflowTitle="Stages"
      workflowLinks={lifecycleStages.map((stage) => ({
        href: stage.href,
        label: `${stage.index + 1}. ${stage.state}`,
      }))}
    >
      <ShellHeading
        title="Admin - Project Lifecycle"
        subtitle="Admin view: all stages, owners, routing, and project context."
      />
      <div className="space-y-5 px-6 pb-8 pt-6">
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Lifecycle Stages
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {lifecycleStages.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Active Projects
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">{projects.length}</p>
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
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Completed
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {
                  projects.filter(
                    (project) =>
                      project.state === lifecycleStages[lifecycleStages.length - 1]?.state,
                  ).length
                }
              </p>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Lifecycle Stages</CardTitle>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-surface-soft)] px-1.5 text-xs font-bold text-[color:var(--color-primary)]">
              {lifecycleStages.length}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-[color:var(--color-surface-soft)] text-[11px] uppercase text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Stage</th>
                    <th className="px-4 py-3 font-bold">Owner</th>
                    <th className="px-4 py-3 font-bold">Next Route</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {lifecycleStages.map((stage) => (
                    <tr key={stage.state} className="hover:bg-[color:var(--color-surface-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-bold">
                          {stage.index + 1}. {stage.state}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{stage.owner}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        {stage.outgoing?.to ?? "Lifecycle complete"}
                      </td>
                      <td className="px-4 py-4">
                        <Button asChild size="sm">
                          <Link href={stage.href}>
                            Open
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
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

export function LifecycleStagePage({
  stageSlug,
  projects,
}: {
  stageSlug: string;
  projects: ProjectRecord[];
}) {
  const stage = lifecycleStages.find((item) => item.slug === stageSlug);

  if (!stage) return null;

  const activeCases = projects.filter((item) => item.state === stage.state);
  const ownerRoute = roleRoutes.find((route) => route.role === stage.owner);
  const ownerStages = getLifecycleStagesForRole(stage.owner);

  return (
    <AdminShell
      code="LC"
      title={stage.state}
      subtitle={`${stage.owner} queue`}
      badgeLabel={stage.owner}
      primaryActive="lifecycle"
      workflowTitle="Owner Stages"
      workflowLinks={ownerStages.map((item) => ({
        href: item.href,
        label: `${item.index + 1}. ${item.state}`,
        active: item.state === stage.state,
      }))}
    >
      <ShellHeading
        title={`${stage.index + 1}. ${stage.state}`}
        subtitle="Lifecycle stage verification view."
        action={
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Project
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 px-6 pb-8 pt-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">Stage</p>
              <p className="mt-2 text-2xl font-bold text-[color:var(--color-primary)]">
                {stage.index + 1}/{lifecycleStages.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">Owner</p>
              <p className="mt-2 font-bold">{stage.owner}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">
                Active Cases
              </p>
              <p className="mt-2 text-2xl font-bold text-[color:var(--color-primary)]">
                {activeCases.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">Status</p>
              <Badge className="mt-2" variant={stage.outgoing ? "info" : "success"}>
                {stage.outgoing ? "In route" : "Complete"}
              </Badge>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Search Projects</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]" />
              <input
                readOnly
                value=""
                placeholder="Search by project, owner, or stage"
                className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white pl-10 pr-3 text-sm placeholder:text-[color:var(--color-muted)]"
              />
            </label>
            <input
              readOnly
              value=""
              placeholder="Status filter"
              className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 text-sm placeholder:text-[color:var(--color-muted)]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Routing Rule</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-3 rounded-lg border border-[color:var(--color-border)] bg-white px-4 py-3 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">Current</p>
                <p className="mt-1 font-bold">{stage.state}</p>
                <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                  {stage.incoming?.rule ?? "Lifecycle starts with created opportunity data."}
                </p>
              </div>
              <div className="hidden items-center text-[color:var(--color-muted)] md:flex">
                {stage.outgoing ? (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">Next</p>
                <p className="mt-1 font-bold">
                  {stage.outgoing?.to ?? "Project closed"}
                </p>
                <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                  {stage.outgoing?.rule ?? "Final reporting is complete."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Stage Projects</CardTitle>
            {ownerRoute ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={ownerRoute.href}>Open owner role</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[820px] overflow-hidden rounded-lg border border-[color:var(--color-border)] text-left text-sm">
                <thead className="bg-[color:var(--color-surface-soft)] text-[11px] uppercase text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Project</th>
                    <th className="px-4 py-3 font-bold">Region</th>
                    <th className="px-4 py-3 font-bold">Decision</th>
                    <th className="px-4 py-3 font-bold">Owner Queue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {activeCases.map((item) => (
                    <tr key={item.id} className="hover:bg-[color:var(--color-surface-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-bold">{item.customer}</p>
                        <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">{item.id}</p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{item.region}</td>
                      <td className="px-4 py-4">
                        <Badge variant="info">{item.decision}</Badge>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{item.roleQueue}</td>
                    </tr>
                  ))}
                  {activeCases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-5 text-sm text-[color:var(--color-muted)]" colSpan={4}>
                        No projects are currently in this lifecycle stage.
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
