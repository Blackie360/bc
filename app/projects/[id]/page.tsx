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
      <div className="mx-auto max-w-6xl space-y-5 px-6 pb-8 pt-6">
        <section className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">State</p>
              <p className="mt-1 font-bold text-[color:var(--color-primary)]">{project.state}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">Decision</p>
              <Badge className="mt-1" variant="info">{project.decision}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">Budget</p>
              <p className="mt-1 font-bold text-[color:var(--color-primary)]">
                {new Intl.NumberFormat("en-US").format(project.approvedBudget)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[color:var(--color-muted)]">Variance</p>
              <p className="mt-1 font-bold text-[color:var(--color-primary)]">{project.variance}%</p>
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
              ["Lifecycle Stage", project.state],
              ["Role Queue", project.roleQueue],
              ["BC Type", project.type],
              ["IRR", `${project.irr}%`],
              ["Payback", `${project.payback} months`],
              ["Capex", new Intl.NumberFormat("en-US").format(project.capex)],
              ["Approved Budget", new Intl.NumberFormat("en-US").format(project.approvedBudget)],
              ["Actual Spend", new Intl.NumberFormat("en-US").format(project.actualSpend)],
              ["Variance", `${project.variance}%`],
              ["Survey Deviation", `${project.surveyDeviation}%`],
              ["Due", project.due],
              ["Revisions", project.revisions.toString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[color:var(--color-border)] bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">{label}</p>
                <p className="mt-2 font-bold">{value}</p>
              </div>
            ))}
            <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-3">
              <p className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">Decision</p>
              <Badge className="mt-2" variant="info">{project.decision}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
