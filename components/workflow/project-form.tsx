"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import { readFormFieldValue } from "@/lib/project-lifecycle-storage";
import type { ProjectRecord } from "@/lib/project-record-types";
import { roleRoutes, roles, workflowStates } from "@/lib/workflow";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--color-muted-strong)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ProjectForm({
  action,
  badgeLabel = "Admin",
  dashboardHref = "/roles",
  project,
  projectsHref = "/projects",
  showWorkflowLinks = true,
  title,
}: {
  action: (formData: FormData) => void | Promise<void>;
  badgeLabel?: string;
  dashboardHref?: string;
  project?: ProjectRecord;
  projectsHref?: string;
  showWorkflowLinks?: boolean;
  title: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const scopeKey = project?.id ?? "draft:project-edit";
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey,
      stage: "projectEdit",
      enabled: Boolean(project?.id),
      buildDraft: () => {
        const form = formRef.current;
        if (!form) {
          return { savedAt: new Date().toISOString() };
        }

        return {
          savedAt: new Date().toISOString(),
          customer: readFormFieldValue(form, "customer"),
          region: readFormFieldValue(form, "region"),
          title: readFormFieldValue(form, "title"),
          owner: readFormFieldValue(form, "owner"),
          state: readFormFieldValue(form, "state"),
          roleQueue: readFormFieldValue(form, "roleQueue"),
          type: readFormFieldValue(form, "type") as "Ordinary BC" | "Margin Analysis BC",
          due: readFormFieldValue(form, "due"),
          irr: readFormFieldValue(form, "irr"),
          payback: readFormFieldValue(form, "payback"),
          capex: readFormFieldValue(form, "capex"),
          subsidy: readFormFieldValue(form, "subsidy"),
          approvedBudget: readFormFieldValue(form, "approvedBudget"),
          actualSpend: readFormFieldValue(form, "actualSpend"),
          surveyDeviation: readFormFieldValue(form, "surveyDeviation"),
        };
      },
    });

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady]);

  const draft = restoredDraft;

  return (
    <AdminShell
      code="PRJ"
      title="Project Management"
      subtitle="Create and maintain workflow records"
      badgeLabel={badgeLabel}
      primaryActive="projects"
      workflowLinks={roleRoutes.map((route) => ({ href: route.href, label: route.role }))}
      showWorkflowLinks={showWorkflowLinks}
      dashboardHref={dashboardHref}
      projectsHref={projectsHref}
    >
      <ShellHeading
        title={title}
        subtitle="Capture core project, queue, and financial data."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={projectsHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Projects
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-4 px-6 pb-8 pt-6">
        <Card>
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <CardTitle className="text-sm">Project Form</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {!isReady && project?.id ? (
              <p className="text-sm text-[color:var(--color-muted)]">Loading saved draft…</p>
            ) : (
            <form
              ref={formRef}
              action={action}
              className="space-y-5"
              onSubmit={() => clearDraft()}
            >
              {project?.id ? (
                <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
              ) : null}
              <section className="grid gap-4 md:grid-cols-2">
                <h2 className="text-sm font-semibold text-[color:var(--color-primary)] md:col-span-2">
                  Basic Information
                </h2>
                <Field label="Customer">
                  <Input
                    name="customer"
                    autoComplete="off"
                    defaultValue={draft?.customer ?? project?.customer}
                    placeholder="Kijani Retail Group…"
                    required
                  />
                </Field>
                <Field label="Region">
                  <Input
                    name="region"
                    autoComplete="off"
                    defaultValue={draft?.region ?? project?.region}
                    placeholder="Nairobi…"
                    required
                  />
                </Field>
                <Field label="Project Title">
                  <Textarea
                    name="title"
                    autoComplete="off"
                    defaultValue={draft?.title ?? project?.title}
                    placeholder="Metro fiber build…"
                    required
                  />
                </Field>
                <Field label="Owner">
                  <Input
                    name="owner"
                    autoComplete="off"
                    defaultValue={draft?.owner ?? project?.owner}
                    placeholder="A. Mwangi…"
                    required
                  />
                </Field>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <h2 className="text-sm font-semibold text-[color:var(--color-primary)] md:col-span-2">
                  Workflow Routing
                </h2>
                <Field label="Lifecycle Stage">
                  <Select name="state" defaultValue={draft?.state ?? project?.state ?? workflowStates[0]}>
                    {workflowStates.map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Role Queue">
                  <Select name="roleQueue" defaultValue={draft?.roleQueue ?? project?.roleQueue ?? roles[0]}>
                    {roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="BC Type">
                  <Select name="type" defaultValue={draft?.type ?? project?.type ?? "Ordinary BC"}>
                    <option>Ordinary BC</option>
                    <option>Margin Analysis BC</option>
                  </Select>
                </Field>
                <Field label="Due">
                  <Input
                    name="due"
                    autoComplete="off"
                    defaultValue={draft?.due ?? project?.due ?? "Today"}
                    placeholder="Today…"
                    required
                  />
                </Field>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <h2 className="text-sm font-semibold text-[color:var(--color-primary)] md:col-span-2">
                  Financial Inputs
                </h2>
                <Field label="IRR">
                  <Input
                    name="irr"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    defaultValue={draft?.irr ?? project?.irr ?? 18}
                    required
                  />
                </Field>
                <Field label="Payback Months">
                  <Input
                    name="payback"
                    type="number"
                    inputMode="numeric"
                    defaultValue={draft?.payback ?? project?.payback ?? 36}
                    required
                  />
                </Field>
                <Field label="Capex">
                  <Input
                    name="capex"
                    type="number"
                    inputMode="decimal"
                    defaultValue={draft?.capex ?? project?.capex ?? 0}
                    required
                  />
                </Field>
                <Field label="Subsidy Requirement">
                  <Input
                    name="subsidy"
                    type="number"
                    inputMode="decimal"
                    defaultValue={draft?.subsidy ?? project?.subsidy ?? 0}
                    required
                  />
                </Field>
                <Field label="Approved Budget">
                  <Input
                    name="approvedBudget"
                    type="number"
                    inputMode="decimal"
                    defaultValue={draft?.approvedBudget ?? project?.approvedBudget ?? 0}
                    required
                  />
                </Field>
                <Field label="Actual Spend">
                  <Input
                    name="actualSpend"
                    type="number"
                    inputMode="decimal"
                    defaultValue={draft?.actualSpend ?? project?.actualSpend ?? 0}
                    required
                  />
                </Field>
                <Field label="Survey Deviation">
                  <Input
                    name="surveyDeviation"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    defaultValue={draft?.surveyDeviation ?? project?.surveyDeviation ?? 0}
                    required
                  />
                </Field>
              </section>
              <div className="flex items-end">
                <FormSubmitButton pendingLabel="Saving project…">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Project
                </FormSubmitButton>
              </div>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
