import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  completeFiberPlanningAction,
  decideFinanceWorkflowAction,
  prepareBusinessCaseFromPboqAction,
} from "@/app/projects/actions";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import {
  FiberPlanningForm,
  PreparedBcForm,
} from "@/components/workflow/pboq-workflow-forms";
import { FinanceDecisionForm } from "@/components/workflow/finance-decision-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseKickoffLinkNotes } from "@/lib/pboq-kickoff-links";
import {
  canEditProject,
  getProject,
  hasPboqDocumentAttachment,
  isAccountManagerBcPreparationStage,
} from "@/lib/projects";
import { roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; draft?: string; fiberError?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const fiberPlanningError =
    typeof query.fiberError === "string" && query.fiberError.trim().length > 0
      ? (() => {
          try {
            return decodeURIComponent(query.fiberError);
          } catch {
            return query.fiberError;
          }
        })()
      : null;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const financeAction = decideFinanceWorkflowAction.bind(null, project.id);
  const fiberPlanningAction = completeFiberPlanningAction.bind(null, project.id);
  const prepareBcAction = prepareBusinessCaseFromPboqAction.bind(null, project.id);
  const isFinanceStage = project.state === "Finance / CFO Approval";
  const isFiberPlanningStage = project.roleQueue === "Fiber Planning Team";
  const showEditProject = canEditProject(project);
  const isAccountManagerBcStage = isAccountManagerBcPreparationStage(project);
  const showPboqRequestSummary =
    !isFiberPlanningStage && !hasPboqDocumentAttachment(project);
  const roleRoute = roleRoutes.find((route) => route.role === project.roleQueue);
  const dashboardHref = roleRoute?.href ?? "/roles";
  const projectsHref = roleRoute ? `/projects?role=${roleRoute.slug}` : "/projects";

  return (
    <AdminShell
      code="PRJ"
      title={project.customer}
      subtitle={project.id}
      badgeLabel={project.roleQueue}
      primaryActive="projects"
      workflowLinks={[]}
      showWorkflowLinks={false}
      dashboardHref={dashboardHref}
      projectsHref={projectsHref}
    >
      <ShellHeading
        title={project.customer}
        subtitle={`Project ${project.id}`}
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={projectsHref}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Projects
              </Link>
            </Button>
            {showEditProject ? (
              <Button asChild size="sm">
                <Link href={`/projects/${project.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit Project
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="mx-auto max-w-6xl space-y-4 px-6 pb-8 pt-6">
        {fiberPlanningError ? (
          <div
            className="rounded-md border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-surface)] px-4 py-3 text-sm text-[color:var(--color-danger-text)]"
            role="alert"
          >
            {fiberPlanningError}
          </div>
        ) : null}
        {query.submitted === "bc" ? (
          <div className="rounded-md border border-[color:var(--color-success-border)] bg-[color:var(--color-success-surface)] px-4 py-3 text-sm text-[color:var(--color-success-text)]">
            BC submitted and routed according to the approval rules.
          </div>
        ) : null}
        {query.draft === "saved" ? (
          <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-4 py-3 text-sm text-[color:var(--color-muted-strong)]">
            Draft saved. You can continue editing before final submission.
          </div>
        ) : null}
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">State</p>
              <p className="mt-1 font-medium text-[color:var(--color-primary)]">{project.state}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">Decision</p>
              <Badge className="mt-1" variant="info">{project.decision}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">Budget</p>
              <p className="mt-1 font-medium text-[color:var(--color-primary)]">
                {money(project.approvedBudget)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-muted)]">Variance</p>
              <p className="mt-1 font-medium text-[color:var(--color-primary)]">{project.variance}%</p>
            </CardContent>
          </Card>
        </section>
        {showPboqRequestSummary ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>PBOQ Request</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 md:grid-cols-3">
              {project.pboqRequest ? (
                <>
                  {[
                    ["Route Distance", `${project.pboqRequest.routeDistanceKm} km`],
                    ["Site Count", project.pboqRequest.siteCount.toString()],
                    ["Survey Available", project.pboqRequest.surveyAvailable ? "Yes" : "No"],
                    ["Cost Source", project.pboqRequest.costSource],
                    ["Actual Survey Cost", money(project.pboqRequest.actualSurveyCost)],
                    ["PBOQ Status", project.pboqRequest.completedAt ? "Completed" : "Pending Fiber Planning"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">{label}</p>
                      <p className="mt-2 font-medium">{value}</p>
                    </div>
                  ))}
                  {project.pboqRequest.costLines.length > 0 ? (
                    <div className="md:col-span-3 rounded-md border border-[color:var(--color-border)] bg-white p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                        Requested Links ({project.pboqRequest.costLines.length})
                      </p>
                      <ul className="mt-2 space-y-2 text-sm">
                        {project.pboqRequest.costLines.map((line) => {
                          const kickoff = parseKickoffLinkNotes(line.notes);

                          return (
                            <li key={line.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{line.linkName}</span>
                              {kickoff.region ? (
                                <Badge>{kickoff.region}</Badge>
                              ) : null}
                              {kickoff.service ? (
                                <Badge>{kickoff.service}</Badge>
                              ) : null}
                              {kickoff.capacity ? (
                                <span className="text-[color:var(--color-muted)]">{kickoff.capacity}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[color:var(--color-muted)]">No PBOQ request recorded.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
        {isFiberPlanningStage ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-[color:var(--color-primary)]">Fiber Planning</h2>
              <p className="text-sm text-[color:var(--color-muted)]">
                {project.pboqRequest && project.pboqRequest.costLines.length > 1
                  ? "Enter build, material, and wayleave costs for each requested link and upload a separate PBOQ file per link."
                  : "Generate the PBOQ cost pack with build, material, and wayleave costs."}
              </p>
            </div>
            <FiberPlanningForm
              action={fiberPlanningAction}
              projectId={project.id}
              initialCostLines={project.pboqRequest?.costLines ?? []}
              kickoffLinkCount={project.pboqRequest?.costLines.length ?? 0}
            />
          </section>
        ) : null}
        {isAccountManagerBcStage ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[color:var(--color-primary)]">Prepare Business Case</h2>
            <PreparedBcForm action={prepareBcAction} project={project} />
          </section>
        ) : null}
        {isFinanceStage ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Finance Decision</CardTitle>
              <p className="text-sm text-[color:var(--color-muted)]">
                Select a Finance outcome and include the reason before routing the project.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <FinanceDecisionForm
                action={financeAction}
                description="Approved cases move to the Sales Operations validation queue."
                decision="approve"
                label="Approve"
                notesLabel="Approval reason"
                notesPlaceholder="Explain why Finance approved this project."
                projectId={project.id}
                variant="default"
              />
              <FinanceDecisionForm
                action={financeAction}
                description="Rejected cases remain in the current Finance queue for follow-up."
                decision="reject"
                label="Reject"
                notesLabel="Rejection reason"
                notesPlaceholder="Explain why Finance rejected this project."
                variant="warning"
                projectId={project.id}
              />
              <FinanceDecisionForm
                action={financeAction}
                description="Escalations move to the CFO queue for executive review."
                decision="escalate-cfo"
                label="Escalate"
                notesLabel="Escalation reason"
                notesPlaceholder="Explain why CFO escalation is needed."
                variant="warning"
                projectId={project.id}
              />
              <FinanceDecisionForm
                action={financeAction}
                description="Redirect with a question to Solutions Architecture."
                decision="question-architect"
                label="Redirect with Question"
                notesLabel="Question for Solutions Architecture"
                notesPlaceholder="Write the question for Solutions Architecture."
                variant="warning"
                projectId={project.id}
              />
            </CardContent>
          </Card>
        ) : null}
        {project.financeDecisions?.length ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Finance Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {project.financeDecisions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-[color:var(--color-border)] bg-white p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="capitalize" variant="info">
                      {item.decision.replaceAll("-", " ")}
                    </Badge>
                    <span className="text-xs text-[color:var(--color-muted)]">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(item.createdAt))}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-[color:var(--color-muted-strong)]">
                    {item.notes}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {project.links.length > 0 ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>BC Link Items</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead className="border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
                    <tr>
                      {[
                        "Link",
                        "Service",
                        "Technology",
                        "Onnet/Offnet",
                        "Source",
                        "New Build",
                        "Provisioning",
                        "Material",
                        "Wayleave",
                        "NRC",
                        "MRC",
                        "MRR",
                        "NRR",
                        "Onnet Cap.",
                        "Offnet Cap.",
                        "Evidence",
                      ].map((label) => (
                        <th key={label} className="px-3 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border)]">
                    {project.links.map((link) => (
                      <tr key={link.id}>
                        <td className="px-3 py-3 font-medium">{link.linkName}</td>
                        <td className="px-3 py-3">{link.service || "—"}</td>
                        <td className="px-3 py-3">{link.technology || "—"}</td>
                        <td className="px-3 py-3">{link.onnetOffnet ?? "—"}</td>
                        <td className="px-3 py-3">{link.costSource ?? "—"}</td>
                        <td className="px-3 py-3">{money(link.newBuildCost)}</td>
                        <td className="px-3 py-3">{money(link.provisioningCost)}</td>
                        <td className="px-3 py-3">{money(link.materialCost)}</td>
                        <td className="px-3 py-3">{money(link.wayleaveCost)}</td>
                        <td className="px-3 py-3">{money(link.nrc)}</td>
                        <td className="px-3 py-3">{money(link.mrc)}</td>
                        <td className="px-3 py-3">{money(link.mrr)}</td>
                        <td className="px-3 py-3">{money(link.nrr)}</td>
                        <td className="px-3 py-3">{link.onnetCapacity || "—"}</td>
                        <td className="px-3 py-3">{link.offnetCapacity || "—"}</td>
                        <td className="px-3 py-3">
                          <Badge variant={link.evidenceDocumentId ? "info" : "warning"}>
                            {link.evidenceDocumentId ? "Attached" : "Missing"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {project.projectExecutiveSummary ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Project Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm text-[color:var(--color-muted-strong)]">
              {project.projectExecutiveSummary}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
