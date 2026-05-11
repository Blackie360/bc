import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectRecord } from "@/lib/projects";
import { lifecycleStages, roleRoutes, roles, workflowStates } from "@/lib/workflow";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#1f3760]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ProjectForm({
  action,
  project,
  title,
}: {
  action: (formData: FormData) => void | Promise<void>;
  project?: ProjectRecord;
  title: string;
}) {
  return (
    <AdminShell
      code="PRJ"
      title="Project Management"
      subtitle="Create and maintain workflow records"
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
        title={title}
        subtitle="Capture core project, queue, and financial data."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Projects
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-5 px-6 pb-8 pt-6">
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Project Form</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form action={action} className="space-y-5">
              <section className="grid gap-4 md:grid-cols-2">
                <h2 className="text-sm font-bold text-[color:var(--color-primary)] md:col-span-2">
                  Basic Information
                </h2>
              <Field label="Customer">
                <Input
                  name="customer"
                  autoComplete="off"
                  defaultValue={project?.customer}
                  placeholder="Kijani Retail Group…"
                  required
                />
              </Field>
              <Field label="Region">
                <Input
                  name="region"
                  autoComplete="off"
                  defaultValue={project?.region}
                  placeholder="Nairobi…"
                  required
                />
              </Field>
              <Field label="Project Title">
                <Textarea
                  name="title"
                  autoComplete="off"
                  defaultValue={project?.title}
                  placeholder="Metro fiber build…"
                  required
                />
              </Field>
              <Field label="Owner">
                <Input
                  name="owner"
                  autoComplete="off"
                  defaultValue={project?.owner}
                  placeholder="A. Mwangi…"
                  required
                />
              </Field>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <h2 className="text-sm font-bold text-[color:var(--color-primary)] md:col-span-2">
                  Workflow Routing
                </h2>
              <Field label="Lifecycle Stage">
                <Select name="state" defaultValue={project?.state ?? workflowStates[0]}>
                  {workflowStates.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Role Queue">
                <Select name="roleQueue" defaultValue={project?.roleQueue ?? roles[0]}>
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </Select>
              </Field>
              <Field label="BC Type">
                <Select name="type" defaultValue={project?.type ?? "Ordinary BC"}>
                  <option>Ordinary BC</option>
                  <option>Margin Analysis BC</option>
                </Select>
              </Field>
              <Field label="Due">
                <Input
                  name="due"
                  autoComplete="off"
                  defaultValue={project?.due ?? "Today"}
                  placeholder="Today…"
                  required
                />
              </Field>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <h2 className="text-sm font-bold text-[color:var(--color-primary)] md:col-span-2">
                  Financial Inputs
                </h2>
              <Field label="IRR">
                <Input
                  name="irr"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  defaultValue={project?.irr ?? 18}
                  required
                />
              </Field>
              <Field label="Payback Months">
                <Input
                  name="payback"
                  type="number"
                  inputMode="numeric"
                  defaultValue={project?.payback ?? 36}
                  required
                />
              </Field>
              <Field label="Capex">
                <Input
                  name="capex"
                  type="number"
                  inputMode="decimal"
                  defaultValue={project?.capex ?? 0}
                  required
                />
              </Field>
              <Field label="Subsidy Requirement">
                <Input
                  name="subsidy"
                  type="number"
                  inputMode="decimal"
                  defaultValue={project?.subsidy ?? 0}
                  required
                />
              </Field>
              <Field label="Approved Budget">
                <Input
                  name="approvedBudget"
                  type="number"
                  inputMode="decimal"
                  defaultValue={project?.approvedBudget ?? 0}
                  required
                />
              </Field>
              <Field label="Actual Spend">
                <Input
                  name="actualSpend"
                  type="number"
                  inputMode="decimal"
                  defaultValue={project?.actualSpend ?? 0}
                  required
                />
              </Field>
              <Field label="Survey Deviation">
                <Input
                  name="surveyDeviation"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  defaultValue={project?.surveyDeviation ?? 0}
                  required
                />
              </Field>
              </section>
              <div className="flex items-end">
                <Button type="submit">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Project
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
