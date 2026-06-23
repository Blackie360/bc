import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { normalizeCapacityMbpsInput } from "@/lib/capacity";
import {
  preparedBcDraftSchema,
  type PreparedBcDraft,
  type PreparedBcDraftLink,
} from "@/lib/project-lifecycle-storage";
import {
  encodeKickoffLinkNotes,
  pboqKickoffLinkInputSchema,
  type PboqCostLineRecord,
  type PboqKickoffLinkInput,
} from "@/lib/pboq-kickoff-links";
import {
  linkCostSourceValues,
  linkOnnetOffnetValues,
} from "@/lib/projects-types";
import { shouldRouteSubsidyToSalesOperations } from "@/lib/subsidy-routing";

export {
  encodeKickoffLinkNotes,
  KICKOFF_LINK_NOTES_MARKER,
  parseKickoffLinkNotes,
  pboqKickoffLinkInputSchema,
  type PboqCostLineRecord,
  type PboqKickoffLinkInput,
} from "@/lib/pboq-kickoff-links";
import {
  deriveDecision,
  roles,
  workflowTransitions,
  workflowStates,
  type BusinessCaseType,
  type Role,
  type WorkflowState,
} from "@/lib/workflow";

export type { PreparedBcDraft, PreparedBcDraftLink };
export { preparedBcDraftSchema };

function createId() {
  return randomUUID();
}

