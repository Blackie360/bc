import Link from "next/link";
import {
  Plus,
} from "lucide-react";
import { advanceProjectToNextStageAction } from "@/app/projects/actions";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  roleRoutes,
  type Role,
  workflowTransitions,
} from "@/lib/workflow";
import type { ProjectRecord } from "@/lib/projects";

const roleDescriptions: Record<Role, string> = {
  "Account Manager": "Opportunity intake and PBOQ initiation",
  "Fiber Planning Team": "Planning pack and PBOQ submissions",
  "Solutions Architect": "Design clarification and solution questions",
  "Solutions Engineer": "Technical costing and implementation clarification",
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
  "Solutions Architect": "SA",
  "Solutions Engineer": "SE",
  "BC Analyst / Finance": "BC",
  CFO: "CFO",
  "Sales Operations": "OPS",
  SDU: "SDU",
  "Site Acquisition Manager": "SAM",
  "Project Manager": "PM",
  Contractor: "CTR",
};

type Transition = (typeof workflowTransitions)[number];

const CLOSED_STATE = "Project Closure & Reporting" as const;

function isOngoingProject(project: ProjectRecord) {
  return project.state !== CLOSED_STATE;
}

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

function nextRoutingAction(project: ProjectRecord) {
  if (project.roleQueue === "Fiber Planning Team") {
    return "Generate PBOQ";
  }

  if (
    project.roleQueue === "Account Manager" &&
    project.state === "Business Case Prepared" &&
    project.decision === "PENDING"
  ) {
    return "Prepare BC";
  }

  const hasPboqAttachment = project.documents.some(
    (document) =>
      document.type === "PBOQ" || document.type === "ACTUAL_SURVEY_QUOTE",
  );

  return hasPboqAttachment ? "Send to Finance" : "Request PBOQ";
}

function requiresDetailForm(project: ProjectRecord) {
  return (
    project.roleQueue === "Fiber Planning Team" ||
    (project.roleQueue === "Account Manager" &&
      project.state === "Business Case Prepared" &&
      project.decision === "PENDING")
  );
}

function nextTransitionForProject(project: ProjectRecord) {
  return (
    workflowTransitions.find(
      (transition) => transition.from === project.state && transition.owner === project.roleQueue,
    ) ?? workflowTransitions.find((transition) => transition.from === project.state)
  );
}

