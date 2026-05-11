import Link from "next/link";
import {
  Search,
  Plus,
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
import {
  getLifecycleStagesForRole,
  lifecycleStages,
  roleRoutes,
  type Role,
  workflowTransitions,
} from "@/lib/workflow";
import type { ProjectRecord } from "@/lib/projects";

const roleDescriptions: Record<Role, string> = {
  "Account Manager": "Opportunity intake and PBOQ initiation",
  "Fiber Planning Team": "Planning pack and PBOQ submissions",
  "BC Analyst / Finance": "Business case finance review",
  CFO: "Threshold escalation approvals",
  "Sales Operations": "Certificate and approval trail validation",
  SDU: "Validation and implementation handoff",
  "Site Acquisition Manager": "Site acquisition evidence control",
  "Project Manager": "Implementation ownership",
  Contractor: "Actual cost capture and evidence",
};

const roleCodes: Record<Role, string> = {
  "Account Manager": "AM",
  "Fiber Planning Team": "PLN",
  "BC Analyst / Finance": "BC",
  CFO: "CFO",
  "Sales Operations": "OPS",
  SDU: "SDU",
  "Site Acquisition Manager": "SAM",
  "Project Manager": "PM",
  Contractor: "CTR",
};

type Transition = (typeof workflowTransitions)[number];

function RouteStatus({ transition }: { transition?: Transition }) {
  if (!transition) {
    return (
      <span className="inline-flex rounded-full bg-[#fff4cf] px-2.5 py-1 text-xs font-semibold text-[#a25a00]">
        Pending Route
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-[#e8edf6] px-2.5 py-1 text-xs font-semibold text-[#001f60]">
      {transition.to}
    </span>
  );
}

export function RoleRoutesIndex({ projects }: { projects: ProjectRecord[] }) {
  const stageCounts = lifecycleStages.map((stage) => ({
    state: stage.state,
    count: projects.filter((project) => project.state === stage.state).length,
  }));

  return (
    <AdminShell
      code="ADM"
      title="Admin Dashboard"
      subtitle="Workflow control center"
      badgeLabel="Admin"
      primaryActive="dashboard"
      workflowLinks={roleRoutes.map((route) => ({
        href: route.href,
        label: route.role,
      }))}
    >
      <ShellHeading
        title="Admin - Role Routes"
        subtitle="Admin view: all role queues and workflow responsibilities."
      />
      <div className="space-y-5 px-6 pb-8 pt-6">
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Total Roles
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {roleRoutes.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Active Projects
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {projects.length}
              </p>
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
                Stages Covered
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {stageCounts.filter((stage) => stage.count > 0).length}
              </p>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Stage Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 p-4">
            {stageCounts.map((stage) => (
              <Badge key={stage.state} variant={stage.count > 0 ? "info" : "default"}>
                {stage.state} ({stage.count})
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

export function RoleRoutePage({
  role,
  projects,
}: {
  role: Role;
  projects: ProjectRecord[];
}) {
  const route = roleRoutes.find((item) => item.role === role);
  const queuedCases = projects.filter((item) => item.roleQueue === role);

  if (!route) return null;

  const visibleStages = getLifecycleStagesForRole(role);

  return (
    <AdminShell
      code={roleCodes[role]}
      title={role}
      subtitle={roleDescriptions[role]}
      badgeLabel={role}
      primaryActive="dashboard"
      workflowTitle="My Stages"
      workflowLinks={[
        ...visibleStages.map((stage) => ({
          href: stage.href,
          label: `${stage.index + 1}. ${stage.state}`,
        })),
        {
          href: route.href,
          label: "Assigned Queue",
          active: true,
        },
      ]}
    >
      <ShellHeading
        title={`${role} - Assigned Projects`}
        subtitle="Review the work currently routed to this role."
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
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Queue Size
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {queuedCases.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Active Route
              </p>
              <p className="mt-1 text-sm font-bold text-[color:var(--color-primary)]">
                {route.transitions[0]?.to ?? "No route"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Avg IRR
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {queuedCases.length === 0
                  ? "0%"
                  : `${Math.round(
                      queuedCases.reduce((total, item) => total + item.irr, 0) /
                        queuedCases.length,
                    )}%`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Ready To Route
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {queuedCases.filter((item) => item.revisions <= 1).length}
              </p>
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
                placeholder="Search by project name, ID, or area"
                className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white pl-10 pr-3 text-sm placeholder:text-[color:var(--color-muted)]"
              />
            </label>
            <input
              readOnly
              value=""
              placeholder="Role filter"
              className="h-10 w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 text-sm placeholder:text-[color:var(--color-muted)]"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Assigned Projects</CardTitle>
            <div className="flex items-center gap-2">
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-surface-soft)] px-1.5 text-xs font-bold text-[color:var(--color-primary)]">
                {queuedCases.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[980px] overflow-hidden rounded-lg border border-[color:var(--color-border)] text-left text-sm">
                <thead className="bg-[color:var(--color-surface-soft)] text-[11px] uppercase text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Project</th>
                    <th className="px-4 py-3 font-bold">Service Area</th>
                    <th className="px-4 py-3 font-bold">Budget</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Updated</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {queuedCases.map((item) => (
                    <tr key={item.id} className="hover:bg-[color:var(--color-surface-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-bold">{item.customer}</p>
                        <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">
                          {item.id}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{item.region}</td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        {item.approvedBudget.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-4">
                        <RouteStatus transition={route.transitions[0]} />
                        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                          {route.transitions[0]?.rule ?? "No transition configured"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">{item.updatedAt}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link href={`/projects/${item.id}`}>View</Link>
                          </Button>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/projects/${item.id}/edit`}>Edit</Link>
                          </Button>
                          <Button size="sm" variant="secondary">
                            Route
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {queuedCases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-5 text-sm text-[color:var(--color-muted)]" colSpan={6}>
                        No projects are currently queued for this role.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Workflow Route</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {route.transitions.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {route.transitions.map((transition) => (
                  <div
                    key={`${transition.from}-${transition.to}`}
                    className="grid gap-3 rounded-lg border border-[color:var(--color-border)] bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">
                        From
                      </p>
                      <p className="mt-1 font-bold">{transition.from}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">To</p>
                      <p className="mt-1 font-bold">{transition.to}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">
                        Route Rule
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--color-muted)]">{transition.rule}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-surface)] p-4 text-sm text-[color:var(--color-warning-text)]">
                No workflow transition is assigned to this role yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
