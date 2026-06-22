"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import {
  lifecycleDraftScopes,
  readFormFieldValue,
  readIndexedFormRows,
  readFileMetadata,
  type BcSubmissionDraft,
  type BcSubmissionLinkDraft,
} from "@/lib/project-lifecycle-storage";
import { cn } from "@/lib/utils";

type LinkRow = {
  id: number;
} & BcSubmissionLinkDraft;

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
  accept,
  defaultFileName,
  className,
}: {
  id: string;
  name: string;
  required?: boolean;
  accept?: string;
  defaultFileName?: string;
  className?: string;
}) {
  const [fileName, setFileName] = useState(defaultFileName ?? "No file selected");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextName = event.currentTarget.files?.[0]?.name;
    setFileName(nextName && nextName.length > 0 ? nextName : "No file selected");
  }

  return (
    <div
      className={cn(
        "flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-white px-2.5 py-1",
        className,
      )}
    >
      <label
        htmlFor={id}
        className="inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md bg-[color:var(--color-surface-soft)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-muted-strong)] outline-none ring-inset hover:bg-[color:var(--color-primary-soft)] hover:text-[color:var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
      >
        Choose file
      </label>
      <span
        className="min-w-0 flex-1 truncate text-left text-xs text-[color:var(--color-muted-strong)]"
        title={fileName}
      >
        {fileName}
      </span>
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

function nrcTotal(parts: Record<string, string>) {
  return ["newBuildCost", "provisioningCost", "materialCost", "wayleaveCost"].reduce(
    (total, key) => total + (Number(parts[key]) || 0),
    0,
  );
}

function numberOrZero(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRowsFromDraft(links?: BcSubmissionLinkDraft[]): LinkRow[] {
  if (!links || links.length === 0) {
    return [{ id: 1 }];
  }

  return links.map((link, index) => ({
    id: index + 1,
    ...link,
  }));
}

function buildNrcPartsFromDraft(links?: BcSubmissionLinkDraft[]) {
  const parts: Record<number, Record<string, string>> = {};

  links?.forEach((link, index) => {
    parts[index + 1] = {
      newBuildCost: link.newBuildCost ?? "0",
      provisioningCost: link.provisioningCost ?? "0",
      materialCost: link.materialCost ?? "0",
      wayleaveCost: link.wayleaveCost ?? "0",
    };
  });

  return parts;
}

function buildBcSubmissionDraft(
  form: HTMLFormElement,
  rows: LinkRow[],
): BcSubmissionDraft {
  const readAttachment = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? readFileMetadata(input) : undefined;
  };

  return {
    savedAt: new Date().toISOString(),
    opportunityNumber: readFormFieldValue(form, "opportunityNumber"),
    customerName: readFormFieldValue(form, "customerName"),
    accountNumber: readFormFieldValue(form, "accountNumber"),
    solutionArchitectureName: readFormFieldValue(form, "solutionArchitectureName"),
    solutionEngineerName: readFormFieldValue(form, "solutionEngineerName"),
    contractTermMonths: readFormFieldValue(form, "contractTermMonths"),
    region: readFormFieldValue(form, "region"),
    projectExecutiveSummary: readFormFieldValue(form, "projectExecutiveSummary"),
    type: readFormFieldValue(form, "type") as BcSubmissionDraft["type"],
    pboqOrSurveyType: readFormFieldValue(form, "pboqOrSurveyType") as BcSubmissionDraft["pboqOrSurveyType"],
    irr: readFormFieldValue(form, "irr"),
    payback: readFormFieldValue(form, "payback"),
    capex: readFormFieldValue(form, "capex"),
    subsidy: readFormFieldValue(form, "subsidy"),
    approvedBudget: readFormFieldValue(form, "approvedBudget"),
    nrv: readFormFieldValue(form, "nrv"),
    tcv: readFormFieldValue(form, "tcv"),
    exchangeRateKesUsd: readFormFieldValue(form, "exchangeRateKesUsd"),
    lsoAttachment: readAttachment("lsoAttachment"),
    bcTemplate: readAttachment("bcTemplate"),
    pboqOrSurveyAttachment: readAttachment("pboqOrSurveyAttachment"),
    thirdPartyQuotesAttachment: readAttachment("thirdPartyQuotesAttachment"),
    links: readIndexedFormRows<BcSubmissionLinkDraft>(form, "links", [
      "linkName",
      "service",
      "technology",
      "onnetOffnet",
      "costSource",
      "newBuildCost",
      "provisioningCost",
      "materialCost",
      "wayleaveCost",
      "mrr",
      "mrc",
      "nrc",
      "nrr",
      "nrv",
      "tcv",
      "onnetCapacity",
      "offnetCapacity",
    ]),
    linkEvidenceAttachments: rows
      .map((_row, index) => readAttachment(`linkEvidence-${index}`))
      .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment)),
  };
}