function RouteStatus({ transition }: { transition?: Transition }) {
  if (!transition) {
    return (
      <Badge className="rounded-full border-transparent bg-[#fff4cf] px-2.5 py-1 text-xs font-semibold text-[#a25a00]">
        Pending Route
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-transparent bg-[#e8edf6] px-2.5 py-1 text-xs font-semibold text-[#001f60]">
      {transition.to}
    </Badge>
  );
}

export function RoleRoutesIndex({ projects }: { projects: ProjectRecord[] }) {
  const ongoingProjects = [...projects.filter(isOngoingProject)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const closedCount = projects.filter((project) => project.state === CLOSED_STATE).length;

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
                {ongoingProjects.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Open Queues
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {new Set(ongoingProjects.map((project) => project.roleQueue)).size}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">
                Closed Projects
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-primary)]">
                {closedCount}
              </p>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Ongoing Projects</CardTitle>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-surface-soft)] px-1.5 text-xs font-bold text-[color:var(--color-primary)]">
              {ongoingProjects.length}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[860px] overflow-hidden rounded-lg border border-[color:var(--color-border)] text-left text-sm">
                <thead className="bg-[color:var(--color-surface-soft)] text-[11px] uppercase text-[color:var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Project</th>
                    <th className="px-4 py-3 font-bold">Stage</th>
                    <th className="px-4 py-3 font-bold">Role queue</th>
                    <th className="px-4 py-3 font-bold">Last updated</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {ongoingProjects.map((item) => (
                    <tr key={item.id} className="hover:bg-[color:var(--color-surface-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-bold">{item.customer}</p>
                        <p className="mt-1 font-mono text-xs text-[color:var(--color-muted)]">
                          {item.id}
                        </p>
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-[color:var(--color-muted-strong)]">
                        {item.state}
                      </td>
                      <td className="px-4 py-4">
                        {item.roleQueue ? (
                          <Badge className="rounded-full border-transparent bg-[#e8edf6] px-2.5 py-1 text-xs font-semibold text-[#001f60]">
                            {item.roleQueue}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        {formatDateTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link href={`/projects/${item.id}`}>View</Link>
                          </Button>
                          <Button size="sm" variant="secondary">
                            {nextRoutingAction(item)}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {ongoingProjects.length === 0 ? (
                    <tr>
                      <td className="px-4 py-5 text-sm text-[color:var(--color-muted)]" colSpan={5}>
                        No ongoing projects. All projects are in closure or the register is empty.
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

export function RoleRoutePage({
  role,
  projects,
}: {
  role: Role;
  projects: ProjectRecord[];
}) {
  const route = roleRoutes.find((item) => item.role === role);
  const queuedCases = projects.filter((item) => item.roleQueue === role);
  const activeRoute = route?.transitions[0];
  const readyCount = queuedCases.filter((item) => item.revisions <= 1).length;
  const averageIrr =
    queuedCases.length === 0
      ? 0
      : Math.round(
          queuedCases.reduce((total, item) => total + item.irr, 0) /
            queuedCases.length,
        );

  if (!route) return null;

  return (
    <AdminShell
      code={roleCodes[role]}
      title={role}
      subtitle={roleDescriptions[role]}
      badgeLabel={role}
      primaryActive="dashboard"
      workflowLinks={[]}
      showWorkflowLinks={false}
      dashboardHref={route.href}
      projectsHref={`/projects?role=${route.slug}`}
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
        <section
          className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(150px,1fr))]"
          aria-label="Role queue summary"
        >
          <Card className="overflow-hidden border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white">
            <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                    Active Route
                  </p>
                  <p className="mt-2 text-xl font-semibold leading-tight">
                    {activeRoute?.to ?? "No route configured"}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
                  {roleCodes[role]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <span className="h-px flex-1 bg-white/20" aria-hidden="true" />
                <span>{activeRoute ? "Next handoff stage" : "Configuration needed"}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/95">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Queue Size
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tracking-tight text-[color:var(--color-primary)]">
                  {queuedCases.length}
                </p>
                <span className="rounded-full bg-[color:var(--color-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--color-muted-strong)]">
                  Assigned
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/95">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Avg IRR
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tracking-tight text-[color:var(--color-primary)]">
                  {averageIrr}%
                </p>
                <span className="rounded-full bg-[color:var(--color-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--color-muted-strong)]">
                  Portfolio
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/95">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Ready To Route
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tracking-tight text-[color:var(--color-primary)]">
                  {readyCount}
                </p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Clear
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
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
                      <td className="px-4 py-4 text-[color:var(--color-muted-strong)]">
                        {formatDateTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-nowrap items-center gap-2">
                          <Button asChild size="sm" className="min-w-14">
                            <Link href={`/projects/${item.id}`}>View</Link>
                          </Button>
                          {requiresDetailForm(item) ? (
                            <Button asChild size="sm" variant="secondary" className="min-w-44 whitespace-nowrap">
                              <Link href={`/projects/${item.id}`}>{nextRoutingAction(item)}</Link>
                            </Button>
                          ) : (
                            <form
                              action={advanceProjectToNextStageAction.bind(null, item.id)}
                              className="inline-flex"
                            >
                              <FormSubmitButton
                                size="sm"
                                variant="secondary"
                                pendingLabel="Sending…"
                                className="min-w-44 whitespace-nowrap"
                              >
                                {nextTransitionForProject(item)?.to ?? "No next stage"}
                              </FormSubmitButton>
                            </form>
                          )}
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
      </div>
    </AdminShell>
  );
}
