"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/workflow/form-field";
import type { OtherExpenseRowState } from "@/lib/bc/prepared-bc-rows";
import { formatMetricDisplay, formatMetricInput } from "@/lib/bc/template-metrics";
import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { ProjectRecord } from "@/lib/project-record-types";
import { deriveDecision } from "@/lib/workflow";

type FinancialMetrics = ReturnType<typeof import("@/lib/bc/template-metrics").calculateExcelTemplateMetrics> & {
  decision: ReturnType<typeof deriveDecision> & { reason: string };
  isAccepted: boolean;
};

type PreparedBcMetricsTabProps = {
  project: ProjectRecord;
  savedDraft?: PreparedBcDraft | null;
  isFibreReady: boolean;
  usesActualSurveyCost: boolean;
  actualSurveyCost: number;
  pboqBudget: number;
  bcInputBudget: number;
  revenueTotals: { mrc: number; mrr: number; nrr: number; nrc: number };
  financialMetrics: FinancialMetrics;
  otherExpenseRows: OtherExpenseRowState[];
  subsidyRequirement: string;
  onSubsidyRequirementChange: (value: string) => void;
  onAddOtherExpenseRow: () => void;
  onRemoveOtherExpenseRow: (id: number) => void;
  onUpdateOtherExpenseRow: (id: number, field: "label" | "monthlyCost", value: string) => void;
};

export function PreparedBcMetricsTab({
  project,
  savedDraft,
  isFibreReady,
  usesActualSurveyCost,
  actualSurveyCost,
  pboqBudget,
  bcInputBudget,
  revenueTotals,
  financialMetrics,
  otherExpenseRows,
  subsidyRequirement,
  onSubsidyRequirementChange,
  onAddOtherExpenseRow,
  onRemoveOtherExpenseRow,
  onUpdateOtherExpenseRow,
}: PreparedBcMetricsTabProps) {
  return (
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
                    { label: "Capacity Mbps", value: financialMetrics.capacityMbps },
                    { label: "Other Expenses", value: financialMetrics.monthlyOtherExpenses },
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
                <div className="rounded-md border border-[color:var(--color-border)] bg-white p-4 md:col-span-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">Other Expenses</CardTitle>
                      <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                        Add monthly expenses that should reduce the BC free cash flow.
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={onAddOtherExpenseRow}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Expense
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {otherExpenseRows.map((expense, index) => (
                      <div
                        key={expense.id}
                        className="grid gap-3 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] p-3 md:grid-cols-[1fr_12rem_auto]"
                      >
                        <Field label="Expense name">
                          <Input
                            name={`otherExpenses[${index}][label]`}
                            value={expense.label ?? ""}
                            placeholder="e.g. support, hosting, permits"
                            onChange={(event) =>
                              onUpdateOtherExpenseRow(expense.id, "label", event.currentTarget.value)
                            }
                          />
                        </Field>
                        <Field label="Monthly cost">
                          <Input
                            name={`otherExpenses[${index}][monthlyCost]`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={expense.monthlyCost ?? "0"}
                            className="text-right tabular-nums"
                            onChange={(event) =>
                              onUpdateOtherExpenseRow(
                                expense.id,
                                "monthlyCost",
                                event.currentTarget.value,
                              )
                            }
                          />
                        </Field>
                        <div className="flex items-end">
                          {otherExpenseRows.length > 1 ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="warning"
                              onClick={() => onRemoveOtherExpenseRow(expense.id)}
                              aria-label={`Remove other expense ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-medium text-[color:var(--color-primary)]">
                    Monthly other expenses:{" "}
                    {formatMetricDisplay(financialMetrics.monthlyOtherExpenses)}
                  </p>
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
                    onChange={(event) => onSubsidyRequirementChange(event.currentTarget.value)}
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
  );
}
