"use client";

import { ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import {
  lifecycleDraftScopes,
  readFormFieldValue,
  readIndexedFormRows,
  readFileMetadata,
  type FiberPlanningLineDraft,
  type PreparedBcDraft,
  readLifecycleStage,
} from "@/lib/project-lifecycle-storage";
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

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[color:var(--color-muted-strong)]">
      <span>
        {label}
        {required ? (
          <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function RequiredFieldLegend() {
  return (
    <p className="text-xs text-[color:var(--color-muted)]">
      <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
        *
      </span>{" "}
      Required field
    </p>
  );
}

function FileUploadField({
  id,
  name,
  required,
  accept,
  defaultFileName,
}: {
  id: string;
  name: string;
  required?: boolean;
  accept?: string;
  defaultFileName?: string;
}) {
  const [fileName, setFileName] = useState(defaultFileName ?? "No file selected");

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
  const formRef = useRef<HTMLFormElement>(null);
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey: lifecycleDraftScopes.pboqRequest,
      stage: "pboqRequest",
      buildDraft: () => {
        const form = formRef.current;
        if (!form) {
          return { savedAt: new Date().toISOString() };
        }

        return {
          savedAt: new Date().toISOString(),
          opportunityNumber: readFormFieldValue(form, "opportunityNumber"),
          dateRequested: readFormFieldValue(form, "dateRequested"),
          customerName: readFormFieldValue(form, "customerName"),
          mrr: readFormFieldValue(form, "mrr"),
          nrr: readFormFieldValue(form, "nrr"),
          contractTermMonths: readFormFieldValue(form, "contractTermMonths"),
          siteName: readFormFieldValue(form, "siteName"),
          siteCoordinates: readFormFieldValue(form, "siteCoordinates"),
          requiredService: readFormFieldValue(form, "requiredService") as
            | "EPL"
            | "DIA"
            | "DFA"
            | undefined,
          capacity: readFormFieldValue(form, "capacity"),
          leadNetworkPlanner: readFormFieldValue(form, "leadNetworkPlanner"),
          region: readFormFieldValue(form, "region"),
        };
      },
    });

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady]);

  if (!isReady) {
    return <p className="text-sm text-[color:var(--color-muted)]">Loading saved draft…</p>;
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4"
      onSubmit={() => clearDraft()}
    >
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
      <input type="hidden" name="pboqMode" value="request" />
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Project Start Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Opportunity Number">
            <Input
              name="opportunityNumber"
              defaultValue={restoredDraft?.opportunityNumber}
              required
            />
          </Field>
          <Field label="Date Requested">
            <Input
              name="dateRequested"
              type="date"
              defaultValue={restoredDraft?.dateRequested ?? todayDate}
              required
            />
          </Field>
          <Field label="Client">
            <Input name="customerName" defaultValue={restoredDraft?.customerName} required />
          </Field>
          <Field label="MRR">
            <Input
              name="mrr"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={restoredDraft?.mrr}
              required
            />
          </Field>
          <Field label="NRR">
            <Input
              name="nrr"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={restoredDraft?.nrr}
              required
            />
          </Field>
          <Field label="Contract Term">
            <Select
              name="contractTermMonths"
              defaultValue={restoredDraft?.contractTermMonths ?? "12"}
            >
              <option value="12">12 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
            </Select>
          </Field>
          <Field label="Site Name">
            <Input name="siteName" defaultValue={restoredDraft?.siteName} required />
          </Field>
          <Field label="Site Coordinates">
            <Input
              name="siteCoordinates"
              placeholder="1.2975 S, 36.8914 E"
              defaultValue={restoredDraft?.siteCoordinates}
              required
            />
          </Field>
          <Field label="Required Service">
            <Select
              name="requiredService"
              defaultValue={restoredDraft?.requiredService ?? "EPL"}
            >
              <option value="EPL">EPL</option>
              <option value="DIA">DIA</option>
              <option value="DFA">DFA</option>
            </Select>
          </Field>
          <Field label="Capacity">
            <Input
              name="capacity"
              placeholder="e.g. 1 Gbps"
              defaultValue={restoredDraft?.capacity}
              required
            />
          </Field>
          <Field label="Sales Requestor">
            <div className="flex h-10 items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-3 text-sm">
              {accountManagerDisplayName}
            </div>
            <input type="hidden" name="salesRequestor" value={accountManagerDisplayName} />
          </Field>
          <Field label="Lead Network Planner">
            <Input
              name="leadNetworkPlanner"
              defaultValue={restoredDraft?.leadNetworkPlanner}
              required
            />
          </Field>
          <Field label="Region">
            <>
              <Input
                name="region"
                list="kenya-counties"
                defaultValue={restoredDraft?.region ?? kenyaCounties[0]}
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

function buildFiberPlanningRowsFromDraft(lines?: FiberPlanningLineDraft[]): Row[] {
  if (!lines || lines.length === 0) {
    return [{ id: 1 }];
  }

  return lines.map((line, index) => ({
    id: index + 1,
    ...line,
  }));
}

type FiberPlanningRow = Row & FiberPlanningLineDraft;

export function FiberPlanningForm({
  action,
  projectId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projectId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<FiberPlanningRow[]>([{ id: 1 }]);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey: projectId,
      stage: "fiberPlanning",
      buildDraft: () => {
        const form = formRef.current;
        if (!form) {
          return { savedAt: new Date().toISOString() };
        }

        const input = form.elements.namedItem("pboqFile");
        const pboqFile =
          input instanceof HTMLInputElement
            ? readFileMetadata(input)
            : readLifecycleStage(projectId, "fiberPlanning")?.pboqFile;

        return {
          savedAt: new Date().toISOString(),
          fiberPlanningNotes: readFormFieldValue(form, "fiberPlanningNotes"),
          lines: readIndexedFormRows<FiberPlanningLineDraft>(
            form,
            "pboqLines",
            ["linkName", "material", "build", "wayleave", "notes"],
          ),
          pboqFile,
        };
      },
      deps: [rows, projectId],
    });

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (restoredDraft?.lines?.length) {
      setRows(buildFiberPlanningRowsFromDraft(restoredDraft.lines) as FiberPlanningRow[]);
    }

    setHasRestoredDraft(true);
  }, [isReady, restoredDraft]);

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady, rows]);

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }

  if (!isReady || !hasRestoredDraft) {
    return <p className="text-sm text-[color:var(--color-muted)]">Loading saved draft…</p>;
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4"
      onSubmit={() => clearDraft()}
    >
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />
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
                      <Input
                        name={`pboqLines[${index}][linkName]`}
                        defaultValue={row.linkName}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`pboqLines[${index}][build]`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        defaultValue={row.build}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`pboqLines[${index}][material]`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        defaultValue={row.material}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`pboqLines[${index}][wayleave]`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        defaultValue={row.wayleave}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][notes]`} defaultValue={row.notes} />
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
            <FileUploadField
              id="pboqFile"
              name="pboqFile"
              required
              defaultFileName={restoredDraft?.pboqFile?.name}
            />
          </Field>
          <Field label="Fiber Planning Notes">
            <Textarea
              name="fiberPlanningNotes"
              defaultValue={restoredDraft?.fiberPlanningNotes}
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

type LinkRowState = {
  id: number;
  linkName?: string;
  service?: string;
  technology?: string;
  onnetOffnet?: "Onnet" | "Offnet";
  costSource?: "PBOQ" | "Actual Survey" | "3rd Party Quote";
  onnetCapacity?: string;
  offnetCapacity?: string;
  newBuildCost?: string;
  provisioningCost?: string;
  materialCost?: string;
  wayleaveCost?: string;
  mrc?: string;
  mrr?: string;
  nrr?: string;
};

function defaultRevenueForNewRow(project: ProjectRecord, linkCount: number) {
  if (linkCount !== 1) {
    return { mrc: "0", mrr: "0", nrr: "0" };
  }

  return {
    mrc: "0",
    mrr: String(project.opportunityMrr),
    nrr: String(project.opportunityNrr),
  };
}

function mapDraftLinkToRow(
  link: NonNullable<PreparedBcDraft["links"]>[number],
  index: number,
): LinkRowState {
  return {
    id: index + 1,
    linkName: link.linkName,
    service: link.service ?? "DIA",
    technology: link.technology ?? "Fiber",
    onnetOffnet: link.onnetOffnet ?? "Onnet",
    costSource: link.costSource ?? "PBOQ",
    onnetCapacity: link.onnetCapacity,
    offnetCapacity: link.offnetCapacity,
    newBuildCost: link.newBuildCost,
    provisioningCost: link.provisioningCost,
    materialCost: link.materialCost,
    wayleaveCost: link.wayleaveCost,
    mrc: link.mrc,
    mrr: link.mrr,
    nrr: link.nrr,
  };
}

function buildInitialLinkRows(
  project: ProjectRecord,
  draft?: PreparedBcDraft | null,
): LinkRowState[] {
  if (draft?.links && draft.links.length > 0) {
    return draft.links.map(mapDraftLinkToRow);
  }

  if (project.links.length > 0) {
    return project.links.map((link, index) => ({
      id: index + 1,
      linkName: link.linkName,
      service: link.service || "DIA",
      technology: link.technology || "Fiber",
      onnetOffnet: link.onnetOffnet ?? "Onnet",
      costSource: link.costSource ?? "PBOQ",
      onnetCapacity: link.onnetCapacity ?? undefined,
      offnetCapacity: link.offnetCapacity ?? undefined,
      newBuildCost: String(link.newBuildCost),
      provisioningCost: String(link.provisioningCost),
      materialCost: String(link.materialCost),
      wayleaveCost: String(link.wayleaveCost),
      mrc: String(link.mrc),
      mrr: String(link.mrr),
      nrr: String(link.nrr),
    }));
  }

  const costLines = project.pboqRequest?.costLines ?? [];

  if (costLines.length === 0) {
    const revenue = defaultRevenueForNewRow(project, 1);
    return [
      {
        id: 1,
        onnetOffnet: "Onnet",
        service: "DIA",
        technology: "Fiber",
        costSource: "PBOQ",
        ...revenue,
      },
    ];
  }

  return costLines.map((line, index) => ({
    id: index + 1,
    linkName: line.linkName,
    onnetOffnet: "Onnet",
    service: "DIA",
    technology: "Fiber",
    costSource: "PBOQ",
    newBuildCost: String(line.build),
    materialCost: String(line.material),
    wayleaveCost: String(line.wayleave),
    ...defaultRevenueForNewRow(project, costLines.length),
  }));
}

function buildPreparedBcDraft(
  form: HTMLFormElement,
  activeTab: BcFormTab,
  rows: LinkRowState[],
): PreparedBcDraft {
  const readAttachment = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? readFileMetadata(input) : undefined;
  };

  return {
    savedAt: new Date().toISOString(),
    activeTab,
    accountNumber: readFormFieldValue(form, "accountNumber"),
    solutionArchitectureName: readFormFieldValue(form, "solutionArchitectureName"),
    solutionEngineerName: readFormFieldValue(form, "solutionEngineerName"),
    contractTermMonths: Number(readFormFieldValue(form, "contractTermMonths")) || undefined,
    projectExecutiveSummary: readFormFieldValue(form, "projectExecutiveSummary"),
    type: readFormFieldValue(form, "type") as PreparedBcDraft["type"],
    pboqOrSurveyType: readFormFieldValue(form, "pboqOrSurveyType") as PreparedBcDraft["pboqOrSurveyType"],
    irr: Number(readFormFieldValue(form, "irr")) || undefined,
    payback: Number(readFormFieldValue(form, "payback")) || undefined,
    capex: Number(readFormFieldValue(form, "capex")) || undefined,
    subsidy: Number(readFormFieldValue(form, "subsidy")) || undefined,
    approvedBudget: Number(readFormFieldValue(form, "approvedBudget")) || undefined,
    lsoAttachment: readAttachment("lsoAttachment"),
    bcTemplate: readAttachment("bcTemplate"),
    pboqOrSurveyAttachment: readAttachment("pboqOrSurveyAttachment"),
    thirdPartyQuotesAttachment: readAttachment("thirdPartyQuotesAttachment"),
    linkEvidenceAttachments: rows
      .map((_row, index) => readAttachment(`linkEvidence-${index}`))
      .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment)),
    links: rows.map((row, index) => ({
      linkName: readFormFieldValue(form, `links[${index}][linkName]`) || row.linkName,
      service: readFormFieldValue(form, `links[${index}][service]`) || row.service,
      technology: readFormFieldValue(form, `links[${index}][technology]`) || row.technology,
      onnetOffnet: row.onnetOffnet ?? "Onnet",
      costSource: readFormFieldValue(form, `links[${index}][costSource]`) as LinkRowState["costSource"],
      onnetCapacity: readFormFieldValue(form, `links[${index}][onnetCapacity]`) || row.onnetCapacity,
      offnetCapacity: readFormFieldValue(form, `links[${index}][offnetCapacity]`) || row.offnetCapacity,
      newBuildCost: row.newBuildCost,
      provisioningCost: row.provisioningCost,
      materialCost: row.materialCost,
      wayleaveCost: row.wayleaveCost,
      mrc: readFormFieldValue(form, `links[${index}][mrc]`) || row.mrc,
      mrr: readFormFieldValue(form, `links[${index}][mrr]`) || row.mrr,
      nrr: readFormFieldValue(form, `links[${index}][nrr]`) || row.nrr,
    })),
  };
}

function nrcTotalFromParts(parts: {
  newBuildCost?: string;
  provisioningCost?: string;
  materialCost?: string;
  wayleaveCost?: string;
}) {
  return (
    numberOrZero(parts.newBuildCost) +
    numberOrZero(parts.provisioningCost) +
    numberOrZero(parts.materialCost) +
    numberOrZero(parts.wayleaveCost)
  );
}

function numberOrZero(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const bcFormTabs = ["details", "links", "metrics"] as const;
type BcFormTab = (typeof bcFormTabs)[number];

function validateVisibleTabPanel(form: HTMLFormElement | null) {
  const panel = form?.querySelector('[role="tabpanel"]:not([hidden])');

  if (!panel) {
    return true;
  }

  const fields = panel.querySelectorAll("input, select, textarea");

  for (const field of fields) {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement
    ) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
  }

  return true;
}

export function PreparedBcForm({
  action,
  project,
}: {
  action: (formData: FormData) => void | Promise<void>;
  project: ProjectRecord;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<LinkRowState[]>(() => buildInitialLinkRows(project));
  const [activeTab, setActiveTab] = useState<BcFormTab>("details");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const { isReady, savedAtLabel, saveError, restoredDraft, clearDraft, bindFormAutoSave } =
    useFormLifecycleDraft({
      scopeKey: project.id,
      stage: "bcPreparation",
      buildDraft: () => {
        const form = formRef.current;
        if (!form) {
          return { savedAt: new Date().toISOString() };
        }

        return buildPreparedBcDraft(form, activeTab, rows);
      },
      deps: [activeTab, rows, project],
    });
  const savedDraft = restoredDraft;

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (restoredDraft) {
      setRows(buildInitialLinkRows(project, restoredDraft));
      setActiveTab(restoredDraft.activeTab ?? "details");
    }

    setHasRestoredDraft(true);
  }, [project, restoredDraft, isReady]);
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
  const hasExistingPboq = project.documents.some((document) => document.type === "PBOQ");

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady, activeTab, rows]);

  function addRow() {
    setRows((current) => {
      const nextCount = current.length + 1;
      const revenue = defaultRevenueForNewRow(project, nextCount);

      return [
        ...current,
        {
          id: Date.now(),
          onnetOffnet: "Onnet",
          service: "DIA",
          technology: "Fiber",
          costSource: "PBOQ",
          ...revenue,
        },
      ];
    });
  }

  function removeRow(id: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateRowOnnetOffnet(id: number, onnetOffnet: "Onnet" | "Offnet") {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              onnetOffnet,
              onnetCapacity: onnetOffnet === "Onnet" ? row.onnetCapacity : undefined,
              offnetCapacity: onnetOffnet === "Offnet" ? row.offnetCapacity : undefined,
            }
          : row,
      ),
    );
  }

  function handleSubmit() {
    clearDraft();
  }

  function goToNextTab() {
    if (!validateVisibleTabPanel(formRef.current)) {
      return;
    }

    const currentIndex = bcFormTabs.indexOf(activeTab);

    if (currentIndex < bcFormTabs.length - 1) {
      setActiveTab(bcFormTabs[currentIndex + 1]);
    }
  }

  const isFinalTab = activeTab === "metrics";

  if (!isReady || !hasRestoredDraft) {
    return (
      <p className="text-sm text-[color:var(--color-muted)]">Loading saved draft…</p>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-4" onSubmit={handleSubmit}>
      <RequiredFieldLegend />
      <DraftSavedNotice savedAtLabel={savedAtLabel} saveError={saveError} />

      <Card>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BcFormTab)} defaultValue="details">
          <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
            <TabsList className="w-full justify-start border-0 bg-transparent p-0">
              <TabsTrigger value="details">BC Details</TabsTrigger>
              <TabsTrigger value="links">BC Links</TabsTrigger>
              <TabsTrigger value="metrics">Financial Metrics</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="p-4">
            <TabsContent value="details">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Client Name" required>
                  <Input
                    name="customerName"
                    defaultValue={project.customer}
                    readOnly
                    required
                  />
                  <FileUploadField
                    id="lsoAttachment"
                    name="lsoAttachment"
                    required
                    defaultFileName={savedDraft?.lsoAttachment?.name}
                  />
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">Attachment: LSO</p>
                </Field>
                <Field label="Account Number" required>
                  <Input
                    name="accountNumber"
                    defaultValue={savedDraft?.accountNumber ?? project.accountNumber}
                    required
                  />
                  <FileUploadField
                    id="bcTemplate"
                    name="bcTemplate"
                    accept=".xlsx,.xls,.csv"
                    required
                    defaultFileName={savedDraft?.bcTemplate?.name}
                  />
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">
                    Attachment: BC template Excel
                  </p>
                </Field>
                <Field label="Opportunity Number" required>
                  <Input name="opportunityNumber" defaultValue={project.id} readOnly required />
                  {!hasExistingPboq ? (
                    <>
                      <Select
                        name="pboqOrSurveyType"
                        defaultValue={savedDraft?.pboqOrSurveyType ?? "PBOQ"}
                      >
                        <option value="PBOQ">PBOQ</option>
                        <option value="ACTUAL_SURVEY">Actual survey per site</option>
                      </Select>
                      <FileUploadField
                        id="pboqOrSurveyAttachment"
                        name="pboqOrSurveyAttachment"
                        defaultFileName={savedDraft?.pboqOrSurveyAttachment?.name}
                      />
                    </>
                  ) : (
                    <p className="text-xs font-normal text-[color:var(--color-muted)]">
                      PBOQ already attached from Fiber Planning.
                    </p>
                  )}
                </Field>
                <Field label="Account Manager" required>
                  <Input name="accountManagerName" defaultValue={project.owner} readOnly required />
                  <FileUploadField
                    id="thirdPartyQuotesAttachment"
                    name="thirdPartyQuotesAttachment"
                    defaultFileName={savedDraft?.thirdPartyQuotesAttachment?.name}
                  />
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">
                    Attachment: 3rd Party Quotes for offnet sites
                  </p>
                </Field>
                <Field label="Solution Architecture" required>
                  <Input
                    name="solutionArchitectureName"
                    defaultValue={
                      savedDraft?.solutionArchitectureName ?? project.solutionArchitectureName
                    }
                    required
                  />
                </Field>
                <Field label="Engineering" required>
                  <Input
                    name="solutionEngineerName"
                    defaultValue={savedDraft?.solutionEngineerName ?? project.solutionEngineerName}
                    required
                  />
                </Field>
                <Field label="Contract Term">
                  <Select
                    name="contractTermMonths"
                    defaultValue={String(
                      savedDraft?.contractTermMonths ?? (project.contractTermMonths || 12),
                    )}
                  >
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </Select>
                </Field>
                <Field label="BC Type">
                  <Select name="type" defaultValue={savedDraft?.type ?? project.type ?? "Ordinary BC"}>
                    <option>Ordinary BC</option>
                    <option>Margin Analysis BC</option>
                  </Select>
                </Field>
                <Field label="Project Executive Summary" required>
                  <Textarea
                    name="projectExecutiveSummary"
                    rows={4}
                    required
                    className="md:col-span-2"
                    defaultValue={savedDraft?.projectExecutiveSummary ?? project.projectExecutiveSummary}
                  />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="links">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">BC Links</CardTitle>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      One BC can include multiple links.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Link
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border border-[color:var(--color-border)]">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
                      <tr>
                        {[
                          { label: "#", required: false },
                          { label: "Link Name", required: true },
                          { label: "Service", required: true },
                          { label: "Technology", required: true },
                          { label: "Onnet / Offnet", required: true },
                          { label: "PBOQ / Actual Survey Source", required: true },
                          { label: "Capacity", required: false },
                          { label: "MRC", required: false },
                          { label: "MRR", required: true },
                          { label: "NRR", required: false },
                          { label: "Per-link Evidence", required: false },
                          { label: "Action", required: false },
                        ].map(({ label, required }) => (
                          <th key={label} className="px-2 py-3 font-medium whitespace-nowrap">
                            {label}
                            {required ? (
                              <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
                                {" "}
                                *
                              </span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--color-border)]">
                      {rows.map((row, index) => {
                        const onnetOffnet = row.onnetOffnet ?? "Onnet";

                        return (
                        <tr key={row.id}>
                          <td className="px-2 py-2 text-[color:var(--color-muted)]">{index + 1}</td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][linkName]`}
                              defaultValue={row.linkName}
                              required
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Select
                              name={`links[${index}][service]`}
                              defaultValue={row.service ?? "DIA"}
                              required
                            >
                              <option>DIA</option>
                              <option>MPLS</option>
                              <option>EPL</option>
                              <option>DFA</option>
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][technology]`}
                              defaultValue={row.technology ?? "Fiber"}
                              required
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Select
                              name={`links[${index}][onnetOffnet]`}
                              value={onnetOffnet}
                              onChange={(event) =>
                                updateRowOnnetOffnet(
                                  row.id,
                                  event.currentTarget.value as "Onnet" | "Offnet",
                                )
                              }
                              required
                            >
                              <option>Onnet</option>
                              <option>Offnet</option>
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <Select
                              name={`links[${index}][costSource]`}
                              defaultValue={row.costSource ?? "PBOQ"}
                              required
                            >
                              <option>PBOQ</option>
                              <option>Actual Survey</option>
                              <option>3rd Party Quote</option>
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            {onnetOffnet === "Onnet" ? (
                              <>
                                <Input
                                  key={`${row.id}-onnet`}
                                  name={`links[${index}][onnetCapacity]`}
                                  defaultValue={row.onnetCapacity}
                                  placeholder="Onnet capacity"
                                />
                                <input type="hidden" name={`links[${index}][offnetCapacity]`} value="" />
                              </>
                            ) : (
                              <>
                                <Input
                                  key={`${row.id}-offnet`}
                                  name={`links[${index}][offnetCapacity]`}
                                  defaultValue={row.offnetCapacity}
                                  placeholder="Offnet capacity"
                                />
                                <input type="hidden" name={`links[${index}][onnetCapacity]`} value="" />
                              </>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][mrc]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              defaultValue={row.mrc ?? "0"}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][mrr]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              defaultValue={row.mrr ?? "0"}
                              required
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][nrr]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              defaultValue={row.nrr ?? "0"}
                            />
                          </td>
                          <td className="px-2 py-2 min-w-[160px]">
                            <FileUploadField
                              id={`linkEvidence-${row.id}`}
                              name={`linkEvidence-${index}`}
                              defaultFileName={savedDraft?.linkEvidenceAttachments?.[index]?.name}
                            />
                          </td>
                          <td className="px-2 py-2">
                            {rows.length > 1 ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="warning"
                                onClick={() => removeRow(row.id)}
                                aria-label={`Remove link ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            ) : null}
                            <input
                              type="hidden"
                              name={`links[${index}][newBuildCost]`}
                              value={row.newBuildCost ?? "0"}
                            />
                            <input
                              type="hidden"
                              name={`links[${index}][provisioningCost]`}
                              value={row.provisioningCost ?? "0"}
                            />
                            <input
                              type="hidden"
                              name={`links[${index}][materialCost]`}
                              value={row.materialCost ?? "0"}
                            />
                            <input
                              type="hidden"
                              name={`links[${index}][wayleaveCost]`}
                              value={row.wayleaveCost ?? "0"}
                            />
                            <input
                              type="hidden"
                              name={`links[${index}][nrc]`}
                              value={nrcTotalFromParts({
                                newBuildCost: row.newBuildCost,
                                provisioningCost: row.provisioningCost,
                                materialCost: row.materialCost,
                                wayleaveCost: row.wayleaveCost,
                              })}
                            />
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics">
              <div className="grid gap-4 md:grid-cols-3">
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
                <Field label="IRR (%)" required>
                  <div className="relative">
                    <Input
                      name="irr"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      className="pr-8"
                      defaultValue={savedDraft?.irr ?? (project.irr > 0 ? project.irr : undefined)}
                      required
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[color:var(--color-muted)]">
                      %
                    </span>
                  </div>
                </Field>
                <Field label="Payback Months" required>
                  <Input
                    name="payback"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    defaultValue={savedDraft?.payback ?? (project.payback > 0 ? project.payback : undefined)}
                    required
                  />
                </Field>
                <Field label="Capex" required>
                  <Input
                    name="capex"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={savedDraft?.capex ?? bcInputBudget}
                    required
                  />
                </Field>
                <Field label="Subsidy Requirement" required>
                  <Input
                    name="subsidy"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={savedDraft?.subsidy ?? project.subsidy ?? 0}
                    required
                  />
                </Field>
                <Field label="Approved Budget" required>
                  <Input
                    name="approvedBudget"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={savedDraft?.approvedBudget ?? bcInputBudget}
                    required
                  />
                </Field>
              </div>
            </TabsContent>
          </CardContent>

          <div className="flex justify-end border-t border-[color:var(--color-border)] px-4 py-3">
            {isFinalTab ? (
              <FormSubmitButton pendingLabel="Submitting BC…">
                <Save className="h-4 w-4" aria-hidden="true" />
                Submit BC
              </FormSubmitButton>
            ) : (
              <Button type="button" onClick={goToNextTab}>
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </Tabs>
      </Card>
    </form>
  );
}
