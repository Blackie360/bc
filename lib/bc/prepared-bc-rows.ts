import { capacityMbpsInputValue } from "@/lib/capacity";
import { parseKickoffLinkNotes } from "@/lib/pboq-kickoff-links";
import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { ProjectRecord } from "@/lib/project-record-types";
import {
  normalizeLinkOnnetOffnet,
  type LinkOnnetOffnet,
} from "@/lib/projects-types";
import { formatMetricInput } from "@/lib/bc/template-metrics";

export type LinkRowState = {
  id: number;
  linkName?: string;
  service?: string;
  technology?: string;
  onnetOffnet?: LinkOnnetOffnet;
  costSource?: "PBOQ" | "Fibre Ready" | "Actual Survey" | "3rd Party Quote";
  onnetCapacity?: string;
  offnetCapacity?: string;
  providerName?: string;
  newBuildCost?: string;
  provisioningCost?: string;
  materialCost?: string;
  wayleaveCost?: string;
  mrc?: string;
  mrr?: string;
  nrr?: string;
};

export type OtherExpenseRowState = {
  id: number;
  label?: string;
  monthlyCost?: string;
};

export function isFibreReadyProject(project: ProjectRecord) {
  return (
    project.pboqRequest?.technology === "Fibre Ready" ||
    project.pboqRequest?.costSource === "FIBRE_READY"
  );
}

export function defaultRevenueForNewRow(project: ProjectRecord, linkCount: number) {
  const mrr = linkCount > 0 ? formatMetricInput(project.opportunityMrr / linkCount) : "0";
  const nrr = linkCount > 0 ? formatMetricInput(project.opportunityNrr / linkCount) : "0";
  const mrc = "0";

  return {
    mrc,
    mrr,
    nrr,
  };
}

export function bcTemplateFileNames(draft?: PreparedBcDraft | null) {
  const attachments = draft?.bcTemplates ?? (draft?.bcTemplate ? [draft.bcTemplate] : []);

  return attachments.length > 0 ? attachments.map((attachment) => attachment.name).join(", ") : undefined;
}

function mapDraftLinkToRow(
  link: NonNullable<PreparedBcDraft["links"]>[number],
  index: number,
): LinkRowState {
  const mrc = link.mrc && link.mrc.length > 0 ? link.mrc : "0";
  const mrr = link.mrr && link.mrr.length > 0 ? link.mrr : "0";
  const nrr = link.nrr && link.nrr.length > 0 ? link.nrr : "0";

  return {
    id: index + 1,
    linkName: link.linkName,
    service: link.service ?? "DIA",
    technology: link.technology ?? "Fiber",
    onnetOffnet: normalizeLinkOnnetOffnet(link.onnetOffnet),
    costSource: link.costSource ?? "PBOQ",
    onnetCapacity: capacityMbpsInputValue(link.onnetCapacity),
    offnetCapacity: capacityMbpsInputValue(link.offnetCapacity),
    providerName: link.providerName,
    newBuildCost: link.newBuildCost,
    provisioningCost: link.provisioningCost,
    materialCost: link.materialCost,
    wayleaveCost: link.wayleaveCost,
    mrc,
    mrr,
    nrr,
  };
}

export function buildInitialLinkRows(
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
      onnetOffnet: normalizeLinkOnnetOffnet(link.onnetOffnet),
      costSource: link.costSource ?? defaultCostSource,
      onnetCapacity: capacityMbpsInputValue(link.onnetCapacity),
      offnetCapacity: capacityMbpsInputValue(link.offnetCapacity),
      providerName: link.providerName ?? undefined,
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
      onnetCapacity: capacityMbpsInputValue(kickoff.capacity ?? project.capacity),
      newBuildCost: String(line.build),
      materialCost: String(line.material),
      wayleaveCost: String(line.wayleave),
      provisioningCost: "0",
      ...defaultRevenueForNewRow(project, costLines.length),
    };
  });
}

export function buildInitialOtherExpenseRows(draft?: PreparedBcDraft | null): OtherExpenseRowState[] {
  if (draft?.otherExpenses && draft.otherExpenses.length > 0) {
    return draft.otherExpenses.map((expense, index) => ({
      id: index + 1,
      label: expense.label,
      monthlyCost: expense.monthlyCost,
    }));
  }

  return [{ id: 1, label: "", monthlyCost: "0" }];
}
