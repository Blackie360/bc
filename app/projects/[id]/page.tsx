import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageSquare, Pencil, Send } from "lucide-react";
import { createFindingCommentAction, decideFinanceWorkflowAction } from "@/app/projects/actions";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getProject } from "@/lib/projects";
import { lifecycleStages, roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const attachmentLabels = {
  BC_TEMPLATE: "BC Template",
  PBOQ: "PBOQ File",
  ORDER_FORM: "Order Form",
  ACTUAL_SURVEY_QUOTE: "PBOQ / Quote Evidence",
} as const;

const findingCommentRoles = new Set([
  "CFO",
  "Solutions Architect",
  "Solutions Engineer",
]);

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function FinanceDecisionForm({
  action,
  decision,
  label,
  notesPlaceholder,
  variant = "secondary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  decision: string;
  label: string;
  notesPlaceholder: string;
  variant?: "default" | "secondary" | "warning";
}) {
  return (
    <form action={action} className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-3">
      <input type="hidden" name="decision" value={decision} />
      <Textarea name="notes" placeholder={notesPlaceholder} />
      <Button type="submit" variant={variant} size="sm">
        {decision === "approve" ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
      </Button>
    </form>
  );
}

function FindingCommentForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-white p-3">
      <Textarea
        name="notes"
        placeholder="Share findings, concerns, or clarification notes about this opportunity"
        required
      />
      <Button type="submit" size="sm">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        Send Comment
      </Button>
    </form>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const financeAction = decideFinanceWorkflowAction.bind(null, project.id);
  const findingCommentAction = createFindingCommentAction.bind(null, project.id);
  const isFinanceStage = project.state === "Finance / CFO Approval";
  const canSendFindingComment = findingCommentRoles.has(project.roleQueue);

  return (
    <AdminShell
      code="PRJ"
      title={project.customer}
      subtitle={project.id}
      badgeLabel={project.roleQueue}
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
        title={project.customer}
        subtitle={`Project ${project.id}`}
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Projects
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit Project
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-6xl space-y-4 px-6 pb-8 pt-6">
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
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle>{project.customer}</CardTitle>
            <p className="font-mono text-xs text-[color:var(--color-muted)]">{project.id}</p>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 md:grid-cols-3">
            {[
              ["Title", project.title],
              ["Region", project.region],
              ["Owner", project.owner],
              ["Solution Architecture", project.solutionArchitectureName],
              ["Solution Engineer", project.solutionEngineerName],
              ["Lifecycle Stage", project.state],
              ["Role Queue", project.roleQueue],
              ["BC Type", project.type],
              ["IRR", `${project.irr}%`],
              ["Payback", `${project.payback} months`],
              ["Capex", money(project.capex)],
              ["Approved Budget", money(project.approvedBudget)],
              ["Actual Spend", money(project.actualSpend)],
              ["Total MRR", money(project.totalMrr)],
              ["Total MRC", money(project.totalMrc)],
              ["Total NRC", money(project.totalNrc)],
              ["Total NRR", money(project.totalNrr)],
              ["Variance", `${project.variance}%`],
              ["Survey Deviation", `${project.surveyDeviation}%`],
              ["Due", project.due],
              ["Revisions", project.revisions.toString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">{label}</p>
                <p className="mt-2 font-medium">{value}</p>
              </div>
            ))}
            <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">Decision</p>
              <Badge className="mt-2" variant="info">{project.decision}</Badge>
            </div>
          </CardContent>
        </Card>
        {isFinanceStage ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Finance Decision</CardTitle>
              <p className="text-sm text-[color:var(--color-muted)]">
                Approve to Sales Operations, or reject with the next route for follow-up.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <FinanceDecisionForm
                action={financeAction}
                decision="approve"
                label="Approve to Sales Operations"
                notesPlaceholder="Optional approval notes"
              />
              <FinanceDecisionForm
                action={financeAction}
                decision="reject-escalate-cfo"
                label="Reject and Escalate to CFO"
                notesPlaceholder="Explain why CFO review is needed"
                variant="warning"
              />
              <FinanceDecisionForm
                action={financeAction}
                decision="reject-question-architect"
                label="Reject and Ask Solutions Architect"
                notesPlaceholder="Question for the Solutions Architect"
                variant="warning"
              />
              <FinanceDecisionForm
                action={financeAction}
                decision="reject-question-engineer"
                label="Reject and Ask Solutions Engineer"
                notesPlaceholder="Question for the Solutions Engineer"
                variant="warning"
              />
            </CardContent>
          </Card>
        ) : null}
        {canSendFindingComment || project.comments.length > 0 ? (
          <Card>
            <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
              <CardTitle>Finding Comments</CardTitle>
              <p className="text-sm text-[color:var(--color-muted)]">
                CFO, Solutions Architect, and Solutions Engineer comments stay with the opportunity history.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              {canSendFindingComment ? (
                <FindingCommentForm action={findingCommentAction} />
              ) : (
                <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3 text-sm text-[color:var(--color-muted)]">
                  Finding comments open when this opportunity is queued with CFO, Solutions Architect, or
                  Solutions Engineer.
                </div>
              )}
              <div className="grid gap-3">
                {project.comments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-md border border-[color:var(--color-border)] bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[color:var(--color-primary)]">{comment.actorName}</p>
                        <p className="text-xs text-[color:var(--color-muted)]">{comment.role}</p>
                      </div>
                      <time className="text-xs text-[color:var(--color-muted)]" dateTime={comment.createdAt}>
                        {dateTime(comment.createdAt)}
                      </time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--color-muted-strong)]">
                      {comment.notes}
                    </p>
                  </article>
                ))}
                {project.comments.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white p-3 text-sm text-[color:var(--color-muted)]">
                    No finding comments have been sent yet.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle>Link Items</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
                  <tr>
                    {["Link", "Material", "Labor", "Wayleave", "MRR", "MRC", "NRC", "NRR", "Evidence"].map((label) => (
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
                      <td className="px-3 py-3">{money(link.material)}</td>
                      <td className="px-3 py-3">{money(link.labor)}</td>
                      <td className="px-3 py-3">{money(link.wayleave)}</td>
                      <td className="px-3 py-3">{money(link.mrr)}</td>
                      <td className="px-3 py-3">{money(link.mrc)}</td>
                      <td className="px-3 py-3">{money(link.nrc)}</td>
                      <td className="px-3 py-3">{money(link.nrr)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={link.evidenceDocumentId ? "info" : "warning"}>
                          {link.evidenceDocumentId ? "Attached" : "Missing"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {project.links.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-[color:var(--color-muted)]" colSpan={9}>
                        No link items recorded.
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
            <CardTitle>Attachment Checklist</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 md:grid-cols-2">
            {Object.entries(attachmentLabels).map(([type, label]) => {
              const matches = project.documents.filter((document) => document.type === type);

              return (
                <div key={type} className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                      {label}
                    </p>
                    <Badge variant={matches.length > 0 ? "info" : "warning"}>
                      {matches.length > 0 ? "Attached" : "Missing"}
                    </Badge>
                  </div>
                  {matches.map((document) => (
                    <p key={document.id} className="mt-2 truncate text-sm font-medium">
                      {document.name}
                    </p>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
