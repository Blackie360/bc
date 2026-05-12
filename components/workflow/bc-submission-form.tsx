"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type LinkRow = {
  id: number;
};

type LinkEvidenceTriggerFields = {
  material?: string;
  labor?: string;
  wayleave?: string;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--color-muted-strong)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs font-normal text-[color:var(--color-muted)]">{children}</p>;
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

const moneyFields = [
  ["material", "Material"],
  ["labor", "Labor"],
  ["wayleave", "Wayleave"],
  ["mrr", "MRR"],
  ["mrc", "MRC"],
  ["nrc", "NRC"],
  ["nrr", "NRR"],
] as const;

export function BcSubmissionForm({
  action,
  accountManagerDisplayName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** From the server (env / future auth). Not editable on this form. */
  accountManagerDisplayName: string;
}) {
  const [rows, setRows] = useState<LinkRow[]>([{ id: 1 }]);
  const [linkEvidenceTriggers, setLinkEvidenceTriggers] = useState<
    Record<number, LinkEvidenceTriggerFields>
  >({});

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
    setLinkEvidenceTriggers((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateEvidenceTriggerField(
    rowId: number,
    field: keyof LinkEvidenceTriggerFields,
    value: string,
  ) {
    setLinkEvidenceTriggers((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        [field]: value,
      },
    }));
  }

  function isFilled(value?: string) {
    return Boolean(value && value.trim().length > 0);
  }

  function shouldAskForPboqQuote(rowId: number) {
    const row = linkEvidenceTriggers[rowId];
    return (
      isFilled(row?.material) &&
      isFilled(row?.labor) &&
      isFilled(row?.wayleave)
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Opportunity Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Opportunity Number">
            <Input name="opportunityNumber" autoComplete="off" required />
          </Field>
          <Field label="Name of Customer">
            <Input name="customerName" autoComplete="organization" required />
          </Field>
          <Field label="Name of Solution Architecture">
            <Input name="solutionArchitectureName" autoComplete="off" required />
          </Field>
          <Field label="Solution Engineer">
            <Input name="solutionEngineerName" autoComplete="off" required />
          </Field>
          <Field label="Account Manager">
            <div
              className="flex h-10 w-full items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-3 text-sm text-[color:var(--color-muted-strong)]"
              title="Taken from current authenticated/session context"
            >
              {accountManagerDisplayName}
            </div>
          </Field>
          <Field label="Region">
            <Input name="region" autoComplete="off" required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Finance Inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <Field label="BC Type">
            <Select name="type" defaultValue="Ordinary BC">
              <option>Ordinary BC</option>
              <option>Margin Analysis BC</option>
            </Select>
          </Field>
          <Field label="IRR">
            <Input name="irr" type="number" inputMode="decimal" step="0.1" required />
            <FieldHint>Internal Rate of Return (projected annual ROI percentage).</FieldHint>
          </Field>
          <Field label="Payback Months">
            <Input name="payback" type="number" inputMode="numeric" required />
            <FieldHint>Time needed to recover total investment (in months).</FieldHint>
          </Field>
          <Field label="Capex">
            <Input name="capex" type="number" inputMode="decimal" step="0.01" required />
            <FieldHint>Total projected capital expenditure for delivery.</FieldHint>
          </Field>
          <Field label="Subsidy Requirement">
            <Input name="subsidy" type="number" inputMode="decimal" step="0.01" required />
            <FieldHint>Funding gap that requires subsidy support.</FieldHint>
          </Field>
          <Field label="Approved Budget">
            <Input
              name="approvedBudget"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
            />
            <FieldHint>Budget amount approved for implementation.</FieldHint>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <CardTitle className="text-sm">Link Items</CardTitle>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              Link name, material, labor, wayleave, and MRR require an Actual Survey Quote and PBOQ file.
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addRow}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Link
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="text-[11px] uppercase text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-2 py-2 font-medium">Link Name</th>
                  {moneyFields.map(([, label]) => (
                    <th key={label} className="px-2 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium">Actual Survey Quote</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2">
                      <Input name={`links[${index}][linkName]`} required />
                    </td>
                    {moneyFields.map(([name]) => (
                      <td key={name} className="px-2 py-2">
                        <Input
                          name={`links[${index}][${name}]`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          required
                          onChange={
                            name === "material" || name === "labor" || name === "wayleave"
                              ? (event) =>
                                  updateEvidenceTriggerField(row.id, name, event.currentTarget.value)
                              : undefined
                          }
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      {shouldAskForPboqQuote(row.id) ? (
                        <FileUploadField
                          id={`linkEvidence-${row.id}`}
                          name={`linkEvidence-${index}`}
                          required
                        />
                      ) : (
                        <p className="text-xs text-[color:var(--color-muted)]">
                          Fill Material, Labor, and Wayleave to add PBOQ / Quote.
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {rows.length > 1 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="warning"
                          onClick={() => removeRow(row.id)}
                          aria-label="Remove link row"
                        >
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
          <CardTitle className="text-sm">Required Attachments</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <Field label="BC Template">
            <FileUploadField id="bcTemplate" name="bcTemplate" required />
          </Field>
          <Field label="PBOQ File">
            <FileUploadField id="pboqFile" name="pboqFile" required />
          </Field>
          <Field label="Order Form">
            <FileUploadField id="orderForm" name="orderForm" required />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-end gap-2">
        <FormSubmitButton
          variant="secondary"
          pendingLabel="Saving draft…"
          name="intent"
          value="draft"
          formNoValidate
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Save as Draft
        </FormSubmitButton>
        <FormSubmitButton pendingLabel="Submitting…" name="intent" value="submit">
          <Save className="h-4 w-4" aria-hidden="true" />
          Submit BC to Finance
        </FormSubmitButton>
      </div>
    </form>
  );
}
