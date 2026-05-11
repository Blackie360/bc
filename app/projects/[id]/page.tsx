import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject } from "@/lib/projects";
import { lifecycleStages, roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const attachmentLabels = {
  BC_TEMPLATE: "BC Template",
  PBOQ: "PBOQ File",
  ORDER_FORM: "Order Form",
  ACTUAL_SURVEY_QUOTE: "PBOQ / Quote Evidence",
} as const;

function money(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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
