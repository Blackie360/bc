"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectRecord } from "@/lib/projects";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--color-muted-strong)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FileUploadField({
  id,
  name,
  required,
}: {
  id: string;
  name: string;
  required?: boolean;
}) {
  const [fileName, setFileName] = useState("No file selected");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextName = event.currentTarget.files?.[0]?.name;
    setFileName(nextName && nextName.length > 0 ? nextName : "No file selected");
  }

  return (
    <div className="flex h-10 items-center gap-3 rounded-md border border-[color:var(--color-border)] bg-white px-2">
      <label
        htmlFor={id}
        className="cursor-pointer rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-2 py-1 text-xs font-medium text-[color:var(--color-muted-strong)]"
      >
        Choose File
      </label>
      <span className="truncate text-xs text-[color:var(--color-muted-strong)]">{fileName}</span>
      <input
        id={id}
        name={name}
        type="file"
        required={required}
        onChange={handleChange}
        className="sr-only"
      />
    </div>
  );
}

type Row = { id: number };

export function PboqRequestForm({
  action,
  accountManagerDisplayName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  accountManagerDisplayName: string;
}) {
  const [surveyAvailable, setSurveyAvailable] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Opportunity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Opportunity Number">
            <Input name="opportunityNumber" required />
          </Field>
          <Field label="Client / Customer">
            <Input name="customerName" required />
          </Field>
          <Field label="Opportunity Name">
            <Input name="opportunityName" required />
          </Field>
          <Field label="Account Manager">
            <div className="flex h-10 items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-3 text-sm">
              {accountManagerDisplayName}
            </div>
          </Field>
          <Field label="Region">
            <Input name="region" required />
          </Field>
          <Field label="Segment">
            <Input name="segment" defaultValue="Enterprise" required />
          </Field>
          <Field label="MRR">
            <Input name="mrr" type="number" inputMode="decimal" min="0" step="0.01" required />
          </Field>
          <Field label="NRR">
            <Input name="nrr" type="number" inputMode="decimal" min="0" step="0.01" required />
          </Field>
          <Field label="Contract Term Months">
            <Input name="contractTermMonths" type="number" inputMode="numeric" min="1" defaultValue={12} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">PBOQ Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Route Distance Km">
            <Input name="routeDistanceKm" type="number" inputMode="decimal" min="0.01" step="0.01" required />
          </Field>
          <Field label="Site Count">
            <Input name="siteCount" type="number" inputMode="numeric" min="1" required />
          </Field>
          <Field label="Survey Available">
            <Select
              name="surveyAvailable"
              defaultValue="no"
              onChange={(event) => setSurveyAvailable(event.currentTarget.value === "yes")}
            >
              <option value="no">No survey yet</option>
              <option value="yes">Survey already conducted</option>
            </Select>
          </Field>
          {surveyAvailable ? (
            <Field label="Actual Survey Cost">
              <Input name="actualSurveyCost" type="number" inputMode="decimal" min="0.01" step="0.01" required />
            </Field>
          ) : (
            <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] p-3 text-sm text-[color:var(--color-muted-strong)]">
              <input type="hidden" name="actualSurveyCost" value="0" />
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                Cost source
              </p>
              <p className="mt-2 font-medium">PBOQ estimate from Fiber Planning</p>
            </div>
          )}
          <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3 text-sm text-[color:var(--color-muted-strong)] md:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
              Workflow impact
            </p>
            <p className="mt-2">
              {surveyAvailable
                ? "The BC will default to the actual survey cost and SDU should not initiate a new survey later."
                : "The BC will default to Fiber Planning PBOQ costs, and SDU can initiate the actual survey later."}
            </p>
          </div>
          <Field label="Solution Design">
            <FileUploadField id="solutionDesign" name="solutionDesign" required />
          </Field>
          <Field label="Request Notes">
            <Textarea name="notes" />
          </Field>
        </CardContent>
      </Card>

      <FormSubmitButton pendingLabel="Submitting PBOQ…">
        <Save className="h-4 w-4" aria-hidden="true" />
        Submit PBOQ Request
      </FormSubmitButton>
    </form>
  );
}

