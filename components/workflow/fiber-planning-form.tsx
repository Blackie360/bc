"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { Field } from "@/components/workflow/form-field";
import { FileUploadField } from "@/components/workflow/file-upload-field";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import {
  readFormFieldValue,
  readIndexedFormRows,
  readFileMetadata,
  readLifecycleStage,
} from "@/lib/project-lifecycle-storage";
import type { PboqCostLineRecord } from "@/lib/pboq-kickoff-links";
import type { ProjectRecord } from "@/lib/project-record-types";
import {
  buildFiberPlanningRowsFromCostLines,
  buildFiberPlanningRowsFromDraft,
  buildFiberPlanningRowsFromWorksheet,
  type FiberPlanningRow,
} from "@/lib/workflow/fiber-planning-rows";

type ExistingPboqFile = Pick<
  ProjectRecord["documents"][number],
  "id" | "name" | "mimeType" | "sizeBytes"
>;

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
  const [planningImportMessage, setPlanningImportMessage] = useState<string | null>(null);
  const [planningImportError, setPlanningImportError] = useState<string | null>(null);
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
          siteCoordinates?: string;
          material?: string;
          build?: string;
          wayleave?: string;
          notes?: string;
        }>(form, "pboqLines", [
          "linkName",
          "siteCoordinates",
          "material",
          "build",
          "wayleave",
          "notes",
        ]);

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

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (restoredDraft?.lines?.length) {
        setRows(buildFiberPlanningRowsFromDraft(restoredDraft.lines) as FiberPlanningRow[]);
      } else if (initialCostLines.length > 0) {
        setRows(buildFiberPlanningRowsFromCostLines(initialCostLines));
      }

      setHasRestoredDraft(true);
    });

    return () => {
      cancelled = true;
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

  async function importPlanningRows(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setPlanningImportError(null);
    setPlanningImportMessage(null);

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
      const importedRows = buildFiberPlanningRowsFromWorksheet(
        XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" }),
      );

      if (importedRows.length === 0) {
        throw new Error("No planning rows were found. Check the column headers and try again.");
      }

      if (isMultiLinkKickoff && importedRows.length !== kickoffLinkCount) {
        throw new Error(`This project has ${kickoffLinkCount} links. Import exactly ${kickoffLinkCount} rows.`);
      }

      setRows(importedRows);
      setPlanningImportMessage(
        `Imported ${importedRows.length} planning row${importedRows.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The spreadsheet could not be imported.";
      setPlanningImportError(message);
    }
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
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-[color:var(--color-border)] bg-white px-3 text-xs font-medium text-[color:var(--color-muted-strong)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-soft)] hover:text-[color:var(--color-primary)]">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={importPlanningRows}
                className="sr-only"
              />
            </label>
            {isMultiLinkKickoff ? null : (
              <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Line
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-3 space-y-1 text-xs">
            <p className="text-[color:var(--color-muted)]">
              Spreadsheet columns: Link Name, Site Coordinates, Build, Material, Wayleave, Notes.
            </p>
            {planningImportMessage ? (
              <p className="text-[color:var(--color-success-text)]">{planningImportMessage}</p>
            ) : null}
            {planningImportError ? (
              <p className="text-[color:var(--color-danger-text)]">{planningImportError}</p>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="text-[11px] uppercase text-[color:var(--color-muted)]">
                <tr>
                  {[
                    "Link",
                    "Site Coordinates",
                    "Build",
                    "Material",
                    "Wayleave",
                    "PBOQ File",
                    "Notes",
                    "Action",
                  ].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium">{label}</th>
                  ))}
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
                        name={`pboqLines[${index}][siteCoordinates]`}
                        defaultValue={row.siteCoordinates}
                        placeholder="1.2975 S, 36.8914 E"
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