export function BcSubmissionForm({
  action,
  accountManagerDisplayName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  accountManagerDisplayName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<LinkRow[]>([{ id: 1 }]);
  const [nrcParts, setNrcParts] = useState<Record<number, Record<string, string>>>({});
  const [subsidyRequirement, setSubsidyRequirement] = useState("");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey: lifecycleDraftScopes.bcSubmission,
      stage: "bcSubmission",
      buildDraft: () => {
        const form = formRef.current;
        if (!form) {
          return { savedAt: new Date().toISOString() };
        }

        return buildBcSubmissionDraft(form, rows);
      },
      deps: [rows, nrcParts],
    });
  const draft = restoredDraft;

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (restoredDraft?.links?.length) {
        setRows(buildRowsFromDraft(restoredDraft.links));
        setNrcParts(buildNrcPartsFromDraft(restoredDraft.links));
      }

      setHasRestoredDraft(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, restoredDraft]);

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady, rows, nrcParts]);

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
    setNrcParts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateNrcPart(rowId: number, field: string, value: string) {
    setNrcParts((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        [field]: value,
      },
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent =
      submitter instanceof HTMLButtonElement && submitter.name === "intent"
        ? submitter.value
        : "submit";

    if (intent === "submit") {
      clearDraft();
    }
  }

  if (!isReady || !hasRestoredDraft) {
    return <p className="text-sm text-[color:var(--color-muted)]">Loading saved draft…</p>;
  }

  const routesToSalesOperations = shouldRouteSubsidyToSalesOperations(
    numberOrZero(subsidyRequirement),
  );
  const submitRouteLabel = routesToSalesOperations ? "Sales Ops" : "Finance";

  return (
    <form ref={formRef} action={action} className="space-y-4" onSubmit={handleSubmit}>
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">BC Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Customer Name">
            <Input
              name="customerName"
              autoComplete="organization"
              defaultValue={draft?.customerName}
              required
            />
            
          </Field>
          <Field label="Account Number">
            <Input name="accountNumber" defaultValue={draft?.accountNumber} required />
            <FileUploadField
              id="bcTemplate"
              name="bcTemplate"
              accept=".xlsx,.xls,.csv"
              required
              defaultFileName={draft?.bcTemplate?.name}
            />
          </Field>
          <Field label="Opportunity Number">
            <Input
              name="opportunityNumber"
              autoComplete="off"
              defaultValue={draft?.opportunityNumber}
              required
            />
            <Select name="pboqOrSurveyType" defaultValue={draft?.pboqOrSurveyType ?? "PBOQ"}>
              <option value="PBOQ">PBOQ</option>
              <option value="ACTUAL_SURVEY">Actual survey per site</option>
            </Select>
            <FileUploadField
              id="pboqOrSurveyAttachment"
              name="pboqOrSurveyAttachment"
              required
              defaultFileName={draft?.pboqOrSurveyAttachment?.name}
            />
          </Field>
          <Field label="Account Manager">
            <div className="flex h-10 w-full items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-3 text-sm text-[color:var(--color-muted-strong)]">
              {accountManagerDisplayName}
            </div>
            <FileUploadField
              id="thirdPartyQuotesAttachment"
              name="thirdPartyQuotesAttachment"
              defaultFileName={draft?.thirdPartyQuotesAttachment?.name}
            />
          </Field>
          <Field label="Solution Architecture">
            <Input
              name="solutionArchitectureName"
              autoComplete="off"
              defaultValue={draft?.solutionArchitectureName}
              required
            />
          </Field>
          <Field label="Engineering">
            <Input
              name="solutionEngineerName"
              autoComplete="off"
              defaultValue={draft?.solutionEngineerName}
              required
            />
          </Field>
          <Field label="Contract Term">
            <Select name="contractTermMonths" defaultValue={draft?.contractTermMonths ?? "12"}>
              <option value="12">12 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
            </Select>
          </Field>
          <Field label="Region">
            <Input name="region" autoComplete="off" defaultValue={draft?.region} required />
          </Field>
          <FileUploadField
              id="lsoAttachment"
              name="lsoAttachment"
              required
              defaultFileName={draft?.lsoAttachment?.name}
            />
          <Field label="Project Executive Summary">
            <Textarea
              name="projectExecutiveSummary"
              rows={4}
              defaultValue={draft?.projectExecutiveSummary}
              required
              className="md:col-span-2"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Finance Inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <Field label="BC Type">
            <Select name="type" defaultValue={draft?.type ?? "Ordinary BC"}>
              <option>Ordinary BC</option>
              <option>Margin Analysis BC</option>
            </Select>
          </Field>
          <Field label="IRR">
            <Input
              name="irr"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={draft?.irr}
              required
            />
            <FieldHint>Internal Rate of Return (projected annual ROI percentage).</FieldHint>
          </Field>
          <Field label="Payback Months">
            <Input
              name="payback"
              type="number"
              inputMode="numeric"
              defaultValue={draft?.payback}
              required
            />
          </Field>
          <Field label="Capex">
            <Input
              name="capex"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={draft?.capex}
              required
            />
          </Field>
          <Field label="Subsidy Requirement">
            <Input
              name="subsidy"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={subsidyRequirement}
              onChange={(event) => setSubsidyRequirement(event.currentTarget.value)}
              required
            />
          </Field>
          <Field label="Approved Budget">
            <Input
              name="approvedBudget"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={draft?.approvedBudget}
              required
            />
          </Field>
          <Field label="NRV (USD)">
            <Input
              name="nrv"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={draft?.nrv}
              required
            />
          </Field>
          <Field label="TCV (USD)">
            <Input
              name="tcv"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={draft?.tcv}
              required
            />
          </Field>
          <Field label="Exchange Rate (KES/USD)">
            <Input
              name="exchangeRateKesUsd"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              defaultValue={draft?.exchangeRateKesUsd}
              required
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">BC Links</CardTitle>
          <Button type="button" size="sm" variant="secondary" onClick={addRow}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Link
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="space-y-3 rounded-md border border-[color:var(--color-border)] p-3"
            >
              <div className="grid gap-3 md:grid-cols-6">
                <Field label="Link Name">
                  <Input name={`links[${index}][linkName]`} defaultValue={row.linkName} required />
                </Field>
                <Field label="Service">
                  <Select name={`links[${index}][service]`} defaultValue={row.service ?? "DIA"} required>
                    <option>DIA</option>
                    <option>MPLS</option>
                    <option>EPL</option>
                    <option>DFA</option>
                  </Select>
                </Field>
                <Field label="Technology">
                  <Input
                    name={`links[${index}][technology]`}
                    defaultValue={row.technology ?? "Fiber"}
                    required
                  />
                </Field>
                <Field label="Onnet / Offnet">
                  <Select
                    name={`links[${index}][onnetOffnet]`}
                    defaultValue={row.onnetOffnet ?? "Onnet"}
                    required
                  >
                    <option>Onnet</option>
                    <option>Offnet</option>
                  </Select>
                </Field>
                <Field label="Source">
                  <Select
                    name={`links[${index}][costSource]`}
                    defaultValue={row.costSource ?? "PBOQ"}
                    required
                  >
                    <option>PBOQ</option>
                    <option>Fibre Ready</option>
                    <option>Actual Survey</option>
                    <option>3rd Party Quote</option>
                  </Select>
                </Field>
                <Field label="Onnet Capacity">
                  <Input
                    name={`links[${index}][onnetCapacity]`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    defaultValue={row.onnetCapacity}
                    placeholder="e.g. 100"
                    className="text-right tabular-nums"
                  />
                </Field>
                <Field label="Offnet Capacity">
                  <Input
                    name={`links[${index}][offnetCapacity]`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    defaultValue={row.offnetCapacity}
                    placeholder="e.g. 100"
                    className="text-right tabular-nums"
                  />
                </Field>
                <Field label="Evidence">
                  <FileUploadField
                    id={`linkEvidence-${row.id}`}
                    name={`linkEvidence-${index}`}
                    required
                    defaultFileName={draft?.linkEvidenceAttachments?.[index]?.name}
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["newBuildCost", "New Build Cost"],
                  ["provisioningCost", "Provisioning Cost"],
                  ["materialCost", "Material Cost"],
                  ["wayleaveCost", "Wayleave Cost-Estimates"],
                ].map(([name, label]) => (
                  <Field key={name} label={label}>
                    <Input
                      name={`links[${index}][${name}]`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      defaultValue={row[name as keyof BcSubmissionLinkDraft] ?? nrcParts[row.id]?.[name]}
                      required
                      onChange={(event) =>
                        updateNrcPart(row.id, name, event.currentTarget.value)
                      }
                    />
                  </Field>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="NRC Total">
                  <Input type="number" readOnly value={nrcTotal(nrcParts[row.id] ?? {})} />
                  <input
                    type="hidden"
                    name={`links[${index}][nrc]`}
                    value={nrcTotal(nrcParts[row.id] ?? {})}
                  />
                </Field>
                <Field label="MRC">
                  <Input
                    name={`links[${index}][mrc]`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.mrc}
                    className="text-right tabular-nums"
                  />
                </Field>
                <Field label="MRR">
                  <Input
                    name={`links[${index}][mrr]`}
                    type="number"
                    step="0.1"
                    min="0"
                    defaultValue={row.mrr}
                    className="text-right tabular-nums"
                    required
                  />
                </Field>
                <Field label="NRR">
                  <Input
                    name={`links[${index}][nrr]`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.nrr}
                    className="text-right tabular-nums"
                  />
                </Field>
                <Field label="NRV(USD)">
                  <Input
                    name={`links[${index}][nrv]`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.nrv}
                  />
                </Field>
                <Field label="TCV(USD)">
                  <Input
                    name={`links[${index}][tcv]`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.tcv}
                  />
                </Field>
              </div>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="warning"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove link
                </Button>
              ) : null}
            </div>
          ))}
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
          Submit BC to {submitRouteLabel}
        </FormSubmitButton>
      </div>
    </form>
  );
}
