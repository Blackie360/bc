import "server-only";

import { deriveDecision } from "@/lib/workflow";
import type { ProjectDocumentRecord, ProjectRecord } from "@/lib/project-record-types";
import { buildReference, createId } from "@/lib/projects/ids";
import type { ProjectInput } from "@/lib/projects/schemas";

function localDecision(input: Pick<ProjectInput, "irr" | "payback" | "subsidy" | "capex">) {
  return deriveDecision({
    irr: input.irr,
    paybackMonths: input.payback,
    subsidyRequirement: input.subsidy,
    capex: input.capex,
  }).decision;
}

function localVariance(actualSpend: number, approvedBudget: number) {
  if (approvedBudget === 0) return 0;

  return Number((((actualSpend - approvedBudget) / approvedBudget) * 100).toFixed(1));
}

export function localDocument(
  attachment: {
    type: ProjectDocumentRecord["type"];
    name: string;
    mimeType: string;
    sizeBytes: number;
  },
  createdAt = new Date().toISOString(),
): ProjectDocumentRecord {
  return {
    id: createId(),
    type: attachment.type,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt,
  };
}

export function createLocalProjectRecord(
  input: ProjectInput,
  overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
  const now = new Date().toISOString();
  const id = overrides.id ?? buildReference();
  const approvedBudget = overrides.approvedBudget ?? input.approvedBudget;
  const actualSpend = overrides.actualSpend ?? input.actualSpend;
  const links = overrides.links ?? [];
  const opportunityMrr =
    overrides.opportunityMrr ?? links.reduce((total, link) => total + link.mrr, 0);
  const opportunityNrr =
    overrides.opportunityNrr ?? links.reduce((total, link) => total + link.nrr, 0);

  return {
    id,
    customer: input.customer,
    title: input.title,
    siteName: overrides.siteName ?? input.title,
    siteCoordinates: overrides.siteCoordinates ?? "",
    requiredService: overrides.requiredService ?? "Unspecified",
    capacity: overrides.capacity ?? "",
    salesRequestor: overrides.salesRequestor ?? input.owner,
    leadNetworkPlanner: overrides.leadNetworkPlanner ?? "Unassigned",
    dateRequested: overrides.dateRequested ?? now,
    designPlanDate: overrides.designPlanDate ?? null,
    region: input.region,
    owner: input.owner,
    accountManagerName: overrides.accountManagerName ?? input.owner,
    accountNumber: overrides.accountNumber ?? "",
    solutionArchitectureName: overrides.solutionArchitectureName ?? "Unassigned",
    solutionEngineerName: overrides.solutionEngineerName ?? "Unassigned",
    projectExecutiveSummary: overrides.projectExecutiveSummary ?? "",
    opportunityMrr,
    opportunityNrr,
    contractTermMonths: overrides.contractTermMonths ?? 12,
    exchangeRateKesUsd: overrides.exchangeRateKesUsd ?? 0,
    pboqRequest: overrides.pboqRequest,
    links,
    documents: overrides.documents ?? [],
    totalMrr: overrides.totalMrr ?? (links.reduce((total, link) => total + link.mrr, 0) || opportunityMrr),
    totalMrc: overrides.totalMrc ?? links.reduce((total, link) => total + link.mrc, 0),
    totalNrc: overrides.totalNrc ?? links.reduce((total, link) => total + link.nrc, 0),
    totalNrr: overrides.totalNrr ?? (links.reduce((total, link) => total + link.nrr, 0) || opportunityNrr),
    nrv: overrides.nrv,
    tcv: overrides.tcv,
    state: input.state,
    roleQueue: input.roleQueue,
    type: input.type,
    irr: input.irr,
    payback: input.payback,
    capex: input.capex,
    subsidy: input.subsidy,
    approvedBudget,
    actualSpend,
    decision: overrides.decision ?? localDecision(input),
    certificateIssued: overrides.certificateIssued ?? false,
    certificate: overrides.certificate ?? null,
    variance: overrides.variance ?? localVariance(actualSpend, approvedBudget),
    surveyDeviation: input.surveyDeviation,
    revisions: overrides.revisions ?? 0,
    due: input.due,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function updateLocalProjectRecord(
  project: ProjectRecord,
  input: ProjectInput,
): ProjectRecord {
  return {
    ...project,
    ...createLocalProjectRecord(input, {
      id: project.id,
      siteName: project.siteName,
      siteCoordinates: project.siteCoordinates,
      requiredService: project.requiredService,
      capacity: project.capacity,
      salesRequestor: project.salesRequestor,
      leadNetworkPlanner: project.leadNetworkPlanner,
      dateRequested: project.dateRequested,
      designPlanDate: project.designPlanDate,
      accountManagerName: project.accountManagerName,
      solutionArchitectureName: project.solutionArchitectureName,
      solutionEngineerName: project.solutionEngineerName,
      accountNumber: project.accountNumber,
      projectExecutiveSummary: project.projectExecutiveSummary,
      opportunityMrr: project.opportunityMrr,
      opportunityNrr: project.opportunityNrr,
      contractTermMonths: project.contractTermMonths,
      exchangeRateKesUsd: project.exchangeRateKesUsd,
      pboqRequest: project.pboqRequest,
      links: project.links,
      documents: project.documents,
      certificateIssued: project.certificateIssued,
      certificate: project.certificate,
      revisions: project.revisions + 1,
      createdAt: project.createdAt,
    }),
    updatedAt: new Date().toISOString(),
  };
}
