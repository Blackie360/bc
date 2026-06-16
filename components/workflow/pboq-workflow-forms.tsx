"use client";

import { ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
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
  readFormFieldValue,
  readIndexedFormRows,
  readFileMetadata,
  readFileMetadataList,
  type FiberPlanningLineDraft,
  type PreparedBcDraft,
  readLifecycleStage,
} from "@/lib/project-lifecycle-storage";
import {
  KICKOFF_LINK_NOTES_MARKER,
  parseKickoffLinkNotes,
  type PboqCostLineRecord,
} from "@/lib/pboq-kickoff-links";
import type { ProjectRecord } from "@/lib/project-record-types";
import { deriveDecision } from "@/lib/workflow";

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
  multiple = false,
}: {
  id: string;
  name: string;
  required?: boolean;
  accept?: string;
  defaultFileName?: string;
  multiple?: boolean;
}) {
  const [fileName, setFileName] = useState(defaultFileName ?? "No file selected");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);

    if (files.length === 0) {
      setFileName("No file selected");
      return;
    }

    setFileName(files.map((file) => file.name).join(", "));
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
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />
    </div>
  );
}

type Row = { id: number };
type FiberPlanningRow = Row & FiberPlanningLineDraft;
type ExistingPboqFile = Pick<
  ProjectRecord["documents"][number],
  "id" | "name" | "mimeType" | "sizeBytes"
>;

type KickoffLinkRow = Row & {
  linkName?: string;
  region?: string;
  siteCoordinates?: string;
  buildingName?: string;
  service?: "EPL" | "DIA" | "DFA";
  capacity?: string;
};

const defaultKickoffRegion = kenyaCounties[0];
const kickoffLinkImportColumns = {
  linkName: ["linkname", "link", "linkid", "linknumber", "linkno", "sitename"],
  region: ["region", "county"],
  siteCoordinates: ["sitecoordinates", "coordinates", "gps", "gpscoordinates", "latlong"],
  buildingName: ["buildingname", "building", "location", "address"],
  service: ["service", "servicetype", "product"],
  capacity: ["capacity", "bandwidth", "speed"],
} as const;

function normalizeImportHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellText(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function importedService(value: string): KickoffLinkRow["service"] {
  const normalized = value.trim().toUpperCase();

  if (normalized === "EPL" || normalized === "DIA" || normalized === "DFA") {
    return normalized;
  }

  return "EPL";
}

function importedCell(
  row: Record<string, unknown>,
  field: keyof typeof kickoffLinkImportColumns,
) {
  const entry = Object.entries(row).find(([header]) =>
    kickoffLinkImportColumns[field].some(
      (column) => column === normalizeImportHeader(header),
    ),
  );

  return entry ? cellText(entry[1]) : "";
}

function rowsFromImportedWorksheet(rows: Array<Record<string, unknown>>): KickoffLinkRow[] {
  return rows
    .map((row, index) => ({
      id: Date.now() + index,
      linkName: importedCell(row, "linkName"),
      region: importedCell(row, "region") || defaultKickoffRegion,
      siteCoordinates: importedCell(row, "siteCoordinates"),
      buildingName: importedCell(row, "buildingName"),
      service: importedService(importedCell(row, "service")),
      capacity: importedCell(row, "capacity"),
    }))
    .filter((row) =>
      Boolean(
        row.linkName ||
          row.siteCoordinates ||
          row.buildingName ||
          row.capacity ||
          row.region !== defaultKickoffRegion,
      ),
    );
}

export function PboqRequestForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const todayDate = new Date().toISOString().slice(0, 10);
  const [technology, setTechnology] = useState("Fibre Entry");
  const [linkRows, setLinkRows] = useState<KickoffLinkRow[]>([
    { id: 1, region: defaultKickoffRegion, service: "EPL" },
  ]);
  const [linkImportMessage, setLinkImportMessage] = useState<string | null>(null);
  const [linkImportError, setLinkImportError] = useState<string | null>(null);
  const isFibreReady = technology === "Fibre Ready";

  function addLinkRow() {
    setLinkRows((current) => [
      ...current,
      {
        id: Date.now(),
        region: current[0]?.region ?? defaultKickoffRegion,
        service: current[0]?.service ?? "EPL",
      },
    ]);
  }

  function removeLinkRow(id: number) {
    setLinkRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }

  async function importLinkRows(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setLinkImportError(null);
    setLinkImportMessage(null);

    if (!file) {
      return;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("The uploaded spreadsheet does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const importedRows = rowsFromImportedWorksheet(
        XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" }),
      );

      if (importedRows.length === 0) {
        throw new Error("No link rows were found. Check the column headers and try again.");
      }

      setLinkRows(importedRows);
      setLinkImportMessage(`Imported ${importedRows.length} link${importedRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The spreadsheet could not be imported.";
      setLinkImportError(message);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="pboqMode" value="request" />
      <RequiredFieldLegend />
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Project Start Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Opportunity Number" required>
            <Input name="opportunityNumber" placeholder="LT-OPP-000000" required />
          </Field>
          <Field label="Date Requested" required>
            <Input
              name="dateRequested"
              type="date"
              defaultValue={todayDate}
              readOnly
              required
            />
          </Field>
          <Field label="Technology" required>
            <Select
              name="technology"
              value={technology}
              onChange={(event) => setTechnology(event.currentTarget.value)}
              required
            >
              <option value="Fibre Entry">Fibre Entry</option>
              <option value="Fibre Ready">Fibre Ready</option>
              <option value="Wireless">Wireless</option>
            </Select>
          </Field>
          <Field label="Client Name" required>
            <Input name="customerName" required />
          </Field>
          {/* <Field label="MRR" required>
            <Input
              name="mrr"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
            />
          </Field>
          {/* <Field label="NRR" required>
            <Input
              name="nrr"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
            />
          </Field> */}
          <Field label="Contract Term" required>
            <Select name="contractTermMonths" defaultValue="12" required>
              <option value="12">12 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
            </Select>
          </Field>
          {/* <Field label="Site Name" required>
            <Input name="siteName" required />
          </Field> */}
          {/* <Field label="Site Coordinates" required>
            <Input
              name="siteCoordinates"
              placeholder="1.2975 S, 36.8914 E"
              required
            />
          </Field> */}
          {/* <Field label="Lead Network Planner" required>
            <Input name="leadNetworkPlanner" required />
          </Field> */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <CardTitle className="text-sm">Service Links</CardTitle>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              Add one link for a single-site deal, or multiple links when the opportunity spans several connections.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-[color:var(--color-border)] bg-white px-3 text-xs font-medium text-[color:var(--color-muted-strong)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-soft)] hover:text-[color:var(--color-primary)]">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={importLinkRows}
                className="sr-only"
              />
            </label>
            <Button type="button" size="sm" variant="secondary" onClick={addLinkRow}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-3 space-y-1 text-xs">
            <p className="text-[color:var(--color-muted)]">
              Spreadsheet columns: Link Name, Region, Site Coordinates, Building Name, Service, Capacity.
            </p>
            {linkImportMessage ? (
              <p className="text-[color:var(--color-success-text)]">{linkImportMessage}</p>
            ) : null}
            {linkImportError ? (
              <p className="text-[color:var(--color-danger-text)]">{linkImportError}</p>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <datalist id="kenya-counties">
              {kenyaCounties.map((county) => (
                <option key={county} value={county} />
              ))}
            </datalist>
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-[11px] uppercase text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-2 py-2 font-medium">
                    Link name
                    <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  </th>
                  <th className="px-2 py-2 font-medium">
                    Region
                    <span className="text-[color:var(--color-danger-text)]" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  </th>
                  {["Site Coordinates *", "Building Name *", "Service *", "Capacity *", "Action"].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {linkRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2">
                      <Input
                        name={`kickoffLinks[${index}][linkName]`}
                        defaultValue={row.linkName}
                        placeholder={`Link ${index + 1}`}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`kickoffLinks[${index}][region]`}
                        list="kenya-counties"
                        defaultValue={row.region ?? defaultKickoffRegion}
                        placeholder="County"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`kickoffLinks[${index}][siteCoordinates]`}
                        defaultValue={row.siteCoordinates}
                        placeholder="1.2975 S, 36.8914 E"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`kickoffLinks[${index}][buildingName]`}
                        defaultValue={row.buildingName}
                        placeholder="Building Name"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        name={`kickoffLinks[${index}][service]`}
                        defaultValue={row.service ?? "EPL"}
                        required
                      >
                        <option value="EPL">EPL</option>
                        <option value="DIA">DIA</option>
                        <option value="DFA">DFA</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name={`kickoffLinks[${index}][capacity]`}
                        defaultValue={row.capacity}
                        placeholder="e.g. 1 Mbps"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLinkRow(row.id)}
                        disabled={linkRows.length === 1}
                        aria-label={`Remove link ${index + 1}`}
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

      <FormSubmitButton pendingLabel={isFibreReady ? "Starting opportunity…" : "Submitting PBOQ…"}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {isFibreReady ? "Start Opportunity" : "Request PBOQ"}
      </FormSubmitButton>
    </form>
  );
}

function buildFiberPlanningRowsFromCostLines(
  costLines: PboqCostLineRecord[],
): FiberPlanningRow[] {
  if (costLines.length === 0) {
    return [{ id: 1 }];
  }

  return costLines.map((line, index) => {
    const isKickoffNotes = line.notes?.startsWith(KICKOFF_LINK_NOTES_MARKER) ?? false;

    return {
      id: index + 1,
      linkName: line.linkName,
      material: line.material > 0 ? String(line.material) : "",
      build: line.build > 0 ? String(line.build) : "",
      wayleave: line.wayleave > 0 ? String(line.wayleave) : "",
      notes: isKickoffNotes ? "" : (line.notes ?? ""),
    };
  });
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

export function FiberPlanningForm({
  action,
  projectId,
  initialCostLines = [],
  initialPboqFiles = [],
  kickoffLinkCount = 0,
  planningLabel = "Fiber Planning",
}: {
  action: (formData: FormData) => void | Promise<void>;
  projectId: string;
  initialCostLines?: PboqCostLineRecord[];
  initialPboqFiles?: Array<ExistingPboqFile | undefined>;
  kickoffLinkCount?: number;
  planningLabel?: string;
}) {
  const isMultiLinkKickoff = kickoffLinkCount > 1;
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<FiberPlanningRow[]>(() =>
    buildFiberPlanningRowsFromCostLines(initialCostLines),
  );
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

        const savedFiberDraft = readLifecycleStage(projectId, "fiberPlanning");
        const lineRows = readIndexedFormRows<{
          linkName?: string;
          material?: string;
          build?: string;
          wayleave?: string;
          notes?: string;
        }>(form, "pboqLines", ["linkName", "material", "build", "wayleave", "notes"]);

        return {
          savedAt: new Date().toISOString(),
          fiberPlanningNotes: readFormFieldValue(form, "fiberPlanningNotes"),
          lines: lineRows.map((line, index) => {
            const fileInput = form.elements.namedItem(`pboqLines[${index}][pboqFile]`);
            const pboqFile =
              fileInput instanceof HTMLInputElement
                ? readFileMetadata(fileInput)
                : savedFiberDraft?.lines?.[index]?.pboqFile;

            return {
              ...line,
              pboqFile,
            };
          }),
        };
      },
      deps: [rows, projectId],
    });

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      if (restoredDraft?.lines?.length) {
        setRows(buildFiberPlanningRowsFromDraft(restoredDraft.lines) as FiberPlanningRow[]);
      } else if (initialCostLines.length > 0) {
        setRows(buildFiberPlanningRowsFromCostLines(initialCostLines));
      }

      setHasRestoredDraft(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [initialCostLines, isReady, restoredDraft]);

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady, rows]);

  function addRow() {
    if (isMultiLinkKickoff) {
      return;
    }

    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: number) {
    if (isMultiLinkKickoff) {
      return;
    }

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
      {isMultiLinkKickoff ? (
        <input type="hidden" name="kickoffLinkCount" value={kickoffLinkCount} />
      ) : null}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <CardTitle className="text-sm">PBOQ Cost Lines</CardTitle>
            {isMultiLinkKickoff ? (
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                This opportunity has {kickoffLinkCount} links. Upload one PBOQ file for each link.
              </p>
            ) : null}
          </div>
          {isMultiLinkKickoff ? null : (
            <Button type="button" size="sm" variant="secondary" onClick={addRow}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Line
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-[11px] uppercase text-[color:var(--color-muted)]">
                <tr>
                  {["Link", "Build", "Material", "Wayleave", "PBOQ File", "Notes", "Action"].map(
                    (label) => (
                      <th key={label} className="px-2 py-2 font-medium">{label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {rows.map((row, index) => {
                  const existingPboqFile = initialPboqFiles[index];
                  const defaultPboqFileName =
                    restoredDraft?.lines?.[index]?.pboqFile?.name ?? existingPboqFile?.name;

                  return (
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
                      <FileUploadField
                        id={`pboqFile-${row.id}`}
                        name={`pboqLines[${index}][pboqFile]`}
                        required={!existingPboqFile}
                        defaultFileName={defaultPboqFileName}
                      />
                      {existingPboqFile ? (
                        <>
                          <input
                            type="hidden"
                            name={`pboqLines[${index}][existingPboqDocumentId]`}
                            value={existingPboqFile.id}
                          />
                          <input
                            type="hidden"
                            name={`pboqLines[${index}][existingPboqFileName]`}
                            value={existingPboqFile.name}
                          />
                          <input
                            type="hidden"
                            name={`pboqLines[${index}][existingPboqMimeType]`}
                            value={existingPboqFile.mimeType}
                          />
                          <input
                            type="hidden"
                            name={`pboqLines[${index}][existingPboqSizeBytes]`}
                            value={existingPboqFile.sizeBytes}
                          />
                        </>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <Input name={`pboqLines[${index}][notes]`} defaultValue={row.notes} />
                    </td>
                    <td className="px-2 py-2">
                      {!isMultiLinkKickoff && rows.length > 1 ? (
                        <Button type="button" size="icon" variant="warning" onClick={() => removeRow(row.id)} aria-label="Remove PBOQ row">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b border-[color:var(--color-border)] px-4 py-3">
          <CardTitle className="text-sm">Planning Output</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Field label={`${planningLabel} Notes`}>
            <Textarea
              name="fiberPlanningNotes"
              defaultValue={restoredDraft?.fiberPlanningNotes}
            />
          </Field>
        </CardContent>
      </Card>
      <FormSubmitButton pendingLabel="Completing planning…">
        <Save className="h-4 w-4" aria-hidden="true" />
        Complete {planningLabel}
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
  costSource?: "PBOQ" | "Fibre Ready" | "Actual Survey" | "3rd Party Quote";
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

function isFibreReadyProject(project: ProjectRecord) {
  return (
    project.pboqRequest?.technology === "Fibre Ready" ||
    project.pboqRequest?.costSource === "FIBRE_READY"
  );
}

function defaultRevenueForNewRow(project: ProjectRecord, linkCount: number) {
  const mrr = linkCount > 0 ? formatMetricInput(project.opportunityMrr / linkCount) : "0";
  const mrc = "0";

  return {
    mrc,
    mrr,
    nrr: formatMetricInput(calculateNrr(numberOrZero(mrr), 0)),
  };
}

function bcTemplateFileNames(draft?: PreparedBcDraft | null) {
  const attachments = draft?.bcTemplates ?? (draft?.bcTemplate ? [draft.bcTemplate] : []);

  return attachments.length > 0 ? attachments.map((attachment) => attachment.name).join(", ") : undefined;
}

function mapDraftLinkToRow(
  link: NonNullable<PreparedBcDraft["links"]>[number],
  index: number,
): LinkRowState {
  const mrc = link.mrc && link.mrc.length > 0 ? link.mrc : "0";
  const mrr = link.mrr && link.mrr.length > 0 ? link.mrr : "0";

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
    mrc,
    mrr,
    nrr: formatMetricInput(calculateNrr(numberOrZero(mrr), numberOrZero(mrc))),
  };
}

function buildInitialLinkRows(
  project: ProjectRecord,
  draft?: PreparedBcDraft | null,
): LinkRowState[] {
  const isFibreReady = isFibreReadyProject(project);
  const defaultTechnology = isFibreReady ? "Fibre Ready" : "Fiber";
  const defaultCostSource = isFibreReady ? "Fibre Ready" : "PBOQ";

  if (draft?.links && draft.links.length > 0) {
    return draft.links.map(mapDraftLinkToRow);
  }

  if (project.links.length > 0) {
    return project.links.map((link, index) => ({
      id: index + 1,
      linkName: link.linkName,
      service: link.service || "DIA",
      technology: link.technology || defaultTechnology,
      onnetOffnet: link.onnetOffnet ?? "Onnet",
      costSource: link.costSource ?? defaultCostSource,
      onnetCapacity: link.onnetCapacity ?? undefined,
      offnetCapacity: link.offnetCapacity ?? undefined,
      newBuildCost: String(link.newBuildCost),
      provisioningCost: String(link.provisioningCost),
      materialCost: String(link.materialCost),
      wayleaveCost: String(link.wayleaveCost),
      mrc: String(link.mrc),
      mrr: String(link.mrr),
      nrr: String(calculateNrr(link.mrr, link.mrc)),
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
        technology: defaultTechnology,
        costSource: defaultCostSource,
        ...revenue,
      },
    ];
  }

  return costLines.map((line, index) => {
    const kickoff = parseKickoffLinkNotes(line.notes);

    return {
      id: index + 1,
      linkName: line.linkName,
      onnetOffnet: "Onnet",
      service: kickoff.service ?? project.requiredService ?? "DIA",
      technology: defaultTechnology,
      costSource: defaultCostSource,
      onnetCapacity: kickoff.capacity ?? project.capacity ?? undefined,
      newBuildCost: String(line.build),
      materialCost: String(line.material),
      wayleaveCost: String(line.wayleave),
      provisioningCost: "0",
      ...defaultRevenueForNewRow(project, costLines.length),
    };
  });
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
  const readAttachments = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? readFileMetadataList(input) : undefined;
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
    nrv: Number(readFormFieldValue(form, "nrv")) || undefined,
    tcv: Number(readFormFieldValue(form, "tcv")) || undefined,
    exchangeRateKesUsd: Number(readFormFieldValue(form, "exchangeRateKesUsd")) || undefined,
    lsoAttachment: readAttachment("lsoAttachment"),
    bcTemplate: readAttachment("bcTemplate"),
    bcTemplates: readAttachments("bcTemplate"),
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

function calculateNrr(mrr: number, mrc: number) {
  return mrr - mrc;
}

function calculatePaybackMonths(tcs: number, monthlyNrr: number) {
  if (monthlyNrr <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return tcs / monthlyNrr;
}

function calculateAnnualIrrPercentage(tcs: number, monthlyNrr: number, contractTermMonths: number) {
  if (monthlyNrr <= 0 || contractTermMonths <= 0) {
    return 0;
  }

  if (tcs <= 0) {
    return 100;
  }

  const cashFlows = [-tcs, ...Array.from({ length: contractTermMonths }, () => monthlyNrr)];
  const npv = (rate: number) =>
    cashFlows.reduce((sum, cashFlow, month) => sum + cashFlow / (1 + rate) ** month, 0);
  let low = -0.9999;
  let high = 10;
  let mid = 0;

  for (let index = 0; index < 1000; index += 1) {
    mid = (low + high) / 2;
    const lowNpv = npv(low);
    const midNpv = npv(mid);

    if (Math.abs(midNpv) < 1e-7) {
      break;
    }

    if (lowNpv * midNpv < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return ((1 + mid) ** 12 - 1) * 100;
}

function formatMetricInput(value: number, decimalPlaces = 2) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(Number(value.toFixed(decimalPlaces)));
}

function formatMetricDisplay(value: number, decimalPlaces = 2) {
  if (!Number.isFinite(value)) {
    return "Not recoverable";
  }

  return Number(value.toFixed(decimalPlaces)).toLocaleString("en-US");
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
  const [contractTermMonths, setContractTermMonths] = useState(project.contractTermMonths || 12);
  const [subsidyRequirement, setSubsidyRequirement] = useState(
    String(project.subsidy ?? 0),
  );
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

    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      if (restoredDraft) {
        setRows(buildInitialLinkRows(project, restoredDraft));
        setContractTermMonths(restoredDraft.contractTermMonths ?? (project.contractTermMonths || 12));
        setSubsidyRequirement(String(restoredDraft.subsidy ?? project.subsidy ?? 0));
        setActiveTab(restoredDraft.activeTab ?? "details");
      }

      setHasRestoredDraft(true);
    });

    return () => {
      isCancelled = true;
    };
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
  const isFibreReady = isFibreReadyProject(project);
  const revenueTotals = useMemo(
    () =>
      rows.reduce(
        (totals, row) => ({
          mrc: totals.mrc + numberOrZero(row.mrc),
          mrr: totals.mrr + numberOrZero(row.mrr),
          nrr: totals.nrr + calculateNrr(numberOrZero(row.mrr), numberOrZero(row.mrc)),
          nrc:
            totals.nrc +
            nrcTotalFromParts({
              newBuildCost: row.newBuildCost,
              provisioningCost: row.provisioningCost,
              materialCost: row.materialCost,
              wayleaveCost: row.wayleaveCost,
            }),
        }),
        { mrc: 0, mrr: 0, nrr: 0, nrc: 0 },
      ),
    [rows],
  );
  const financialMetrics = useMemo(() => {
    const paybackMonths = calculatePaybackMonths(revenueTotals.nrc, revenueTotals.nrr);
    const submittedPaybackMonths = Number.isFinite(paybackMonths)
      ? Math.max(1, Math.ceil(paybackMonths))
      : contractTermMonths + 1;
    const irr = calculateAnnualIrrPercentage(
      revenueTotals.nrc,
      revenueTotals.nrr,
      contractTermMonths,
    );
    const decision = deriveDecision({
      irr,
      paybackMonths: submittedPaybackMonths,
      subsidyRequirement: numberOrZero(subsidyRequirement),
      capex: revenueTotals.nrc,
    });
    const isAccepted =
      revenueTotals.nrr > 0 &&
      submittedPaybackMonths <= contractTermMonths &&
      decision.decision !== "SEEK FINANCE APPROVAL";

    return {
      irr,
      paybackMonths,
      submittedPaybackMonths,
      nrv: revenueTotals.nrr * contractTermMonths,
      tcv: revenueTotals.mrr * contractTermMonths,
      decision,
      isAccepted,
    };
  }, [
    contractTermMonths,
    revenueTotals.mrr,
    revenueTotals.nrc,
    revenueTotals.nrr,
    subsidyRequirement,
  ]);

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [bindFormAutoSave, isReady, activeTab, rows, contractTermMonths, subsidyRequirement]);

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
          technology: isFibreReady ? "Fibre Ready" : "Fiber",
          costSource: isFibreReady ? "Fibre Ready" : "PBOQ",
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

  function updateRowRevenue(id: number, field: "mrc" | "mrr", value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextRow = { ...row, [field]: value };

        return {
          ...nextRow,
          nrr: String(calculateNrr(numberOrZero(nextRow.mrr), numberOrZero(nextRow.mrc))),
        };
      }),
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
                </Field>
                <Field label="Account Number" required>
                  <Input
                    name="accountNumber"
                    defaultValue={savedDraft?.accountNumber ?? project.accountNumber}
                    required
                  />
                  
                </Field>
                <Field label="Opportunity Number" required>
                  <Input name="opportunityNumber" defaultValue={project.id} readOnly required />
                  {isFibreReady ? (
                    <p className="text-xs font-normal text-[color:var(--color-muted)]">
                      Fibre-ready opportunity. No PBOQ is required for BC preparation.
                    </p>
                  ) : !hasExistingPboq ? (
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
                      PBOQ already attached from Planning.
                    </p>
                  )}
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
                    value={String(contractTermMonths)}
                    onChange={(event) => setContractTermMonths(Number(event.currentTarget.value))}
                  >
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </Select>
                </Field>
                <Field label="">
                <p className="text-xs font-normal text-[color:var(--color-muted)]">Attachment: LSO</p>
                  <FileUploadField
                    id="lsoAttachment"
                    name="lsoAttachment"
                    required
                    defaultFileName={savedDraft?.lsoAttachment?.name}
                  />
                  
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">
                    Attachment: one or more prepared BC Excel sheets
                  </p>
                  <FileUploadField
                    id="bcTemplate"
                    name="bcTemplate"
                    accept=".xlsx,.xls,.csv"
                    required
                    multiple
                    defaultFileName={bcTemplateFileNames(savedDraft)}
                  />
                  
                </Field>
                <Field label="Account Manager" required>
                  <Input name="accountManagerName" defaultValue={project.owner} readOnly required />
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">
                    Attachment: 3rd Party Quotes for offnet sites
                  </p>
                  <FileUploadField
                    id="thirdPartyQuotesAttachment"
                    name="thirdPartyQuotesAttachment"
                    defaultFileName={savedDraft?.thirdPartyQuotesAttachment?.name}
                  />
                  
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
                    <p className="mt-1 text-xs text-[color:var(--color-muted-strong)]">
                      Totals: MRR {revenueTotals.mrr.toLocaleString("en-US")} · MRC{" "}
                      {revenueTotals.mrc.toLocaleString("en-US")} · NRR{" "}
                      {revenueTotals.nrr.toLocaleString("en-US")} · NRC{" "}
                      {revenueTotals.nrc.toLocaleString("en-US")}
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
                              <option>Fibre Ready</option>
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
                              value={row.mrc ?? "0"}
                              onChange={(event) =>
                                updateRowRevenue(row.id, "mrc", event.currentTarget.value)
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][mrr]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={row.mrr ?? "0"}
                              onChange={(event) =>
                                updateRowRevenue(row.id, "mrr", event.currentTarget.value)
                              }
                              required
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`links[${index}][nrr]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={formatMetricInput(
                                calculateNrr(numberOrZero(row.mrr), numberOrZero(row.mrc)),
                              )}
                              readOnly
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
                    {isFibreReady
                      ? "Fibre ready: no PBOQ required"
                      : usesActualSurveyCost
                      ? `Actual survey cost: ${actualSurveyCost.toLocaleString("en-US")}`
                      : `PBOQ estimate: ${pboqBudget.toLocaleString("en-US")}`}
                  </p>
                </div>
                <div className="grid gap-3 md:col-span-3 md:grid-cols-4">
                  {[
                    { label: "Total MRR", value: revenueTotals.mrr },
                    { label: "Total MRC", value: revenueTotals.mrc },
                    { label: "Total NRR", value: revenueTotals.nrr },
                    { label: "TCS / NRC", value: revenueTotals.nrc },
                    { label: "Payback", value: financialMetrics.paybackMonths, suffix: " months" },
                    { label: "IRR", value: financialMetrics.irr, suffix: "%" },
                    { label: "NRV", value: financialMetrics.nrv },
                    { label: "TCV", value: financialMetrics.tcv },
                  ].map(({ label, value, suffix }) => (
                    <div
                      key={label}
                      className="rounded-md border border-[color:var(--color-border)] bg-white p-3"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
                        {formatMetricDisplay(value)}
                        {Number.isFinite(value) ? suffix : null}
                      </p>
                    </div>
                  ))}
                </div>
                <Field label="BC Type" required>
                  <Select name="type" defaultValue={savedDraft?.type ?? project.type ?? "Ordinary BC"} required>
                    <option>Ordinary BC</option>
                    <option>Margin Analysis BC</option>
                  </Select>
                </Field>
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
                      value={formatMetricInput(financialMetrics.irr)}
                      readOnly
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
                    value={financialMetrics.submittedPaybackMonths}
                    readOnly
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
                    value={formatMetricInput(revenueTotals.nrc)}
                    readOnly
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
                    value={subsidyRequirement}
                    onChange={(event) => setSubsidyRequirement(event.currentTarget.value)}
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
                <Field label="NRV (USD)" required>
                  <Input
                    name="nrv"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formatMetricInput(financialMetrics.nrv)}
                    readOnly
                    required
                  />
                </Field>
                <Field label="TCV (USD)" required>
                  <Input
                    name="tcv"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={formatMetricInput(financialMetrics.tcv)}
                    readOnly
                    required
                  />
                </Field>
                <Field label="Exchange Rate (KES/USD)" required>
                  <Input
                    name="exchangeRateKesUsd"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    defaultValue={(savedDraft?.exchangeRateKesUsd ?? project.exchangeRateKesUsd) || undefined}
                    required
                  />
                </Field>
                <div
                  className={`rounded-md border p-4 text-sm md:col-span-3 ${
                    financialMetrics.isAccepted
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
                    Opportunity decision
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {financialMetrics.isAccepted ? "Done" : "Pending"}
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted-strong)]">
                    {financialMetrics.decision.reason}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                    Payback:{" "}
                    {Number.isFinite(financialMetrics.paybackMonths)
                      ? `${formatMetricInput(financialMetrics.paybackMonths)} months`
                      : "not recoverable"}{" "}
                    · IRR: {formatMetricInput(financialMetrics.irr)}% · TCV:{" "}
                    {financialMetrics.tcv.toLocaleString("en-US")} · Total NRR:{" "}
                    {revenueTotals.nrr.toLocaleString("en-US")}
                  </p>
                </div>
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
