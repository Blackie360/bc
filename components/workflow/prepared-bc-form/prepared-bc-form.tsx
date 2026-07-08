"use client";

import { ChevronRight, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DraftSavedNotice } from "@/components/workflow/draft-saved-notice";
import { RequiredFieldLegend } from "@/components/workflow/form-field";
import { PreparedBcDetailsTab } from "@/components/workflow/prepared-bc-form/prepared-bc-details-tab";
import { PreparedBcLinksTab } from "@/components/workflow/prepared-bc-form/prepared-bc-links-tab";
import { PreparedBcMetricsTab } from "@/components/workflow/prepared-bc-form/prepared-bc-metrics-tab";
import { useFormLifecycleDraft } from "@/hooks/use-form-lifecycle-draft";
import { bcFormTabs, validateVisibleTabPanel, type BcFormTab } from "@/lib/bc/form-tabs";
import { buildPreparedBcDraft } from "@/lib/bc/prepared-bc-draft";
import {
  buildInitialLinkRows,
  buildInitialOtherExpenseRows,
  defaultRevenueForNewRow,
  isFibreReadyProject,
  type LinkRowState,
  type OtherExpenseRowState,
} from "@/lib/bc/prepared-bc-rows";
import { bcTemplateGuidanceFileName, bcTemplatePolicy } from "@/lib/bc/template-policy";
import {
  buildBcTemplateGuidanceDownload,
  calculateExcelTemplateMetrics,
  formatMetricInput,
  nrcTotalFromParts,
  numberOrZero,
} from "@/lib/bc/template-metrics";
import type { ProjectRecord } from "@/lib/project-record-types";
import type { LinkOnnetOffnet } from "@/lib/projects-types";
import { shouldRouteSubsidyToSalesOperations } from "@/lib/subsidy-routing";
import { notifyFormValidationError } from "@/lib/toast";
import { deriveDecision } from "@/lib/workflow";