export const projectInputSchema = z.object({
  customer: z.string().min(2),
  title: z.string().min(3),
  region: z.string().min(2),
  owner: z.string().min(2),
  state: z.enum(workflowStates),
  roleQueue: z.enum(roles),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  actualSpend: z.coerce.number().nonnegative(),
  surveyDeviation: z.coerce.number(),
  due: z.string().min(2),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export {
  linkCostSourceValues,
  linkOnnetOffnetValues,
  type LinkCostSource,
  type LinkOnnetOffnet,
} from "@/lib/projects-types";

export const bcLinkInputSchema = z.object({
  linkName: z.string().min(1),
  service: z.string().min(1),
  technology: z.string().min(1),
  onnetOffnet: z.enum(linkOnnetOffnetValues),
  costSource: z.enum(linkCostSourceValues),
  newBuildCost: z.coerce.number().nonnegative(),
  provisioningCost: z.coerce.number().nonnegative(),
  materialCost: z.coerce.number().nonnegative(),
  wayleaveCost: z.coerce.number().nonnegative(),
  mrr: z.coerce.number().nonnegative(),
  mrc: z.coerce.number().nonnegative(),
  nrc: z.coerce.number().nonnegative(),
  nrr: z.coerce.number(),
  nrv: z.coerce.number().nonnegative().default(0),
  tcv: z.coerce.number().nonnegative().default(0),
  onnetCapacity: z.string().optional(),
  offnetCapacity: z.string().optional(),
  evidenceAttachmentIndex: z.number().int().nonnegative().optional(),
});

export const bcSubmissionInputSchema = z.object({
  opportunityNumber: z.string().min(2),
  customerName: z.string().min(2),
  solutionArchitectureName: z.string().min(2),
  solutionEngineerName: z.string().min(2),
  accountManagerName: z.string().min(2),
  region: z.string().min(2).default("Unassigned"),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  nrv: z.coerce.number(),
  tcv: z.coerce.number().nonnegative(),
  exchangeRateKesUsd: z.coerce.number().positive(),
  links: z.array(bcLinkInputSchema).min(1),
  accountNumber: z.string().min(1),
  contractTermMonths: z.coerce.number().int().positive(),
  projectExecutiveSummary: z.string().min(10),
  attachments: z.array(
    z.object({
      type: z.enum([
        "LSO",
        "BC_TEMPLATE",
        "PBOQ",
        "ACTUAL_SURVEY_QUOTE",
        "CONTRACTOR_QUOTE",
        "ORDER_FORM",
      ]),
      name: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      storageKey: z.string().min(1),
    }),
  ),
});

export type BcSubmissionInput = z.infer<typeof bcSubmissionInputSchema>;

export const pboqRequestInputSchema = z
  .object({
    opportunityNumber: z.string().min(2),
    customerName: z.string().min(2),
    technology: z.enum(["Fibre Ready", "Fibre Entry", "Wireless"]),
    siteName: z.string().min(2),
    siteCoordinates: z.string().min(2),
    dateRequested: z.string().min(1),
    salesRequestor: z.string().min(2),
    leadNetworkPlanner: z.string().min(2),
    designPlanDate: z.string().min(1),
    accountManagerName: z.string().min(2),
    region: z.string().min(2),
    segment: z.string().min(2),
    mrr: z.coerce.number().nonnegative(),
    nrr: z.coerce.number().nonnegative(),
    contractTermMonths: z.coerce.number().int().positive(),
    pboqMode: z.enum(["existing", "request"]).default("request"),
    routeDistanceKm: z.coerce.number().nonnegative().default(0),
    siteCount: z.coerce.number().int().nonnegative().default(0),
    surveyAvailable: z.boolean().default(false),
    actualSurveyCost: z.coerce.number().nonnegative().default(0),
    notes: z.string().optional(),
    links: z.array(pboqKickoffLinkInputSchema).min(1),
    pboqAttachment: z
      .object({
        type: z.literal("PBOQ"),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      })
      .optional(),
  })
  .refine(
    (input) => !input.surveyAvailable || input.actualSurveyCost > 0,
    {
      message: "Actual survey cost is required when the survey is already conducted.",
      path: ["actualSurveyCost"],
    },
  )
  .refine(
    (input) => input.pboqMode !== "existing" || Boolean(input.pboqAttachment),
    {
      message: "Existing PBOQ attachment is required.",
      path: ["pboqAttachment"],
    },
  );

export type PboqRequestInput = z.infer<typeof pboqRequestInputSchema>;

export const pboqCostLineInputSchema = z.object({
  linkName: z.string().min(1),
  siteCoordinates: z.string().min(2).optional(),
  material: z.coerce.number().nonnegative(),
  build: z.coerce.number().nonnegative(),
  wayleave: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

const pboqAttachmentInputSchema = z.object({
  type: z.literal("PBOQ"),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storageKey: z.string().min(1),
});

export const fiberPlanningLineInputSchema = pboqCostLineInputSchema.extend({
  pboqFile: pboqAttachmentInputSchema,
});

export const fiberPlanningInputSchema = z.object({
  fiberPlanningNotes: z.string().optional(),
  lines: z.array(fiberPlanningLineInputSchema).min(1),
  kickoffLinkCount: z.coerce.number().int().positive().optional(),
});

export type FiberPlanningInput = z.infer<typeof fiberPlanningInputSchema>;
export type WirelessPlanningInput = FiberPlanningInput;

export const preparedBcInputSchema = z.object({
  customerName: z.string().min(2),
  accountNumber: z.string().min(1),
  opportunityNumber: z.string().min(2),
  accountManagerName: z.string().min(2),
  solutionArchitectureName: z.string().min(2),
  solutionEngineerName: z.string().min(2),
  contractTermMonths: z.coerce.number().int().positive(),
  projectExecutiveSummary: z.string().min(10),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  nrv: z.coerce.number().nonnegative(),
  tcv: z.coerce.number().nonnegative(),
  exchangeRateKesUsd: z.coerce.number().positive(),
  links: z.array(bcLinkInputSchema).min(1),
  lsoAttachment: z.object({
    type: z.literal("LSO"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
  bcTemplates: z
    .array(
      z.object({
        type: z.literal("BC_TEMPLATE"),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      }),
    )
    .min(1),
  pboqOrSurveyAttachment: z
    .object({
      type: z.enum(["PBOQ", "ACTUAL_SURVEY_QUOTE"]),
      name: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      storageKey: z.string().min(1),
    })
    .optional(),
  thirdPartyQuotesAttachment: z
    .object({
      type: z.literal("CONTRACTOR_QUOTE"),
      name: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      storageKey: z.string().min(1),
    })
    .optional(),
  linkEvidenceAttachments: z
    .array(
      z.object({
        type: z.enum(["PBOQ", "ACTUAL_SURVEY_QUOTE", "CONTRACTOR_QUOTE"]),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      }),
    )
    .default([]),
});

export type PreparedBcInput = z.infer<typeof preparedBcInputSchema>;

export type BcDraftInput = {
  opportunityNumber: string;
  customerName: string;
  accountNumber: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  accountManagerName: string;
  contractTermMonths: number;
  projectExecutiveSummary: string;
  region: string;
  type: BusinessCaseType;
  irr: number;
  payback: number;
  capex: number;
  subsidy: number;
  approvedBudget: number;
  nrv: number;
  tcv: number;
  exchangeRateKesUsd: number;
  links: Array<z.infer<typeof bcLinkInputSchema> & { evidenceAttachmentIndex?: number }>;
  attachments: BcSubmissionInput["attachments"];
};

export type { ProjectLinkRecord } from "@/lib/project-record-types";
import type { ProjectLinkRecord } from "@/lib/project-record-types";

function linkNrcTotal(link: {
  newBuildCost: number;
  provisioningCost: number;
  materialCost: number;
  wayleaveCost: number;
}) {
  return link.newBuildCost + link.provisioningCost + link.materialCost + link.wayleaveCost;
}

function mapLinkInputToRecord(
  link: z.infer<typeof bcLinkInputSchema>,
  evidenceDocumentId: string | null,
  id = createId(),
): ProjectLinkRecord {
  const newBuildCost = link.newBuildCost;
  const provisioningCost = link.provisioningCost;
  const materialCost = link.materialCost;
  const wayleaveCost = link.wayleaveCost;
  const computedNrc = linkNrcTotal({
    newBuildCost,
    provisioningCost,
    materialCost,
    wayleaveCost,
  });

  return {
    id,
    linkName: link.linkName,
    service: link.service,
    technology: link.technology,
    onnetOffnet: link.onnetOffnet,
    costSource: link.costSource,
    newBuildCost,
    provisioningCost,
    materialCost,
    wayleaveCost,
    mrr: link.mrr,
    mrc: link.mrc,
    nrc: link.nrc > 0 ? link.nrc : computedNrc,
    nrr: link.nrr,
    nrv: link.nrv,
    tcv: link.tcv,
    onnetCapacity: link.onnetCapacity ?? null,
    offnetCapacity: link.offnetCapacity ?? null,
    evidenceDocumentId,
  };
}


export type { ProjectDocumentRecord } from "@/lib/project-record-types";
import type { ProjectDocumentRecord } from "@/lib/project-record-types";

export function mapKickoffLinksToCostLineRecords(
  links: PboqKickoffLinkInput[],
): PboqCostLineRecord[] {
  return links.map((link) => ({
    id: createId(),
    linkName: link.linkName.trim(),
    siteCoordinates: link.siteCoordinates.trim(),
    material: 0,
    build: 0,
    wayleave: 0,
    pboqDocumentId: null,
    notes: encodeKickoffLinkNotes({
      region: link.region,
      siteCoordinates: link.siteCoordinates,
      buildingName: link.buildingName,
      service: link.service,
      capacity: link.capacity,
    }),
  }));
}

export type {
  FinanceDecisionRecord,
  PboqRequestRecord,
  ProjectRecord,
} from "@/lib/project-record-types";
import type {
  BcApprovalCertificateRecord,
  FinanceDecisionRecord,
  ProjectRecord,
} from "@/lib/project-record-types";

export type FinanceDecision =
  | "approve"
  | "reject"
  | "escalate-cfo"
  | "question-architect";

export type FinanceDecisionInput = {
  decision: FinanceDecision;
  notes: string;
};

export type SalesOperationsDiscrepancyInput = {
  notes: string;
};

export type SduAlignmentMismatchInput = {
  notes: string;
};

export type SduSurveyCostInput = {
  actualSurveyCost: number;
};

export const SURVEY_COST_DEVIATION_THRESHOLD_PERCENT = 10;

export function isAccountManagerBcPreparationStage(project: ProjectRecord) {
  return (
    project.roleQueue === "Account Manager" &&
    project.state === "Business Case Prepared" &&
    project.decision === "PENDING" &&
    Boolean(project.pboqRequest?.completedAt)
  );
}

export function canEditProject(project: ProjectRecord) {
  if (
    project.roleQueue === "Fiber Planning Team" ||
    project.roleQueue === "Wireless Planning Team"
  ) {
    return false;
  }

  if (isAccountManagerBcPreparationStage(project)) {
    return false;
  }

  return true;
}

export function projectDecisionStatus(project: Pick<ProjectRecord, "decision">) {
  return project.decision === "PENDING" ? "Pending" : "Done";
}

export function hasPboqDocumentAttachment(project: ProjectRecord) {
  return project.documents.some(
    (document) => document.type === "PBOQ" || document.type === "ACTUAL_SURVEY_QUOTE",
  );
}

const certificateDistributionRecipients: BcApprovalCertificateRecord["distributedTo"] = [
  "Sales Operations",
  "Account Manager",
  "Designated SDU Officer",
  "Full SDU Team",
];

function buildReference() {
  return `BC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function localProjectStoragePath() {
  return (
    process.env.PROJECT_LOCAL_STORAGE_FILE ??
    path.join(process.cwd(), ".data", "projects.json")
  );
}

async function readLocalProjects(): Promise<ProjectRecord[]> {
  try {
    const contents = await readFile(localProjectStoragePath(), "utf8");
    const parsed = JSON.parse(contents);

    return Array.isArray(parsed) ? (parsed as ProjectRecord[]) : [];
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

async function writeLocalProjects(projects: ProjectRecord[]) {
  const filePath = localProjectStoragePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function updateLocalProjects(
  updater: (projects: ProjectRecord[]) => ProjectRecord[] | Promise<ProjectRecord[]>,
) {
  const projects = await readLocalProjects();
  const updatedProjects = await updater(projects);
  await writeLocalProjects(updatedProjects);
  return updatedProjects;
}

function localDocument(
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

function generatedCertificateSize(project: ProjectRecord) {
  return Buffer.byteLength(
    [
      `BC Approval Certificate: ${project.id}`,
      `Customer: ${project.customer}`,
      `Opportunity: ${project.id}`,
      `Approved Budget: ${project.approvedBudget}`,
      `Decision: ${project.decision}`,
    ].join("\n"),
    "utf8",
  );
}

function issueBcApprovalCertificate(project: ProjectRecord, issuedAt: string): ProjectRecord {
  const existingCertificateDocument = project.documents.find(
    (document) => document.type === "BC_APPROVAL_CERTIFICATE",
  );

  if (project.certificateIssued && project.certificate && existingCertificateDocument) {
    return project;
  }

  const document =
    existingCertificateDocument ??
    localDocument(
      {
        type: "BC_APPROVAL_CERTIFICATE",
        name: `BC Approval Certificate - ${project.id}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: generatedCertificateSize(project),
      },
      issuedAt,
    );

  return {
    ...project,
    certificateIssued: true,
    certificate: {
      id: project.certificate?.id ?? createId(),
      documentId: document.id,
      salesforceOpportunityId: project.id,
      salesforceUploadStatus: "uploaded",
      distributedTo: certificateDistributionRecipients,
      issuedAt,
    },
    documents: existingCertificateDocument ? project.documents : [document, ...project.documents],
  };
}

function revokeBcApprovalCertificate(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    certificateIssued: false,
    certificate: null,
    documents: project.documents.filter(
      (document) => document.type !== "BC_APPROVAL_CERTIFICATE",
    ),
  };
}

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

function createLocalProjectRecord(
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

function updateLocalProjectRecord(project: ProjectRecord, input: ProjectInput): ProjectRecord {
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

function localRouteForPreparedBusinessCase(subsidyUsd: number): {
  state: WorkflowState;
  role: Role;
  autoApproved: boolean;
} {
  if (shouldRouteSubsidyToSalesOperations(subsidyUsd)) {
    return {
      state: "Sales Operations Validation",
      role: "Sales Operations",
      autoApproved: true,
    };
  }

  return {
    state: "Finance / CFO Approval",
    role: "BC Analyst / Finance",
    autoApproved: false,
  };
}

function localFinanceRoute(
  project: ProjectRecord,
  decision: FinanceDecision,
): { state: WorkflowState; role: Role } {
  switch (decision) {
    case "approve":
      return { state: "Sales Operations Validation", role: "Sales Operations" };
    case "reject":
      return { state: project.state, role: project.roleQueue };
    case "escalate-cfo":
      return { state: "Finance / CFO Approval", role: "CFO" };
    case "question-architect":
      return { state: "Business Case Prepared", role: "Solutions Architect" };
    default: {
      const exhaustive: never = decision;
      return exhaustive;
    }
  }
}

function localFinanceDecisionRecord(input: FinanceDecisionInput): FinanceDecisionRecord {
  const notes = input.notes.trim();
  if (notes.length < 3) {
    throw new Error("Finance comments are required.");
  }

  return {
    id: createId(),
    decision: input.decision,
    notes,
    createdAt: new Date().toISOString(),
  };
}

function localSalesOperationsDiscrepancyRecord(
  input: SalesOperationsDiscrepancyInput,
): FinanceDecisionRecord {
  const notes = input.notes.trim();
  if (notes.length < 3) {
    throw new Error("Discrepancy notes are required.");
  }

  return {
    id: createId(),
    decision: "sales-ops-discrepancy",
    notes,
    createdAt: new Date().toISOString(),
  };
}

function localSduAlignmentMismatchRecord(
  input: SduAlignmentMismatchInput,
): FinanceDecisionRecord {
  const notes = input.notes.trim();
  if (notes.length < 3) {
    throw new Error("SDU mismatch justification is required.");
  }

  return {
    id: createId(),
    decision: "sdu-alignment-mismatch",
    notes,
    createdAt: new Date().toISOString(),
  };
}

function localSduSurveyVarianceRecord(input: {
  actualSurveyCost: number;
  baselineSurveyCost: number;
  deviationPercent: number;
}): FinanceDecisionRecord {
  return {
    id: createId(),
    decision: "sdu-survey-variance",
    notes: [
      "Actual survey cost exceeded the SDU variance threshold.",
      `Baseline survey cost: ${input.baselineSurveyCost}`,
      `Actual survey cost: ${input.actualSurveyCost}`,
      `Deviation: ${input.deviationPercent}%`,
    ].join("\n"),
    createdAt: new Date().toISOString(),
  };
}

async function localListProjects() {
  return readLocalProjects();
}

async function localGetProject(id: string) {
  return (await readLocalProjects()).find((project) => project.id === id);
}

async function localCreateProject(input: ProjectInput) {
  const project = createLocalProjectRecord(projectInputSchema.parse(input));
  await updateLocalProjects((projects) => [project, ...projects]);
  return project;
}

async function localUpdateProject(id: string, input: ProjectInput) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      updatedProject = updateLocalProjectRecord(project, projectInputSchema.parse(input));
      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

function deriveProjectRequiredService(
  links: Array<{ service?: "EPL" | "DIA" | "DFA" }>,
): "EPL" | "DIA" | "DFA" {
  const services = links.map((link) => link.service);

  if (services.some((service) => !service)) {
    throw new Error("Each service link requires a service.");
  }

  return services[0]!;
}

function deriveProjectCapacity(links: Array<{ capacity?: string }>) {
  const values = links
    .map((link) => normalizeCapacityMbpsInput(link.capacity))
    .filter((value): value is string => Boolean(value));

  if (values.length !== links.length) {
    throw new Error("Each service link requires a valid Mbps capacity.");
  }

  return [...new Set(values)].join(", ");
}

export function isFibreReadyOpportunity(project: ProjectRecord) {
  return project.pboqRequest?.technology === "Fibre Ready" || project.pboqRequest?.costSource === "FIBRE_READY";
}

export function planningRoleForProject(project: ProjectRecord): Role | null {
  const technology = project.pboqRequest?.technology;

  if (technology === "Fibre Entry") {
    return "Fiber Planning Team";
  }

  if (technology === "Wireless") {
    return "Wireless Planning Team";
  }

  return null;
}

export function projectBelongsToRole(project: ProjectRecord, role: Role) {
  const planningRole = planningRoleForProject(project);
  const belongsByRetainedPlanning =
    planningRole === role && Boolean(project.pboqRequest?.completedAt);

  if (project.roleQueue === role) {
    return true;
  }

  return belongsByRetainedPlanning;
}

function planningRoleForTechnology(technology: PboqRequestInput["technology"]): Role {
  switch (technology) {
    case "Fibre Entry":
      return "Fiber Planning Team";
    case "Wireless":
      return "Wireless Planning Team";
    case "Fibre Ready":
      return "Account Manager";
    default: {
      const exhaustive: never = technology;
      return exhaustive;
    }
  }
}

async function localCreatePboqRequest(input: PboqRequestInput) {
  const validated = pboqRequestInputSchema.parse(input);
  const projects = await readLocalProjects();

  if (projects.some((project) => project.id === validated.opportunityNumber)) {
    throw new Error("Opportunity number already exists.");
  }

  const now = new Date().toISOString();
  const hasExistingPboq = validated.pboqMode === "existing";
  const isFibreReady = validated.technology === "Fibre Ready";
  const kickoffCostLines = mapKickoffLinksToCostLineRecords(validated.links);
  const pboqDocument = validated.pboqAttachment
    ? localDocument(validated.pboqAttachment, now)
    : undefined;
  const planningRole = planningRoleForTechnology(validated.technology);
  const project = createLocalProjectRecord(
    {
      customer: validated.customerName,
      title: validated.siteName,
      region: validated.region,
      owner: validated.accountManagerName,
      state: "Opportunity Created",
      roleQueue: "Account Manager",
      type: "Ordinary BC",
      irr: 0,
      payback: 36,
      capex: 0,
      subsidy: 0,
      approvedBudget: validated.surveyAvailable ? validated.actualSurveyCost : 0,
      actualSpend: 0,
      surveyDeviation: 0,
      due: "Unscheduled",
    },
    {
      id: validated.opportunityNumber,
      siteName: validated.siteName,
      siteCoordinates: validated.siteCoordinates,
      requiredService: deriveProjectRequiredService(validated.links),
      capacity: deriveProjectCapacity(validated.links),
      salesRequestor: validated.salesRequestor,
      leadNetworkPlanner: validated.leadNetworkPlanner,
      dateRequested: new Date(validated.dateRequested).toISOString(),
      designPlanDate: new Date(validated.designPlanDate).toISOString(),
      opportunityMrr: validated.mrr,
      opportunityNrr: validated.nrr,
      contractTermMonths: validated.contractTermMonths,
      totalMrr: validated.mrr,
      totalNrr: validated.nrr,
      decision: "PENDING",
      documents: pboqDocument ? [pboqDocument] : [],
      pboqRequest: {
        id: createId(),
        technology: validated.technology,
        siteCount: validated.links.length,
        routeDistanceKm: validated.routeDistanceKm,
        surveyBudget: validated.surveyAvailable ? validated.actualSurveyCost : 0,
        surveyAvailable: validated.surveyAvailable,
        costSource: isFibreReady
          ? "FIBRE_READY"
          : validated.surveyAvailable
            ? "ACTUAL_SURVEY"
            : "PBOQ_ESTIMATE",
        actualSurveyCost: validated.actualSurveyCost,
        notes: validated.notes || null,
        fiberPlanningNotes: null,
        completedAt: hasExistingPboq || isFibreReady ? now : null,
        costLines: kickoffCostLines,
      },
    },
  );

  await writeLocalProjects([project, ...projects]);
  return project;
}

function assertFiberPlanningLineCount(
  kickoffLinkCount: number | undefined,
  submittedLineCount: number,
) {
  if (kickoffLinkCount == null || kickoffLinkCount <= 1) {
    return;
  }

  if (submittedLineCount !== kickoffLinkCount) {
    throw new Error(
      `This project has ${kickoffLinkCount} links. Enter costs and upload a PBOQ for each link.`,
    );
  }
}

async function localCompleteFiberPlanning(id: string, input: FiberPlanningInput) {
  const validated = fiberPlanningInputSchema.parse(input);
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      if (!project.pboqRequest) throw new Error("Project has no PBOQ request.");
      if (
        project.state !== "PBOQ Request Submitted" &&
        project.state !== "Fiber Planning Generates Costs" &&
        project.state !== "Wireless Planning Generates Costs" &&
        project.state !== "Business Case Prepared"
      ) {
        throw new Error("Project is not in a planning stage.");
      }

      const kickoffLinkCount =
        validated.kickoffLinkCount ?? project.pboqRequest.costLines.length;
      assertFiberPlanningLineCount(kickoffLinkCount, validated.lines.length);

      const now = new Date().toISOString();
      const newDocuments: ProjectDocumentRecord[] = [];
      const pboqDocumentsByLine = validated.lines.map((line) => {
        const existingDocumentId = line.pboqFile.storageKey.startsWith("existing-document:")
          ? line.pboqFile.storageKey.replace("existing-document:", "")
          : null;
        const existingDocument = existingDocumentId
          ? project.documents.find((document) => document.id === existingDocumentId)
          : undefined;

        if (existingDocument) {
          return existingDocument;
        }

        const document = localDocument(line.pboqFile, now);
        newDocuments.push(document);
        return document;
      });
      const costLines = validated.lines.map((line, index) => ({
        id: project.pboqRequest?.costLines[index]?.id ?? createId(),
        linkName: line.linkName,
        siteCoordinates: line.siteCoordinates?.trim() || undefined,
        material: line.material,
        build: line.build,
        wayleave: line.wayleave,
        pboqDocumentId: pboqDocumentsByLine[index]?.id ?? null,
        notes: line.notes || null,
      }));
      const primarySiteCoordinates =
        costLines.find((line) => line.siteCoordinates)?.siteCoordinates ??
        project.siteCoordinates;
      const totalCost = costLines.reduce(
        (total, line) => total + line.material + line.build + line.wayleave,
        0,
      );

      updatedProject = {
        ...project,
        siteCoordinates: primarySiteCoordinates,
        state: "Business Case Prepared",
        roleQueue: "Account Manager",
        capex: totalCost,
        approvedBudget: totalCost,
        pboqRequest: {
          ...project.pboqRequest,
          surveyBudget: totalCost,
          fiberPlanningNotes: validated.fiberPlanningNotes || null,
          completedAt: now,
          costLines,
        },
        documents: [...newDocuments, ...project.documents],
        updatedAt: now,
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localPrepareBusinessCaseFromPboq(id: string, input: PreparedBcInput) {
  const validated = preparedBcInputSchema.parse(input);
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      if (!project.pboqRequest) {
        throw new Error("PBOQ attachment or request is required before BC preparation.");
      }

      const now = new Date().toISOString();
      const decision = deriveDecision({
        irr: validated.irr,
        paybackMonths: validated.payback,
        subsidyRequirement: validated.subsidy,
        capex: validated.capex,
      }).decision;
      const route = localRouteForPreparedBusinessCase(validated.subsidy);
      const newDocuments = [
        localDocument(validated.lsoAttachment, now),
        ...validated.bcTemplates.map((attachment) => localDocument(attachment, now)),
        ...(validated.pboqOrSurveyAttachment
          ? [localDocument(validated.pboqOrSurveyAttachment, now)]
          : []),
        ...(validated.thirdPartyQuotesAttachment
          ? [localDocument(validated.thirdPartyQuotesAttachment, now)]
          : []),
        ...validated.linkEvidenceAttachments.map((attachment) => localDocument(attachment, now)),
      ];
      const baseDocumentCount =
        1 +
        validated.bcTemplates.length +
        (validated.pboqOrSurveyAttachment ? 1 : 0) +
        (validated.thirdPartyQuotesAttachment ? 1 : 0);
      const links = validated.links.map((link) =>
        mapLinkInputToRecord(
          link,
          link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
            ? newDocuments[baseDocumentCount + link.evidenceAttachmentIndex]?.id ?? null
            : project.documents.find((document) => document.type === "PBOQ")?.id ?? null,
        ),
      );

      const preparedProject = {
        ...project,
        customer: validated.customerName,
        owner: validated.accountManagerName,
        accountNumber: validated.accountNumber,
        solutionArchitectureName: validated.solutionArchitectureName,
        solutionEngineerName: validated.solutionEngineerName,
        projectExecutiveSummary: validated.projectExecutiveSummary,
        contractTermMonths: validated.contractTermMonths,
        type: validated.type,
        irr: validated.irr,
        payback: validated.payback,
        capex: validated.capex,
        subsidy: validated.subsidy,
        approvedBudget: validated.approvedBudget,
        nrv: validated.nrv,
        tcv: validated.tcv,
        exchangeRateKesUsd: validated.exchangeRateKesUsd,
        decision,
        state: route.state,
        roleQueue: route.role,
        certificateIssued: project.certificateIssued,
        links,
        totalMrr: links.reduce((total, link) => total + link.mrr, 0),
        totalMrc: links.reduce((total, link) => total + link.mrc, 0),
        totalNrc: links.reduce((total, link) => total + link.nrc, 0),
        totalNrr: links.reduce((total, link) => total + link.nrr, 0),
        documents: [...newDocuments, ...project.documents],
        revisions: project.revisions + 1,
        pboqRequest: project.pboqRequest
          ? { ...project.pboqRequest, bcPreparationDraft: null }
          : project.pboqRequest,
        updatedAt: now,
      };
      updatedProject = route.autoApproved
        ? issueBcApprovalCertificate(preparedProject, now)
        : preparedProject;

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localCreateBcSubmission(input: BcSubmissionInput) {
  const validated = bcSubmissionInputSchema.parse(input);
  const projects = await readLocalProjects();

  if (projects.some((project) => project.id === validated.opportunityNumber)) {
    throw new Error("Opportunity number already exists.");
  }

  const now = new Date().toISOString();
  const decision = deriveDecision({
    irr: validated.irr,
    paybackMonths: validated.payback,
    subsidyRequirement: validated.subsidy,
    capex: validated.capex,
  }).decision;
  const route = localRouteForPreparedBusinessCase(validated.subsidy);
  const documents = validated.attachments.map((attachment) => localDocument(attachment, now));
  const links = validated.links.map((link) =>
    mapLinkInputToRecord(
      link,
      link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
        ? documents[link.evidenceAttachmentIndex]?.id ?? null
        : null,
    ),
  );
  const project = createLocalProjectRecord(
    {
      customer: validated.customerName,
      title: `${validated.customerName} BC submission`,
      region: validated.region,
      owner: validated.accountManagerName,
      state: route.state,
      roleQueue: route.role,
      type: validated.type,
      irr: validated.irr,
      payback: validated.payback,
      capex: validated.capex,
      subsidy: validated.subsidy,
      approvedBudget: validated.approvedBudget,
      actualSpend: 0,
      surveyDeviation: 0,
      due: "Unscheduled",
    },
    {
      id: validated.opportunityNumber,
      accountNumber: validated.accountNumber,
      solutionArchitectureName: validated.solutionArchitectureName,
      solutionEngineerName: validated.solutionEngineerName,
      projectExecutiveSummary: validated.projectExecutiveSummary,
      contractTermMonths: validated.contractTermMonths,
      exchangeRateKesUsd: validated.exchangeRateKesUsd,
      opportunityMrr: links.reduce((total, link) => total + link.mrr, 0),
      opportunityNrr: links.reduce((total, link) => total + link.nrr, 0),
      links,
      documents,
      totalMrr: links.reduce((total, link) => total + link.mrr, 0),
      totalMrc: links.reduce((total, link) => total + link.mrc, 0),
      totalNrc: links.reduce((total, link) => total + link.nrc, 0),
      totalNrr: links.reduce((total, link) => total + link.nrr, 0),
      nrv: validated.nrv,
      tcv: validated.tcv,
      decision,
    },
  );
  const projectWithCertificate = route.autoApproved
    ? issueBcApprovalCertificate(project, now)
    : project;

  await writeLocalProjects([projectWithCertificate, ...projects]);
  return projectWithCertificate;
}

async function localCreateBcDraft(input: BcDraftInput) {
  const referenceBase = input.opportunityNumber.trim() || buildReference();
  const projects = await readLocalProjects();
  const id = projects.some((project) => project.id === referenceBase)
    ? `${referenceBase}-DRAFT-${randomUUID().slice(0, 4).toUpperCase()}`
    : referenceBase;
  const documents = input.attachments.map((attachment) => localDocument(attachment));
  const links = input.links.map((link) =>
    mapLinkInputToRecord(
      link,
      link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
        ? documents[link.evidenceAttachmentIndex]?.id ?? null
        : null,
    ),
  );
  const project = createLocalProjectRecord(
    {
      customer: input.customerName.trim() || "Draft Customer",
      title: `${input.customerName.trim() || "Draft Customer"} draft`,
      region: input.region.trim() || "Unassigned",
      owner: input.accountManagerName.trim() || "Current User",
      state: "Opportunity Created",
      roleQueue: "Account Manager",
      type: input.type || "Ordinary BC",
      irr: Number.isFinite(input.irr) ? input.irr : 0,
      payback: Number.isFinite(input.payback) && input.payback > 0 ? input.payback : 1,
      capex: Number.isFinite(input.capex) ? input.capex : 0,
      subsidy: Number.isFinite(input.subsidy) ? input.subsidy : 0,
      approvedBudget: Number.isFinite(input.approvedBudget) ? input.approvedBudget : 0,
      actualSpend: 0,
      surveyDeviation: 0,
      due: "Unscheduled",
    },
    {
      id,
      accountNumber: input.accountNumber.trim(),
      solutionArchitectureName: input.solutionArchitectureName.trim() || "Unassigned",
      solutionEngineerName: input.solutionEngineerName.trim() || "Unassigned",
      projectExecutiveSummary: input.projectExecutiveSummary.trim(),
      contractTermMonths: input.contractTermMonths,
      exchangeRateKesUsd: input.exchangeRateKesUsd,
      links,
      documents,
      totalMrr: links.reduce((total, link) => total + link.mrr, 0),
      totalMrc: links.reduce((total, link) => total + link.mrc, 0),
      totalNrc: links.reduce((total, link) => total + link.nrc, 0),
      totalNrr: links.reduce((total, link) => total + link.nrr, 0),
      nrv: input.nrv,
      tcv: input.tcv,
    },
  );

  await writeLocalProjects([project, ...projects]);
  return project;
}

async function localDecideFinanceWorkflow(id: string, input: FinanceDecisionInput) {
  let updatedProject: ProjectRecord | undefined;
  const financeDecision = localFinanceDecisionRecord(input);

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      const route = localFinanceRoute(project, input.decision);
      const decidedProject = {
        ...project,
        state: route.state,
        roleQueue: route.role,
        financeDecisions: [...(project.financeDecisions ?? []), financeDecision],
        updatedAt: new Date().toISOString(),
      };
      updatedProject =
        input.decision === "approve"
          ? issueBcApprovalCertificate(decidedProject, financeDecision.createdAt)
          : decidedProject;

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localConfirmSalesOperationsOrder(id: string) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      if (
        project.state !== "Sales Operations Validation" ||
        project.roleQueue !== "Sales Operations"
      ) {
        throw new Error("Sales Operations review is only allowed for Sales Operations queue projects.");
      }

      updatedProject = {
        ...project,
        state: "SDU Validation",
        roleQueue: "SDU",
        updatedAt: new Date().toISOString(),
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localReportSalesOperationsDiscrepancy(
  id: string,
  input: SalesOperationsDiscrepancyInput,
) {
  let updatedProject: ProjectRecord | undefined;
  const discrepancy = localSalesOperationsDiscrepancyRecord(input);

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      if (
        project.state !== "Sales Operations Validation" ||
        project.roleQueue !== "Sales Operations"
      ) {
        throw new Error("Sales Operations discrepancy is only allowed for Sales Operations queue projects.");
      }

      updatedProject = {
        ...revokeBcApprovalCertificate(project),
        state: "Finance / CFO Approval",
        roleQueue: "BC Analyst / Finance",
        revisions: project.revisions + 1,
        financeDecisions: [...(project.financeDecisions ?? []), discrepancy],
        updatedAt: new Date().toISOString(),
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

function assertSduStage(project: ProjectRecord) {
  if (project.state !== "SDU Validation" || project.roleQueue !== "SDU") {
    throw new Error("SDU validation is only allowed for SDU queue projects.");
  }
}

function surveyCostDeviationPercent(baselineSurveyCost: number, actualSurveyCost: number) {
  if (baselineSurveyCost === 0) {
    return actualSurveyCost === 0 ? 0 : 100;
  }

  return Number(
    (Math.abs(actualSurveyCost - baselineSurveyCost) / baselineSurveyCost * 100).toFixed(1),
  );
}

async function localConfirmSduAlignment(id: string) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      assertSduStage(project);
      if (
        !isFibreReadyOpportunity(project) &&
        !project.pboqRequest?.surveyAvailable &&
        !project.pboqRequest?.actualSurveyCost
      ) {
        throw new Error("Existing survey evidence is required before proceeding to Site Acquisition.");
      }

      updatedProject = {
        ...project,
        state: "Survey & Site Acquisition",
        roleQueue: "Site Acquisition Manager",
        updatedAt: new Date().toISOString(),
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localReportSduAlignmentMismatch(
  id: string,
  input: SduAlignmentMismatchInput,
) {
  let updatedProject: ProjectRecord | undefined;
  const mismatch = localSduAlignmentMismatchRecord(input);

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      assertSduStage(project);

      updatedProject = {
        ...revokeBcApprovalCertificate(project),
        state: "Finance / CFO Approval",
        roleQueue: "BC Analyst / Finance",
        revisions: project.revisions + 1,
        financeDecisions: [...(project.financeDecisions ?? []), mismatch],
        updatedAt: mismatch.createdAt,
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localSubmitSduSurveyCost(id: string, input: SduSurveyCostInput) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      assertSduStage(project);
      if (!project.pboqRequest) {
        throw new Error("Survey handling requires a PBOQ request.");
      }

      const actualSurveyCost = z.coerce.number().nonnegative().parse(input.actualSurveyCost);
      const baselineSurveyCost = project.pboqRequest.surveyBudget || project.approvedBudget;
      const deviationPercent = surveyCostDeviationPercent(baselineSurveyCost, actualSurveyCost);
      const now = new Date().toISOString();
      const pboqRequest = {
        ...project.pboqRequest,
        surveyAvailable: true,
        costSource: "ACTUAL_SURVEY" as const,
        actualSurveyCost,
      };

      if (deviationPercent > SURVEY_COST_DEVIATION_THRESHOLD_PERCENT) {
        const variance = localSduSurveyVarianceRecord({
          actualSurveyCost,
          baselineSurveyCost,
          deviationPercent,
        });
        updatedProject = {
          ...revokeBcApprovalCertificate(project),
          state: "Business Case Prepared",
          roleQueue: "Account Manager",
          approvedBudget: actualSurveyCost,
          capex: Math.max(project.capex, actualSurveyCost),
          surveyDeviation: deviationPercent,
          revisions: project.revisions + 1,
          pboqRequest,
          financeDecisions: [...(project.financeDecisions ?? []), variance],
          updatedAt: variance.createdAt,
        };

        return updatedProject;
      }

      updatedProject = {
        ...project,
        state: "Survey & Site Acquisition",
        roleQueue: "Site Acquisition Manager",
        approvedBudget: Math.max(project.approvedBudget, actualSurveyCost),
        surveyDeviation: deviationPercent,
        pboqRequest,
        updatedAt: now,
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localAdvanceProjectToNextStage(id: string) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      const transition =
        workflowTransitions.find(
          (item) => item.from === project.state && item.owner === project.roleQueue,
        ) ?? workflowTransitions.find((item) => item.from === project.state);

      if (!transition) {
        throw new Error("Project is already at the final workflow stage.");
      }

      const nextTransition = workflowTransitions.find((item) => item.from === transition.to);
      updatedProject = {
        ...project,
        state: transition.to,
        roleQueue: nextTransition?.owner ?? transition.owner,
        updatedAt: new Date().toISOString(),
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

async function localDeleteProject(id: string) {
  await updateLocalProjects((projects) => projects.filter((project) => project.id !== id));
}

/** BC preparation drafts are stored in the browser (localStorage) for now. */
export async function savePreparedBcDraft(id: string, _draft: PreparedBcDraft) {
  void _draft;

  const project = await getProject(id);

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

export async function createPboqRequest(input: PboqRequestInput) {
  return localCreatePboqRequest(input);
}

export async function completeFiberPlanning(id: string, input: FiberPlanningInput) {
  return localCompleteFiberPlanning(id, input);
}

export async function completeWirelessPlanning(id: string, input: WirelessPlanningInput) {
  return localCompleteFiberPlanning(id, input);
}

export async function prepareBusinessCaseFromPboq(id: string, input: PreparedBcInput) {
  return localPrepareBusinessCaseFromPboq(id, input);
}

export async function createBcSubmission(input: BcSubmissionInput) {
  return localCreateBcSubmission(input);
}

export async function createBcDraft(input: BcDraftInput) {
  return localCreateBcDraft(input);
}

export async function listProjects() {
  return localListProjects();
}

export async function listProjectsForPage() {
  try {
    return {
      projects: await listProjects(),
      dataUnavailable: false,
    };
  } catch (error) {
    console.error("Failed to load projects from local storage.", error);

    return {
      projects: [],
      dataUnavailable: true,
    };
  }
}

export async function getProject(id: string) {
  return localGetProject(id);
}

export async function createProject(input: ProjectInput) {
  return localCreateProject(input);
}

export async function updateProject(id: string, input: ProjectInput) {
  return localUpdateProject(id, input);
}

export async function decideFinanceWorkflow(id: string, input: FinanceDecisionInput) {
  return localDecideFinanceWorkflow(id, input);
}

export async function confirmSalesOperationsOrder(id: string) {
  return localConfirmSalesOperationsOrder(id);
}

export async function reportSalesOperationsDiscrepancy(
  id: string,
  input: SalesOperationsDiscrepancyInput,
) {
  return localReportSalesOperationsDiscrepancy(id, input);
}

export async function confirmSduAlignment(id: string) {
  return localConfirmSduAlignment(id);
}

export async function reportSduAlignmentMismatch(
  id: string,
  input: SduAlignmentMismatchInput,
) {
  return localReportSduAlignmentMismatch(id, input);
}

export async function submitSduSurveyCost(id: string, input: SduSurveyCostInput) {
  return localSubmitSduSurveyCost(id, input);
}

export async function advanceProjectToNextStage(id: string) {
  return localAdvanceProjectToNextStage(id);
}

export async function deleteProject(id: string) {
  await localDeleteProject(id);
}
