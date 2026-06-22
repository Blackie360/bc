import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Eye, Pencil, Send } from "lucide-react";
import {
  completeFiberPlanningAction,
  confirmSduAlignmentAction,
  confirmSalesOperationsOrderAction,
  decideFinanceWorkflowAction,
  prepareBusinessCaseFromPboqAction,
  reportSalesOperationsDiscrepancyAction,
  reportSduAlignmentMismatchAction,
  submitSduSurveyCostAction,
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
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUserRole } from "@/lib/current-user";
import { parseKickoffLinkNotes } from "@/lib/pboq-kickoff-links";
import {
  SURVEY_COST_DEVIATION_THRESHOLD_PERCENT,
  canEditProject,
  getProject,
  hasPboqDocumentAttachment,
  isAccountManagerBcPreparationStage,
  isFibreReadyOpportunity,
  planningRoleForProject,
  projectDecisionStatus,
} from "@/lib/projects";
import { roleRoutes, type Role } from "@/lib/workflow";

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
    return notFound();
  }

  const currentRole = await getCurrentUserRole();
  const projectPlanningRole = planningRoleForProject(project);
  const isRetainedPlanningProject =
    projectPlanningRole != null &&
    currentRole === projectPlanningRole &&
    Boolean(project.pboqRequest?.completedAt);
  const financeAction = decideFinanceWorkflowAction.bind(null, project.id);
  const fiberPlanningAction = completeFiberPlanningAction.bind(null, project.id);
  const salesOperationsConfirmAction = confirmSalesOperationsOrderAction.bind(null, project.id);
  const salesOperationsDiscrepancyAction =
    reportSalesOperationsDiscrepancyAction.bind(null, project.id);
  const sduAlignmentConfirmAction = confirmSduAlignmentAction.bind(null, project.id);
  const sduAlignmentMismatchAction = reportSduAlignmentMismatchAction.bind(null, project.id);
  const sduSurveyCostAction = submitSduSurveyCostAction.bind(null, project.id);
  const prepareBcAction = prepareBusinessCaseFromPboqAction.bind(null, project.id);
  const isFinanceStage = project.state === "Finance / CFO Approval";
  const isSalesOperationsStage =
    project.state === "Sales Operations Validation" && project.roleQueue === "Sales Operations";
  const isSDUStage = project.state === "SDU Validation" && project.roleQueue === "SDU";
  const isPlanningStage =
    project.roleQueue === "Fiber Planning Team" ||
    project.roleQueue === "Wireless Planning Team" ||
    isRetainedPlanningProject;
  const planningLabel =
    (projectPlanningRole ?? project.roleQueue) === "Wireless Planning Team"
      ? "Wireless Planning"
      : "Fiber Planning";
  const showEditProject = canEditProject(project);
  const isAccountManagerBcStage =
    !isRetainedPlanningProject && isAccountManagerBcPreparationStage(project);
  const isFibreReady = isFibreReadyOpportunity(project);
  const showPboqRequestSummary =
    !isPlanningStage && !hasPboqDocumentAttachment(project);
  const shellRole: Role =
    isRetainedPlanningProject && projectPlanningRole ? projectPlanningRole : project.roleQueue;
  const roleRoute = roleRoutes.find((route) => route.role === shellRole);
  const dashboardHref = roleRoute?.href ?? "/roles";
  const projectsHref = roleRoute ? `/projects?role=${roleRoute.slug}` : "/projects";
  const certificateDocument = project.certificate
    ? project.documents.find((document) => document.id === project.certificate?.documentId)
    : null;
  const certificateHref = `/projects/${encodeURIComponent(project.id)}/certificate`;
  const pboqDocuments = project.documents.filter((document) => document.type === "PBOQ");
  const planningPboqFiles =
    project.pboqRequest?.costLines.map(
      (line, index) =>
        project.documents.find((document) => document.id === line.pboqDocumentId) ??
        pboqDocuments[index],
    ) ?? [];
  const decisionStatus = projectDecisionStatus(project);

  return (
    <AdminShell
      code="PRJ"
      title={project.customer}
      subtitle={project.id}
      badgeLabel={shellRole}
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
              <Badge className="mt-1" variant={decisionStatus === "Done" ? "success" : "info"}>
                {decisionStatus}
              </Badge>
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
        {project.certificate ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>BC Approval Certificate</CardTitle>
              <p className="text-sm text-[color:var(--color-muted)]">
                Certificate generated, uploaded to the Salesforce Opportunity, and distributed to the approval handoff teams.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                  Certificate
                </p>
                <p className="mt-2 font-medium text-[color:var(--color-primary)]">
                  {certificateDocument?.name ?? "BC Approval Certificate"}
                </p>
                <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                  Issued{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(project.certificate.issuedAt))}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={certificateHref} target="_blank" rel="noreferrer">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`${certificateHref}?download=1`}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                  Salesforce Opportunity
                </p>
                <p className="mt-2 font-mono text-sm font-medium text-[color:var(--color-primary)]">
                  {project.certificate.salesforceOpportunityId}
                </p>
                <Badge className="mt-2 capitalize" variant="info">
                  {project.certificate.salesforceUploadStatus}
                </Badge>
              </div>
              <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                  Distributed To
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {project.certificate.distributedTo.map((recipient) => (
                    <Badge key={recipient} variant="success">
                      {recipient}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {showPboqRequestSummary ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>{isFibreReady ? "Fibre Ready Opportunity" : "PBOQ Request"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 md:grid-cols-3">
              {project.pboqRequest ? (
                <>
                  {[
                    ["Route Distance", `${project.pboqRequest.routeDistanceKm} km`],
                    ["Site Count", project.pboqRequest.siteCount.toString()],
                    ["Survey Available", project.pboqRequest.surveyAvailable ? "Yes" : "No"],
                    ["Cost Source", isFibreReady ? "Fibre Ready" : project.pboqRequest.costSource],
                    ["Actual Survey Cost", money(project.pboqRequest.actualSurveyCost)],
                    [
                      "PBOQ Status",
                      isFibreReady
                        ? "Not required"
                        : project.pboqRequest.completedAt
                          ? "Completed"
                          : `Pending ${planningLabel}`,
                    ],
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
                              {line.siteCoordinates ?? kickoff.siteCoordinates ? (
                                <span className="font-mono text-xs text-[color:var(--color-muted)]">
                                  {line.siteCoordinates ?? kickoff.siteCoordinates}
                                </span>
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
        {isPlanningStage ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-[color:var(--color-primary)]">{planningLabel}</h2>
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
              initialPboqFiles={planningPboqFiles}
              kickoffLinkCount={project.pboqRequest?.costLines.length ?? 0}
              planningLabel={planningLabel}
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
                label="Escalate to CFO"
                notesLabel="Escalation reason"
                notesPlaceholder="Explain why CFO escalation is needed."
                variant="warning"
                projectId={project.id}
              />
              {/* <FinanceDecisionForm
              action={financeAction}
              description="Escalate to CEO for executive judgement."
              decision="escalate-ceo"
              label="Escalate to CEO"
              notesLabel="Escalation reason"
              notesPlaceholder="Explain why CEO escalation is needed."
              variant="warning"
              projectId={project.id}
              /> */}
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
        {isSalesOperationsStage ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Sales Operations</CardTitle>
              <p className="text-sm text-[color:var(--color-muted)]">
                Review and clean the Salesforce order, then validate that the Order Form aligns with the approved BC.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-md border border-[color:var(--color-border)] bg-white p-4">
                <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">
                  Order vs BC Alignment Check
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--color-muted-strong)]">
                  <li>Validate the Order Form against the approved Business Case.</li>
                  <li>Confirm commercial values, link scope, service details, and approval trail.</li>
                  <li>Clean Salesforce order details before delivery handoff.</li>
                </ul>
              </div>
              <div className="grid gap-3">
                <form
                  action={salesOperationsConfirmAction}
                  className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">
                      Order Matches BC
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      Push the order to SDU for implementation initiation.
                    </p>
                  </div>
                  <FormSubmitButton size="sm" pendingLabel="Sending to SDU…">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Push to SDU
                  </FormSubmitButton>
                </form>
                <form
                  action={salesOperationsDiscrepancyAction}
                  className="grid gap-3 rounded-md border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-surface)] p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-danger-text)]">
                      Mismatch / Discrepancy Detected
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-danger-text)]">
                      Redirect the BC back to Finance with discrepancy notes for re-evaluation.
                    </p>
                  </div>
                  <label className="grid gap-2 text-xs font-medium text-[color:var(--color-danger-text)]">
                    <span>Discrepancy notes</span>
                    <Textarea
                      name="notes"
                      placeholder="Describe the Order Form and BC mismatch Finance must re-evaluate."
                      minLength={3}
                      required
                    />
                  </label>
                  <FormSubmitButton size="sm" variant="warning" pendingLabel="Sending to Finance…">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Return to Finance
                  </FormSubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {isSDUStage ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>SDU Implementation Initiation</CardTitle>
              <p className="text-sm text-[color:var(--color-muted)]">
                Validate alignment across the BC, Order, and technical details before survey handling and site acquisition.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-md border border-[color:var(--color-border)] bg-white p-4">
                <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">
                  SDU Alignment Check
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--color-muted-strong)]">
                  <li>Confirm the approved BC aligns with Order details and technical scope.</li>
                  <li>Use the existing survey cost when survey evidence already exists.</li>
                  <li>Submit actual survey cost when a new survey is required.</li>
                  <li>
                    Survey deviations above {SURVEY_COST_DEVIATION_THRESHOLD_PERCENT}% require a
                    revised BC and repeat approval workflow.
                  </li>
                </ul>
              </div>
              <div className="grid gap-3">
                <form
                  action={sduAlignmentConfirmAction}
                  className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">
                      Alignment Confirmed
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      Existing survey evidence is available. Proceed to Site Acquisition with the
                      recorded survey cost.
                    </p>
                  </div>
                  <FormSubmitButton size="sm" pendingLabel="Sending to Site Acquisition…">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Proceed to Site Acquisition
                  </FormSubmitButton>
                </form>
                <form
                  action={sduSurveyCostAction}
                  className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-primary)]">
                      No Survey Exists
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      Submit the actual site survey cost after completion. The system checks variance
                      before routing the project.
                    </p>
                  </div>
                  <label className="grid gap-2 text-xs font-medium text-[color:var(--color-muted-strong)]">
                    <span>Actual survey cost</span>
                    <Input
                      name="actualSurveyCost"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      defaultValue={project.pboqRequest?.actualSurveyCost || ""}
                      required
                    />
                  </label>
                  <FormSubmitButton size="sm" pendingLabel="Checking variance…">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Submit Survey Cost
                  </FormSubmitButton>
                </form>
                <form
                  action={sduAlignmentMismatchAction}
                  className="grid gap-3 rounded-md border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-surface)] p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-danger-text)]">
                      Mismatch / Oversight Detected
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-danger-text)]">
                      Revert the BC to Finance with justification so Finance can re-evaluate and
                      issue an updated approval.
                    </p>
                  </div>
                  <label className="grid gap-2 text-xs font-medium text-[color:var(--color-danger-text)]">
                    <span>Justification</span>
                    <Textarea
                      name="notes"
                      placeholder="Describe the BC, Order, or technical detail mismatch Finance must re-evaluate."
                      minLength={3}
                      required
                    />
                  </label>
                  <FormSubmitButton size="sm" variant="warning" pendingLabel="Sending to Finance…">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Return to Finance
                  </FormSubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {project.financeDecisions?.length ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Approval Trail Comments</CardTitle>
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
