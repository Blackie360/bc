"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CapacityMbpsInput } from "@/components/workflow/capacity-mbps-input";
import { FileUploadField } from "@/components/workflow/file-upload-field";
import type { LinkRowState } from "@/lib/bc/prepared-bc-rows";
import { nrcTotalFromParts } from "@/lib/bc/template-metrics";
import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import { isThirdPartyLink, type LinkOnnetOffnet } from "@/lib/projects-types";
import { cn } from "@/lib/utils";

type PreparedBcLinksTabProps = {
  rows: LinkRowState[];
  revenueTotals: { mrc: number; mrr: number; nrr: number; nrc: number };
  savedDraft?: PreparedBcDraft | null;
  onAddRow: () => void;
  onRemoveRow: (id: number) => void;
  onUpdateRowOnnetOffnet: (id: number, onnetOffnet: LinkOnnetOffnet) => void;
  onUpdateRowRevenue: (id: number, field: "mrc" | "mrr" | "nrr", value: string) => void;
  onUpdateRowCapacity: (id: number, field: "onnetCapacity" | "offnetCapacity", value: string) => void;
};

export function PreparedBcLinksTab({
  rows,
  revenueTotals,
  savedDraft,
  onAddRow,
  onRemoveRow,
  onUpdateRowOnnetOffnet,
  onUpdateRowRevenue,
  onUpdateRowCapacity,
}: PreparedBcLinksTabProps) {
  return (
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
                  <Button type="button" size="sm" variant="secondary" onClick={onAddRow}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Link
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border border-[color:var(--color-border)]">
                  <table className="w-full min-w-[92rem] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-10" />
                      <col className="w-[12rem]" />
                      <col className="w-28" />
                      <col className="w-28" />
                      <col className="w-[7rem]" />
                      <col className="w-40" />
                      <col className="w-36" />
                      <col className="w-28" />
                      <col className="w-28" />
                      <col className="w-28" />
                      <col className="w-56" />
                      <col className="w-14" />
                    </colgroup>
                    <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                      <tr>
                        {[
                          { label: "#", required: false, thClass: "whitespace-nowrap" },
                          { label: "Link name", required: true, thClass: "whitespace-normal leading-snug" },
                          { label: "Service", required: true, thClass: "whitespace-nowrap" },
                          { label: "Technology", required: true, thClass: "whitespace-nowrap" },
                          { label: "Onnet / 3rd Party", required: true, thClass: "whitespace-normal leading-snug" },
                          {
                            label: "Provider",
                            required: false,
                            thClass: "whitespace-normal leading-snug",
                          },
                          {
                            label: "PBOQ / survey / quote source",
                            required: true,
                            thClass: "whitespace-normal leading-snug",
                          },
                          { label: "Capacity", required: false, thClass: "whitespace-nowrap" },
                          { label: "MRC", required: false, thClass: "whitespace-nowrap" },
                          { label: "MRR", required: true, thClass: "whitespace-nowrap" },
                          { label: "NRR", required: false, thClass: "whitespace-nowrap" },
                          { label: "Per-link evidence", required: false, thClass: "whitespace-normal leading-snug" },
                          { label: "Supplier quote", required: false, thClass: "whitespace-normal leading-snug" },
                          { label: "Action", required: false, thClass: "whitespace-nowrap" },
                        ].map(({ label, required, thClass }) => (
                          <th
                            key={label}
                            className={cn(
                              "px-2 py-3 align-bottom font-medium",
                              thClass,
                            )}
                          >
                            <span>{label}</span>
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
                        const isThirdParty = isThirdPartyLink(onnetOffnet);

                        return (
                        <tr key={row.id} className="align-middle">
                          <td className="align-middle px-2 py-2 text-center text-[color:var(--color-muted)] tabular-nums">
                            {index + 1}
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            <Input
                              name={`links[${index}][linkName]`}
                              defaultValue={row.linkName}
                              required
                            />
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            <Select
                              name={`links[${index}][service]`}
                              defaultValue={row.service ?? "DIA"}
                              required
                            >
                              <option>DIA</option>
                              <option>MPLS</option>
                              <option>EPL</option>
                              <option>DF</option>
                              <option>Other Services</option>
                            </Select>
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            <Input
                              name={`links[${index}][technology]`}
                              defaultValue={row.technology ?? "Fiber"}
                              required
                            />
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            <Select
                              name={`links[${index}][onnetOffnet]`}
                              value={onnetOffnet}
                              onChange={(event) =>
                                onUpdateRowOnnetOffnet(
                                  row.id,
                                  event.currentTarget.value as LinkOnnetOffnet,
                                )
                              }
                              required
                            >
                              <option>Onnet</option>
                              <option>3rd Party</option>
                            </Select>
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            {isThirdParty ? (
                              <Input
                                name={`links[${index}][providerName]`}
                                defaultValue={row.providerName}
                                placeholder="Provider name"
                                required
                              />
                            ) : (
                              <span className="text-xs text-[color:var(--color-muted)]">—</span>
                            )}
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
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
                          <td className="min-w-0 align-middle px-2 py-2 text-right">
                            {onnetOffnet === "Onnet" ? (
                              <>
                                <CapacityMbpsInput
                                  key={`${row.id}-onnet`}
                                  name={`links[${index}][onnetCapacity]`}
                                  value={row.onnetCapacity ?? ""}
                                  onChange={(value) =>
                                    onUpdateRowCapacity(row.id, "onnetCapacity", value)
                                  }
                                />
                                <input type="hidden" name={`links[${index}][offnetCapacity]`} value="" />
                              </>
                            ) : (
                              <>
                                <CapacityMbpsInput
                                  key={`${row.id}-offnet`}
                                  name={`links[${index}][offnetCapacity]`}
                                  value={row.offnetCapacity ?? ""}
                                  onChange={(value) =>
                                    onUpdateRowCapacity(row.id, "offnetCapacity", value)
                                  }
                                />
                                <input type="hidden" name={`links[${index}][onnetCapacity]`} value="" />
                              </>
                            )}
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2 text-right">
                            <Input
                              name={`links[${index}][mrc]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              defaultValue={row.mrc ?? "0"}
                              className="text-right tabular-nums"
                            />
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2 text-right">
                            <Input
                              name={`links[${index}][mrr]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={row.mrr ?? "0"}
                              className="text-right tabular-nums"
                              onChange={(event) =>
                                onUpdateRowRevenue(row.id, "mrr", event.currentTarget.value)
                              }
                              required
                            />
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2 text-right">
                            <Input
                              name={`links[${index}][nrr]`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              defaultValue={row.nrr ?? "0"}
                              className="text-right tabular-nums"
                            />
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            <FileUploadField
                              id={`linkEvidence-${row.id}`}
                              name={`linkEvidence-${index}`}
                              defaultFileName={savedDraft?.linkEvidenceAttachments?.[index]?.name}
                              className="w-full max-w-none"
                            />
                          </td>
                          <td className="min-w-0 align-middle px-2 py-2">
                            {isThirdParty ? (
                              <FileUploadField
                                id={`linkSupplierQuote-${row.id}`}
                                name={`linkSupplierQuote-${index}`}
                                required
                                defaultFileName={savedDraft?.linkSupplierQuoteAttachments?.[index]?.name}
                                className="w-full max-w-none"
                              />
                            ) : (
                              <span className="text-xs text-[color:var(--color-muted)]">—</span>
                            )}
                          </td>
                          <td className="align-middle px-2 py-2">
                            {rows.length > 1 ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="warning"
                                onClick={() => onRemoveRow(row.id)}
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
  );
}
