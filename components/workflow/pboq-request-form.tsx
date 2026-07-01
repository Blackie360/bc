"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CapacityMbpsInput } from "@/components/workflow/capacity-mbps-input";
import { Field, RequiredFieldLegend } from "@/components/workflow/form-field";
import { defaultKickoffRegion, kenyaCounties } from "@/lib/geo/kenya-counties";
import {
  rowsFromImportedWorksheet,
  type KickoffLinkRow,
} from "@/lib/workflow/excel-import";

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
                        <option value="DF">DF</option>
                        <option value="Other Services">Other Services</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <CapacityMbpsInput
                        name={`kickoffLinks[${index}][capacity]`}
                        defaultValue={row.capacity}
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