export function PreparedBcForm({
  action,
  project,
}: {
  action: (formData: FormData) => void | Promise<void>;
  project: ProjectRecord;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<LinkRowState[]>(() => buildInitialLinkRows(project));
  const [otherExpenseRows, setOtherExpenseRows] = useState<OtherExpenseRowState[]>(() =>
    buildInitialOtherExpenseRows(),
  );
  const [contractTermMonths, setContractTermMonths] = useState(project.contractTermMonths || 12);
  const [subsidyRequirement, setSubsidyRequirement] = useState(
    String(project.subsidy ?? 0),
  );
  const [exchangeRateKesUsd, setExchangeRateKesUsd] = useState(
    (project.exchangeRateKesUsd || bcTemplatePolicy.defaultExchangeRateKesUsd).toString(),
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
      deps: [activeTab, rows, otherExpenseRows, project],
    });
  const savedDraft = restoredDraft;

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (restoredDraft) {
        setRows(buildInitialLinkRows(project, restoredDraft));
        setOtherExpenseRows(buildInitialOtherExpenseRows(restoredDraft));
        setContractTermMonths(restoredDraft.contractTermMonths ?? (project.contractTermMonths || 12));
        setSubsidyRequirement(String(restoredDraft.subsidy ?? project.subsidy ?? 0));
        setExchangeRateKesUsd(
          String(
            restoredDraft.exchangeRateKesUsd ||
              project.exchangeRateKesUsd ||
              bcTemplatePolicy.defaultExchangeRateKesUsd,
          ),
        );
        setActiveTab(restoredDraft.activeTab ?? "details");
      }

      setHasRestoredDraft(true);
    });

    return () => {
      cancelled = true;
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
          nrr: totals.nrr + numberOrZero(row.nrr),
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
    const metrics = calculateExcelTemplateMetrics({
      rows,
      otherExpenseRows,
      contractTermMonths,
      exchangeRateKesUsd: numberOrZero(exchangeRateKesUsd),
    });
    const decision = deriveDecision({
      irr: metrics.irr,
      paybackMonths: metrics.submittedPaybackMonths,
      subsidyRequirement: numberOrZero(subsidyRequirement),
      capex: metrics.nrc,
    });

    return {
      ...metrics,
      decision: {
        ...decision,
        reason: `Guidance 1: ${metrics.guidance1}. Guidance 2: ${metrics.guidance2}.`,
      },
      isAccepted: metrics.guidance1 === "Proceed",
    };
  }, [
    contractTermMonths,
    exchangeRateKesUsd,
    otherExpenseRows,
    rows,
    subsidyRequirement,
  ]);
  const routesToSalesOperations = shouldRouteSubsidyToSalesOperations(
    numberOrZero(subsidyRequirement),
  );
  const submitRouteLabel = routesToSalesOperations ? "Sales Ops" : "Finance";

  useEffect(() => {
    return bindFormAutoSave(formRef.current);
  }, [
    bindFormAutoSave,
    isReady,
    activeTab,
    rows,
    otherExpenseRows,
    contractTermMonths,
    subsidyRequirement,
  ]);

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

  function updateRowOnnetOffnet(id: number, onnetOffnet: LinkOnnetOffnet) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              onnetOffnet,
              onnetCapacity: onnetOffnet === "Onnet" ? row.onnetCapacity : undefined,
              offnetCapacity: onnetOffnet === "3rd Party" ? row.offnetCapacity : undefined,
              providerName: onnetOffnet === "3rd Party" ? row.providerName : undefined,
            }
          : row,
      ),
    );
  }

  function updateRowRevenue(id: number, field: "mrc" | "mrr" | "nrr", value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function updateRowCapacity(
    id: number,
    field: "onnetCapacity" | "offnetCapacity",
    value: string,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addOtherExpenseRow() {
    setOtherExpenseRows((current) => [
      ...current,
      {
        id: Date.now(),
        label: "",
        monthlyCost: "0",
      },
    ]);
  }

  function removeOtherExpenseRow(id: number) {
    setOtherExpenseRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }

  function updateOtherExpenseRow(
    id: number,
    field: "label" | "monthlyCost",
    value: string,
  ) {
    setOtherExpenseRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function handleSubmit() {
    clearDraft();
  }

  function downloadBcTemplateGuidance() {
    const content = buildBcTemplateGuidanceDownload(financialMetrics);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = bcTemplateGuidanceFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function goToNextTab() {
    if (!validateVisibleTabPanel(formRef.current)) {
      notifyFormValidationError();
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
              <PreparedBcDetailsTab
                project={project}
                savedDraft={savedDraft}
                isFibreReady={isFibreReady}
                hasExistingPboq={hasExistingPboq}
                contractTermMonths={contractTermMonths}
                onContractTermMonthsChange={setContractTermMonths}
              />
            </TabsContent>

            <TabsContent value="links">
              <PreparedBcLinksTab
                rows={rows}
                revenueTotals={revenueTotals}
                savedDraft={savedDraft}
                onAddRow={addRow}
                onRemoveRow={removeRow}
                onUpdateRowOnnetOffnet={updateRowOnnetOffnet}
                onUpdateRowRevenue={updateRowRevenue}
                onUpdateRowCapacity={updateRowCapacity}
              />
            </TabsContent>

            <TabsContent value="metrics">
              <PreparedBcMetricsTab
                project={project}
                savedDraft={savedDraft}
                isFibreReady={isFibreReady}
                usesActualSurveyCost={usesActualSurveyCost}
                actualSurveyCost={actualSurveyCost}
                pboqBudget={pboqBudget}
                bcInputBudget={bcInputBudget}
                revenueTotals={revenueTotals}
                financialMetrics={financialMetrics}
                otherExpenseRows={otherExpenseRows}
                subsidyRequirement={subsidyRequirement}
                onSubsidyRequirementChange={setSubsidyRequirement}
                onAddOtherExpenseRow={addOtherExpenseRow}
                onRemoveOtherExpenseRow={removeOtherExpenseRow}
                onUpdateOtherExpenseRow={updateOtherExpenseRow}
              />
            </TabsContent>
          </CardContent>

          <div className="flex justify-end border-t border-[color:var(--color-border)] px-4 py-3">
            {isFinalTab ? (
              <FormSubmitButton pendingLabel="Submitting BC…">
                <Save className="h-4 w-4" aria-hidden="true" />
                Submit BC to {submitRouteLabel}
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