export function FiberPlanningForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>([{ id: 1 }]);

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">PBOQ Cost Lines</CardTitle>
          <Button type="button" size="sm" variant="secondary" onClick={addRow}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Line
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-[11px] uppercase text-[color:var(--color-muted)]">
                <tr>
                  {["Link", "Material", "Labor", "Wayleave", "Notes", "Action"].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][linkName]`} required />
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][material]`} type="number" inputMode="decimal" min="0" step="0.01" required />
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][labor]`} type="number" inputMode="decimal" min="0" step="0.01" required />
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][wayleave]`} type="number" inputMode="decimal" min="0" step="0.01" required />
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][notes]`} />
                    </td>
                    <td className="px-2 py-2">
                      {rows.length > 1 ? (
                        <Button type="button" size="icon" variant="warning" onClick={() => removeRow(row.id)} aria-label="Remove PBOQ row">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Planning Output</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Final PBOQ File">
            <FileUploadField id="pboqFile" name="pboqFile" required />
          </Field>
          <Field label="Fiber Planning Notes">
            <Textarea name="fiberPlanningNotes" />
          </Field>
        </CardContent>
      </Card>
      <FormSubmitButton pendingLabel="Completing planning…">
        <Save className="h-4 w-4" aria-hidden="true" />
        Complete Fiber Planning
      </FormSubmitButton>
    </form>
  );
}

export function PreparedBcForm({
  action,
  project,
}: {
  action: (formData: FormData) => void | Promise<void>;
  project: ProjectRecord;
}) {
  const pboqBudget = useMemo(
    () =>
      project.pboqRequest?.costLines.reduce(
        (total, line) => total + line.material + line.labor + line.wayleave,
        0,
      ) ?? 0,
    [project.pboqRequest?.costLines],
  );
  const actualSurveyCost = project.pboqRequest?.actualSurveyCost ?? 0;
  const usesActualSurveyCost =
    project.pboqRequest?.costSource === "ACTUAL_SURVEY" && actualSurveyCost > 0;
  const bcInputBudget = usesActualSurveyCost ? actualSurveyCost : pboqBudget;

  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">BC Assignments</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Solutions Architect">
            <Input name="solutionArchitectureName" required />
          </Field>
          <Field label="Solutions Engineer">
            <Input name="solutionEngineerName" required />
          </Field>
          <Field label="BC Type">
            <Select name="type" defaultValue="Ordinary BC">
              <option>Ordinary BC</option>
              <option>Margin Analysis BC</option>
            </Select>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Financial Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] p-3 text-sm md:col-span-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
              BC cost input
            </p>
            <p className="mt-2 font-medium text-[color:var(--color-primary)]">
              {usesActualSurveyCost
                ? `Actual survey cost: ${actualSurveyCost.toLocaleString("en-US")}`
                : `PBOQ estimate: ${pboqBudget.toLocaleString("en-US")}`}
            </p>
          </div>
          <Field label="IRR">
            <Input name="irr" type="number" inputMode="decimal" step="0.1" required />
          </Field>
          <Field label="Payback Months">
            <Input name="payback" type="number" inputMode="numeric" min="1" required />
          </Field>
          <Field label="Capex">
            <Input name="capex" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={bcInputBudget} required />
          </Field>
          <Field label="Subsidy Requirement">
            <Input name="subsidy" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={0} required />
          </Field>
          <Field label="Approved Budget">
            <Input name="approvedBudget" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={bcInputBudget} required />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Required Attachments</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="BC Template">
            <FileUploadField id="bcTemplate" name="bcTemplate" required />
          </Field>
          <Field label="Order Form">
            <FileUploadField id="orderForm" name="orderForm" required />
          </Field>
        </CardContent>
      </Card>
      <FormSubmitButton pendingLabel="Submitting BC…">
        <Save className="h-4 w-4" aria-hidden="true" />
        Submit BC
      </FormSubmitButton>
    </form>
  );
}
