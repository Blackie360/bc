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

const kenyaCounties = [
  "Baringo",
  "Bomet",
  "Bungoma",
  "Busia",
  "Elgeyo-Marakwet",
  "Embu",
  "Garissa",
  "Homa Bay",
  "Isiolo",
  "Kajiado",
  "Kakamega",
  "Kericho",
  "Kiambu",
  "Kilifi",
  "Kirinyaga",
  "Kisii",
  "Kisumu",
  "Kitui",
  "Kwale",
  "Laikipia",
  "Lamu",
  "Machakos",
  "Makueni",
  "Mandera",
  "Marsabit",
  "Meru",
  "Migori",
  "Mombasa",
  "Murang'a",
  "Nairobi",
  "Nakuru",
  "Nandi",
  "Narok",
  "Nyamira",
  "Nyandarua",
  "Nyeri",
  "Samburu",
  "Siaya",
  "Taita-Taveta",
  "Tana River",
  "Tharaka-Nithi",
  "Trans Nzoia",
  "Turkana",
  "Uasin Gishu",
  "Vihiga",
  "Wajir",
  "West Pokot",
] as const;

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
  accept,
}: {
  id: string;
  name: string;
  required?: boolean;
  accept?: string;
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
        accept={accept}
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
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="pboqMode" value="request" />
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Project Start Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Opportunity Number">
            <Input name="opportunityNumber" required />
          </Field>
          <Field label="Date Requested">
            <Input name="dateRequested" type="date" defaultValue={todayDate} required />
          </Field>
          <Field label="Client">
            <Input name="customerName" required />
          </Field>
          <Field label="MRR">
            <Input name="mrr" type="number" inputMode="decimal" min="0" step="0.01" required />
          </Field>
          <Field label="NRR">
            <Input name="nrr" type="number" inputMode="decimal" min="0" step="0.01" required />
          </Field>
          <Field label="Contract Term">
            <Select name="contractTermMonths" defaultValue="12">
              <option value="12">12 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
            </Select>
          </Field>
          <Field label="Site Name">
            <Input name="siteName" required />
          </Field>
          <Field label="Site Coordinates">
            <Input
              name="siteCoordinates"
              placeholder="1.2975 S, 36.8914 E"
              required
            />
          </Field>
          <Field label="Required Service">
            <Select name="requiredService" defaultValue="EPL">
              <option value="EPL">EPL</option>
              <option value="DIA">DIA</option>
              <option value="DFA">DFA</option>
            </Select>
          </Field>
          <Field label="Capacity">
            <Input name="capacity" placeholder="e.g. 1 Gbps" required />
          </Field>
          <Field label="Sales Requestor">
            <div className="flex h-10 items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-3 text-sm">
              {accountManagerDisplayName}
            </div>
            <input type="hidden" name="salesRequestor" value={accountManagerDisplayName} />
          </Field>
          <Field label="Lead Network Planner">
            <Input name="leadNetworkPlanner" required />
          </Field>
          <Field label="Region">
            <>
              <Input
                name="region"
                list="kenya-counties"
                defaultValue={kenyaCounties[0]}
                placeholder="Start typing a county name..."
                required
              />
              <datalist id="kenya-counties">
                {kenyaCounties.map((county) => (
                  <option key={county} value={county} />
                ))}
              </datalist>
            </>
          </Field>
        </CardContent>
      </Card>

      <FormSubmitButton pendingLabel="Submitting PBOQ…">
        <Save className="h-4 w-4" aria-hidden="true" />
        Request PBOQ
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
                  {["Link", "Build", "Material", "Wayleave", "Notes", "Action"].map((label) => (
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
                      <Input name={`pboqLines[${index}][build]`} type="number" inputMode="decimal" min="0" step="0.01" required />
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][material]`} type="number" inputMode="decimal" min="0" step="0.01" required />
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
          <p className="mt-2 text-xs font-normal text-[color:var(--color-muted)]">
            Final PBOQ upload is required. Proof Excels are optional (.xls / .xlsx).
            If you attach any of Build / Material / Wayleave proofs, attach all three—or use Summary only.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Final PBOQ File">
            <FileUploadField id="pboqFile" name="pboqFile" required />
          </Field>
          <Field label="Fiber Planning Notes">
            <Textarea name="fiberPlanningNotes" />
          </Field>
          <Field label="Summary Proof Excel (optional)">
            <FileUploadField
              id="summaryProofFile"
              name="summaryProofFile"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />
          </Field>
          <Field label="Build Proof Excel (optional)">
            <FileUploadField
              id="buildProofFile"
              name="buildProofFile"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />
          </Field>
          <Field label="Material Proof Excel (optional)">
            <FileUploadField
              id="materialProofFile"
              name="materialProofFile"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />
          </Field>
          <Field label="Wayleave Proof Excel (optional)">
            <FileUploadField
              id="wayleaveProofFile"
              name="wayleaveProofFile"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />
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
        (total, line) => total + line.material + line.build + line.wayleave,
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
