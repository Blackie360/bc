"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type LinkRow = {
  id: number;
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
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<LinkRow[]>([{ id: 1 }]);

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
            <Input name="accountManagerName" autoComplete="name" required />
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
          </Field>
          <Field label="Payback Months">
            <Input name="payback" type="number" inputMode="numeric" required />
          </Field>
          <Field label="Capex">
            <Input name="capex" type="number" inputMode="decimal" step="0.01" required />
          </Field>
          <Field label="Subsidy Requirement">
            <Input name="subsidy" type="number" inputMode="decimal" step="0.01" required />
          </Field>
          <Field label="Approved Budget">
            <Input
              name="approvedBudget"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
            />
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
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <Input
                        name={`linkEvidence-${index}`}
                        type="file"
                        className="h-auto py-2"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="warning"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        aria-label="Remove link row"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
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
            <Input name="bcTemplate" type="file" className="h-auto py-2" required />
          </Field>
          <Field label="PBOQ File">
            <Input name="pboqFile" type="file" className="h-auto py-2" required />
          </Field>
          <Field label="Order Form">
            <Input name="orderForm" type="file" className="h-auto py-2" required />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-end">
        <Button type="submit">
          <Save className="h-4 w-4" aria-hidden="true" />
          Submit to Finance
        </Button>
      </div>
    </form>
  );
}
