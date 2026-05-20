import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  actualCostCaptures,
  approvalCertificates,
  approvalHistory,
  auditLogs,
  businessCaseLinks,
  businessCases,
  documents,
  opportunities,
  pboqCostLines,
  pboqRequests,
  revisions,
  users,
  workflowAssignments,
} from "@/lib/db/schema";
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
  type LinkCostSource,
  type LinkOnnetOffnet,
} from "@/lib/projects-types";

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
  type DecisionOutput,
  type Role,
  type WorkflowState,
} from "@/lib/workflow";

export type { PreparedBcDraft, PreparedBcDraftLink };
export { preparedBcDraftSchema };

type DbRole = (typeof users.$inferSelect)["role"];
type DbStatus = (typeof opportunities.$inferSelect)["status"];
type DbBusinessCaseType = (typeof businessCases.$inferSelect)["type"];
type DbDecision = (typeof businessCases.$inferSelect)["decisionOutput"];
type DbDocumentType = (typeof documents.$inferSelect)["type"];
type DbPboqCostSource = (typeof pboqRequests.$inferSelect)["costSource"];
type DbRequiredService = (typeof opportunities.$inferSelect)["requiredService"];

function createId() {
  return randomUUID();
}

async function selectOpportunityById(db: ReturnType<typeof getDb>, id: string) {
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);

  if (!row) {
    throw new Error("Opportunity not found.");
  }

  return row;
}

async function selectBusinessCaseById(db: ReturnType<typeof getDb>, id: string) {
  const [row] = await db.select().from(businessCases).where(eq(businessCases.id, id)).limit(1);

  if (!row) {
    throw new Error("Business case not found.");
  }

  return row;
}

async function selectDocumentById(db: ReturnType<typeof getDb>, id: string) {
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);

  if (!row) {
    throw new Error("Document not found.");
  }

  return row;
}

async function selectPboqRequestById(db: ReturnType<typeof getDb>, id: string) {
  const [row] = await db.select().from(pboqRequests).where(eq(pboqRequests.id, id)).limit(1);

  if (!row) {
    throw new Error("PBOQ request not found.");
  }

  return row;
}

async function insertDocument(
  db: ReturnType<typeof getDb>,
  values: typeof documents.$inferInsert,
) {
  const id = values.id ?? createId();
  await db.insert(documents).values({ ...values, id });
  return selectDocumentById(db, id);
}

const roleToDb: Record<Role, DbRole> = {
  "Account Manager": "ACCOUNT_MANAGER",
  "Fiber Planning Team": "FIBER_PLANNING",
  "Solutions Architect": "SOLUTION_ARCHITECT",
  "Solutions Engineer": "SOLUTION_ENGINEER",
  "BC Analyst / Finance": "BC_ANALYST",
  CFO: "CFO",
  "Sales Operations": "SALES_OPERATIONS",
  SDU: "SDU",
  "Site Acquisition Manager": "SITE_ACQUISITION_MANAGER",
  "Project Manager": "PROJECT_MANAGER",
  Contractor: "CONTRACTOR",
};

const dbToRole = Object.fromEntries(
  Object.entries(roleToDb).map(([role, dbRole]) => [dbRole, role]),
) as Record<DbRole, Role>;

const statusToDb: Record<WorkflowState, DbStatus> = {
  "Opportunity Created": "OPPORTUNITY_CREATED",
  "PBOQ Request Submitted": "PBOQ_REQUESTED",
  "Fiber Planning Generates Costs": "FIBER_PLANNING_COSTS",
  "Business Case Prepared": "BUSINESS_CASE_PREPARED",
  "System Computes Financial Metrics": "FINANCIAL_METRICS_COMPUTED",
  "Approval Routing Engine": "APPROVAL_ROUTING",
  "Finance / CFO Approval": "FINANCE_CFO_APPROVAL",
  "Sales Operations Validation": "SALES_OPERATIONS_VALIDATION",
  "SDU Validation": "SDU_VALIDATION",
  "Survey & Site Acquisition": "SURVEY_SITE_ACQUISITION",
  "Contractor Implementation": "CONTRACTOR_IMPLEMENTATION",
  "Actual Cost Capture": "ACTUAL_COST_CAPTURE",
  "Budget vs Actual Analysis": "BUDGET_ACTUAL_ANALYSIS",
  "Project Closure & Reporting": "PROJECT_CLOSURE_REPORTING",
};

const dbToStatus = Object.fromEntries(
  Object.entries(statusToDb).map(([state, dbStatus]) => [dbStatus, state]),
) as Record<DbStatus, WorkflowState>;

const typeToDb: Record<BusinessCaseType, DbBusinessCaseType> = {
  "Ordinary BC": "ORDINARY_BC",
  "Margin Analysis BC": "MARGIN_ANALYSIS_BC",
};

const dbToType: Record<DbBusinessCaseType, BusinessCaseType> = {
  ORDINARY_BC: "Ordinary BC",
  MARGIN_ANALYSIS_BC: "Margin Analysis BC",
};

const decisionToDb: Record<DecisionOutput, DbDecision> = {
  PROCEED: "PROCEED",
  "SEEK FINANCE APPROVAL": "SEEK_FINANCE_APPROVAL",
  "PROCEED WITH SUBSIDY DISCLOSURE": "PROCEED_WITH_SUBSIDY_DISCLOSURE",
};

const dbToDecision: Record<DbDecision, DecisionOutput> = {
  PROCEED: "PROCEED",
  SEEK_FINANCE_APPROVAL: "SEEK FINANCE APPROVAL",
  PROCEED_WITH_SUBSIDY_DISCLOSURE: "PROCEED WITH SUBSIDY DISCLOSURE",
};

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

const linkOnnetOffnetToDb: Record<LinkOnnetOffnet, "ONNET" | "OFFNET"> = {
  Onnet: "ONNET",
  Offnet: "OFFNET",
};

const linkOnnetOffnetFromDb: Record<"ONNET" | "OFFNET", LinkOnnetOffnet> = {
  ONNET: "Onnet",
  OFFNET: "Offnet",
};

const linkCostSourceToDb: Record<
  LinkCostSource,
  "PBOQ" | "ACTUAL_SURVEY" | "THIRD_PARTY_QUOTE"
> = {
  PBOQ: "PBOQ",
  "Actual Survey": "ACTUAL_SURVEY",
  "3rd Party Quote": "THIRD_PARTY_QUOTE",
};

const linkCostSourceFromDb: Record<
  "PBOQ" | "ACTUAL_SURVEY" | "THIRD_PARTY_QUOTE",
  LinkCostSource
> = {
  PBOQ: "PBOQ",
  ACTUAL_SURVEY: "Actual Survey",
  THIRD_PARTY_QUOTE: "3rd Party Quote",
};

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
  nrr: z.coerce.number().nonnegative(),
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
    siteName: z.string().min(2),
    siteCoordinates: z.string().min(2),
    requiredService: z.enum(["EPL", "DIA", "DFA"]),
    capacity: z.string().min(1),
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
  links: z.array(bcLinkInputSchema).min(1),
  lsoAttachment: z.object({
    type: z.literal("LSO"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
  bcTemplate: z.object({
    type: z.literal("BC_TEMPLATE"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
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
    onnetCapacity: link.onnetCapacity ?? null,
    offnetCapacity: link.offnetCapacity ?? null,
    evidenceDocumentId,
  };
}

function mapLinkRecordToDbInsert(
  businessCaseId: string,
  link: ProjectLinkRecord,
) {
  return {
    businessCaseId,
    linkName: link.linkName,
    service: link.service,
    technology: link.technology,
    onnetOffnet: link.onnetOffnet ? linkOnnetOffnetToDb[link.onnetOffnet] : null,
    costSource: link.costSource ? linkCostSourceToDb[link.costSource] : null,
    material: toNumeric(link.materialCost),
    labor: toNumeric(link.newBuildCost),
    provisioningCost: toNumeric(link.provisioningCost),
    wayleave: toNumeric(link.wayleaveCost),
    mrr: toNumeric(link.mrr),
    mrc: toNumeric(link.mrc),
    nrc: toNumeric(link.nrc),
    nrr: toNumeric(link.nrr),
    onnetCapacity: link.onnetCapacity,
    offnetCapacity: link.offnetCapacity,
    evidenceDocumentId: link.evidenceDocumentId,
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
    material: 0,
    build: 0,
    wayleave: 0,
    notes: encodeKickoffLinkNotes({
      region: link.region,
      service: link.service,
      capacity: link.capacity,
    }),
  }));
}

export type {
  PboqRequestRecord,
  ProjectRecord,
} from "@/lib/project-record-types";
import type { PboqRequestRecord, ProjectRecord } from "@/lib/project-record-types";

export type FinanceDecision =
  | "approve"
  | "reject-escalate-cfo"
  | "reject-question-architect"
  | "reject-question-engineer";

export function isAccountManagerBcPreparationStage(project: ProjectRecord) {
  return (
    project.roleQueue === "Account Manager" &&
    project.state === "Business Case Prepared" &&
    project.decision === "PENDING" &&
    Boolean(project.pboqRequest?.completedAt)
  );
}

export function canEditProject(project: ProjectRecord) {
  if (project.roleQueue === "Fiber Planning Team") {
    return false;
  }

  if (isAccountManagerBcPreparationStage(project)) {
    return false;
  }

  return true;
}

export function hasPboqDocumentAttachment(project: ProjectRecord) {
  return project.documents.some(
    (document) => document.type === "PBOQ" || document.type === "ACTUAL_SURVEY_QUOTE",
  );
}

function dbNumber(value: unknown) {
  return Number(value ?? 0);
}

function toNumeric(value: number) {
  return value.toString();
}

function ownerEmail(owner: string) {
  const slug = owner
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");

  return `${slug || "workflow.user"}@workflow.local`;
}

async function findOrCreateUser(name: string, role: Role) {
  const db = getDb();
  const email = ownerEmail(name);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    return existing;
  }

  await db.insert(users).values({
    name,
    email,
    role: roleToDb[role],
  });
  const [created] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!created) {
    throw new Error("Failed to create user.");
  }

  return created;
}

function buildReference() {
  return `BC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function shouldUseLocalProjectStorage() {
  return process.env.PROJECT_STORAGE !== "database";
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
    type: DbDocumentType;
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
    accountNumber: overrides.accountNumber ?? "",
    solutionArchitectureName: overrides.solutionArchitectureName ?? "Unassigned",
    solutionEngineerName: overrides.solutionEngineerName ?? "Unassigned",
    projectExecutiveSummary: overrides.projectExecutiveSummary ?? "",
    opportunityMrr,
    opportunityNrr,
    contractTermMonths: overrides.contractTermMonths ?? 12,
    pboqRequest: overrides.pboqRequest,
    links,
    documents: overrides.documents ?? [],
    totalMrr: overrides.totalMrr ?? (links.reduce((total, link) => total + link.mrr, 0) || opportunityMrr),
    totalMrc: overrides.totalMrc ?? links.reduce((total, link) => total + link.mrc, 0),
    totalNrc: overrides.totalNrc ?? links.reduce((total, link) => total + link.nrc, 0),
    totalNrr: overrides.totalNrr ?? (links.reduce((total, link) => total + link.nrr, 0) || opportunityNrr),
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
      solutionArchitectureName: project.solutionArchitectureName,
      solutionEngineerName: project.solutionEngineerName,
      accountNumber: project.accountNumber,
      projectExecutiveSummary: project.projectExecutiveSummary,
      opportunityMrr: project.opportunityMrr,
      opportunityNrr: project.opportunityNrr,
      contractTermMonths: project.contractTermMonths,
      pboqRequest: project.pboqRequest,
      links: project.links,
      documents: project.documents,
      certificateIssued: project.certificateIssued,
      revisions: project.revisions + 1,
      createdAt: project.createdAt,
    }),
    updatedAt: new Date().toISOString(),
  };
}

function localRouteForPreparedBusinessCase(input: {
  type: BusinessCaseType;
  decision: DecisionOutput;
}): { state: WorkflowState; role: Role; autoApproved: boolean } {
  if (
    input.type === "Ordinary BC" &&
    (input.decision === "PROCEED" ||
      input.decision === "PROCEED WITH SUBSIDY DISCLOSURE")
  ) {
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

function localFinanceRoute(decision: FinanceDecision): { state: WorkflowState; role: Role } {
  if (decision === "approve") {
    return { state: "Sales Operations Validation", role: "Sales Operations" };
  }

  if (decision === "reject-escalate-cfo") {
    return { state: "Finance / CFO Approval", role: "CFO" };
  }

  if (decision === "reject-question-architect") {
    return { state: "Business Case Prepared", role: "Solutions Architect" };
  }

  return { state: "Business Case Prepared", role: "Solutions Engineer" };
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

async function localCreatePboqRequest(input: PboqRequestInput) {
  const validated = pboqRequestInputSchema.parse(input);
  const projects = await readLocalProjects();

  if (projects.some((project) => project.id === validated.opportunityNumber)) {
    throw new Error("Opportunity number already exists.");
  }

  const now = new Date().toISOString();
  const hasExistingPboq = validated.pboqMode === "existing";
  const kickoffCostLines = mapKickoffLinksToCostLineRecords(validated.links);
  const pboqDocument = validated.pboqAttachment
    ? localDocument(validated.pboqAttachment, now)
    : undefined;
  const project = createLocalProjectRecord(
    {
      customer: validated.customerName,
      title: validated.siteName,
      region: validated.region,
      owner: validated.accountManagerName,
      state: hasExistingPboq ? "Business Case Prepared" : "PBOQ Request Submitted",
      roleQueue: hasExistingPboq ? "Account Manager" : "Fiber Planning Team",
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
      requiredService: validated.requiredService,
      capacity: validated.capacity,
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
        siteCount: validated.links.length,
        routeDistanceKm: validated.routeDistanceKm,
        surveyBudget: validated.surveyAvailable ? validated.actualSurveyCost : 0,
        surveyAvailable: validated.surveyAvailable,
        costSource: validated.surveyAvailable ? "ACTUAL_SURVEY" : "PBOQ_ESTIMATE",
        actualSurveyCost: validated.actualSurveyCost,
        notes: validated.notes || null,
        fiberPlanningNotes: null,
        completedAt: hasExistingPboq ? now : null,
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
        project.state !== "Fiber Planning Generates Costs"
      ) {
        throw new Error("Project is not in a Fiber Planning stage.");
      }

      const kickoffLinkCount =
        validated.kickoffLinkCount ?? project.pboqRequest.costLines.length;
      assertFiberPlanningLineCount(kickoffLinkCount, validated.lines.length);

      const now = new Date().toISOString();
      const costLines = validated.lines.map((line) => ({
        id: createId(),
        linkName: line.linkName,
        material: line.material,
        build: line.build,
        wayleave: line.wayleave,
        notes: line.notes || null,
      }));
      const totalCost = costLines.reduce(
        (total, line) => total + line.material + line.build + line.wayleave,
        0,
      );
      const documents = validated.lines.map((line) => localDocument(line.pboqFile, now));

      updatedProject = {
        ...project,
        state: "Business Case Prepared",
        roleQueue: "Account Manager",
        capex: Math.max(project.capex, totalCost),
        approvedBudget: Math.max(project.approvedBudget, totalCost),
        pboqRequest: {
          ...project.pboqRequest,
          surveyBudget: totalCost,
          fiberPlanningNotes: validated.fiberPlanningNotes || null,
          completedAt: now,
          costLines,
        },
        documents: [...documents, ...project.documents],
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
      const route = localRouteForPreparedBusinessCase({
        type: validated.type,
        decision,
      });
      const newDocuments = [
        localDocument(validated.lsoAttachment, now),
        localDocument(validated.bcTemplate, now),
        ...(validated.pboqOrSurveyAttachment
          ? [localDocument(validated.pboqOrSurveyAttachment, now)]
          : []),
        ...(validated.thirdPartyQuotesAttachment
          ? [localDocument(validated.thirdPartyQuotesAttachment, now)]
          : []),
        ...validated.linkEvidenceAttachments.map((attachment) => localDocument(attachment, now)),
      ];
      const baseDocumentCount =
        2 +
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

      updatedProject = {
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
        decision,
        state: route.state,
        roleQueue: route.role,
        certificateIssued: project.certificateIssued || route.autoApproved,
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
  const route = localRouteForPreparedBusinessCase({
    type: validated.type,
    decision,
  });
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
      opportunityMrr: links.reduce((total, link) => total + link.mrr, 0),
      opportunityNrr: links.reduce((total, link) => total + link.nrr, 0),
      links,
      documents,
      totalMrr: links.reduce((total, link) => total + link.mrr, 0),
      totalMrc: links.reduce((total, link) => total + link.mrc, 0),
      totalNrc: links.reduce((total, link) => total + link.nrc, 0),
      totalNrr: links.reduce((total, link) => total + link.nrr, 0),
      decision,
      certificateIssued: route.autoApproved,
    },
  );

  await writeLocalProjects([project, ...projects]);
  return project;
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
      links,
      documents,
      totalMrr: links.reduce((total, link) => total + link.mrr, 0),
      totalMrc: links.reduce((total, link) => total + link.mrc, 0),
      totalNrc: links.reduce((total, link) => total + link.nrc, 0),
      totalNrr: links.reduce((total, link) => total + link.nrr, 0),
    },
  );

  await writeLocalProjects([project, ...projects]);
  return project;
}

async function localDecideFinanceWorkflow(id: string, decision: FinanceDecision) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      const route = localFinanceRoute(decision);
      updatedProject = {
        ...project,
        state: route.state,
        roleQueue: route.role,
        certificateIssued: project.certificateIssued || decision === "approve",
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

async function getLatestBusinessCase(opportunityId: string) {
  const db = getDb();
  const [businessCase] = await db
    .select()
    .from(businessCases)
    .where(eq(businessCases.opportunityId, opportunityId))
    .orderBy(desc(businessCases.version))
    .limit(1);

  return businessCase;
}

async function getLatestAssignment(opportunityId: string) {
  const db = getDb();
  const [assignment] = await db
    .select()
    .from(workflowAssignments)
    .where(eq(workflowAssignments.opportunityId, opportunityId))
    .orderBy(desc(workflowAssignments.createdAt))
    .limit(1);

  return assignment;
}

async function getLatestActuals(opportunityId: string, businessCaseId?: string) {
  const db = getDb();

  if (!businessCaseId) return undefined;

  const [actuals] = await db
    .select()
    .from(actualCostCaptures)
    .where(
      and(
        eq(actualCostCaptures.opportunityId, opportunityId),
        eq(actualCostCaptures.businessCaseId, businessCaseId),
      ),
    )
    .orderBy(desc(actualCostCaptures.capturedAt))
    .limit(1);

  return actuals;
}

async function getOpportunityPboqRequest(
  opportunityId: string,
): Promise<PboqRequestRecord | undefined> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(pboqRequests)
    .where(eq(pboqRequests.opportunityId, opportunityId))
    .limit(1);

  if (!request) return undefined;

  const lines = await db
    .select()
    .from(pboqCostLines)
    .where(eq(pboqCostLines.pboqRequestId, request.id));

  return {
    id: request.id,
    siteCount: request.siteCount,
    routeDistanceKm: dbNumber(request.routeDistanceKm),
    surveyBudget: dbNumber(request.surveyBudget),
    surveyAvailable: request.surveyAvailable,
    costSource: request.costSource,
    actualSurveyCost: dbNumber(request.actualSurveyCost),
    notes: request.notes,
    fiberPlanningNotes: request.fiberPlanningNotes,
    completedAt: request.completedAt?.toISOString() ?? null,
    costLines: lines.map((line) => ({
      id: line.id,
      linkName: line.linkName,
      material: dbNumber(line.material),
      build: dbNumber(line.build),
      wayleave: dbNumber(line.wayleave),
      notes: line.notes,
    })),
    bcPreparationDraft: parsePreparedBcDraftRecord(request.bcPreparationDraft),
  };
}

function parsePreparedBcDraftRecord(value: unknown): PreparedBcDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = preparedBcDraftSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

async function hasApprovalCertificate(businessCaseId?: string) {
  const db = getDb();

  if (!businessCaseId) return false;

  const [certificate] = await db
    .select({ id: approvalCertificates.id })
    .from(approvalCertificates)
    .where(eq(approvalCertificates.businessCaseId, businessCaseId))
    .limit(1);

  return Boolean(certificate);
}

async function getBusinessCaseLinks(businessCaseId?: string): Promise<ProjectLinkRecord[]> {
  const db = getDb();

  if (!businessCaseId) return [];

  const rows = await db
    .select()
    .from(businessCaseLinks)
    .where(eq(businessCaseLinks.businessCaseId, businessCaseId));

  return rows.map((row) => ({
    id: row.id,
    linkName: row.linkName,
    service: row.service ?? "",
    technology: row.technology ?? "",
    onnetOffnet: row.onnetOffnet ? linkOnnetOffnetFromDb[row.onnetOffnet] : null,
    costSource: row.costSource ? linkCostSourceFromDb[row.costSource] : null,
    newBuildCost: dbNumber(row.labor),
    provisioningCost: dbNumber(row.provisioningCost),
    materialCost: dbNumber(row.material),
    wayleaveCost: dbNumber(row.wayleave),
    mrr: dbNumber(row.mrr),
    mrc: dbNumber(row.mrc),
    nrc: dbNumber(row.nrc),
    nrr: dbNumber(row.nrr),
    onnetCapacity: row.onnetCapacity,
    offnetCapacity: row.offnetCapacity,
    evidenceDocumentId: row.evidenceDocumentId,
  }));
}

async function getProjectDocuments(opportunityId: string): Promise<ProjectDocumentRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.opportunityId, opportunityId))
    .orderBy(desc(documents.createdAt));

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function toProjectRecord(
  opportunity: typeof opportunities.$inferSelect,
): Promise<ProjectRecord | undefined> {
  const db = getDb();
  const [accountManager] = await db
    .select()
    .from(users)
    .where(eq(users.id, opportunity.accountManagerId))
    .limit(1);
  const businessCase = await getLatestBusinessCase(opportunity.id);
  const assignment = await getLatestAssignment(opportunity.id);
  const actuals = await getLatestActuals(opportunity.id, businessCase?.id);
  const [links, projectDocuments, pboqRequest, certificateIssued] = await Promise.all([
    getBusinessCaseLinks(businessCase?.id),
    getProjectDocuments(opportunity.id),
    getOpportunityPboqRequest(opportunity.id),
    hasApprovalCertificate(businessCase?.id),
  ]);

  const pboqBudget =
    pboqRequest?.costLines.reduce(
      (total, line) => total + line.material + line.build + line.wayleave,
      0,
    ) ?? 0;
  const bcApprovedBudget = businessCase ? dbNumber(businessCase.approvedBudget) : 0;
  const bcCapex = businessCase ? dbNumber(businessCase.capex) : 0;
  // Latest BC row wins in the DB, but draft rows often keep approvedBudget at 0 while Fiber
  // stores real totals on PBOQ cost lines. Show the roll-up until a submitted BC fixes a number.
  const approvedBudget = !businessCase
    ? pboqBudget
    : businessCase.submittedAt != null && bcApprovedBudget > 0
      ? bcApprovedBudget
      : Math.max(bcApprovedBudget, pboqBudget);
  const capex = !businessCase
    ? pboqBudget
    : businessCase.submittedAt != null && bcCapex > 0
      ? bcCapex
      : Math.max(bcCapex, pboqBudget);
  const actualSpend = dbNumber(actuals?.actualSpend);
  const variance =
    actuals?.variancePercent != null
      ? dbNumber(actuals.variancePercent)
      : approvedBudget === 0
        ? 0
        : ((actualSpend - approvedBudget) / approvedBudget) * 100;

  return {
    id: opportunity.reference,
    customer: opportunity.customerName,
    title: opportunity.opportunityName,
    siteName: opportunity.siteName ?? opportunity.opportunityName,
    siteCoordinates: opportunity.siteCoordinates ?? "",
    requiredService: opportunity.requiredService ?? "Unspecified",
    capacity: opportunity.capacity ?? "",
    salesRequestor: opportunity.salesRequestor ?? accountManager?.name ?? "Unassigned",
    leadNetworkPlanner: opportunity.leadNetworkPlanner ?? "Unassigned",
    dateRequested: opportunity.requestedDate.toISOString(),
    designPlanDate: opportunity.designPlanDate?.toISOString() ?? null,
    region: opportunity.region,
    owner: accountManager?.name ?? "Unassigned",
    accountNumber: businessCase?.accountNumber ?? "",
    solutionArchitectureName: businessCase?.solutionArchitectureName ?? "Unassigned",
    solutionEngineerName: businessCase?.solutionEngineerName ?? "Unassigned",
    projectExecutiveSummary: businessCase?.projectExecutiveSummary ?? "",
    opportunityMrr: dbNumber(opportunity.mrr),
    opportunityNrr: dbNumber(opportunity.nrr),
    contractTermMonths: opportunity.contractTermMonths,
    pboqRequest,
    links,
    documents: projectDocuments,
    totalMrr: links.reduce((total, link) => total + link.mrr, 0) || dbNumber(opportunity.mrr),
    totalMrc: links.reduce((total, link) => total + link.mrc, 0),
    totalNrc: links.reduce((total, link) => total + link.nrc, 0),
    totalNrr: links.reduce((total, link) => total + link.nrr, 0) || dbNumber(opportunity.nrr),
    state: dbToStatus[opportunity.status],
    roleQueue: assignment ? dbToRole[assignment.role] : "Account Manager",
    type: businessCase ? dbToType[businessCase.type] : "Ordinary BC",
    irr: dbNumber(businessCase?.irr),
    payback: businessCase?.paybackMonths ?? 36,
    capex,
    subsidy: dbNumber(businessCase?.subsidyRequirement),
    approvedBudget,
    actualSpend,
    decision: businessCase ? dbToDecision[businessCase.decisionOutput] : "PENDING",
    certificateIssued,
    variance: Number(variance.toFixed(1)),
    surveyDeviation: dbNumber(actuals?.surveyDeviationPct),
    revisions: Math.max(0, (businessCase?.version ?? 1) - 1),
    due: assignment?.dueAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }).format(assignment.dueAt)
      : "Unscheduled",
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  };
}

async function insertBusinessCase(opportunityId: string, input: ProjectInput, version: number) {
  const db = getDb();
  const decision = deriveDecision({
    irr: input.irr,
    paybackMonths: input.payback,
    subsidyRequirement: input.subsidy,
    capex: input.capex,
  });
  const businessCaseId = createId();
  await db.insert(businessCases).values({
    id: businessCaseId,
    opportunityId,
    version,
    type: typeToDb[input.type],
    irr: toNumeric(input.irr),
    paybackMonths: input.payback,
    capex: toNumeric(input.capex),
    subsidyRequirement: toNumeric(input.subsidy),
    approvedBudget: toNumeric(input.approvedBudget),
    decisionOutput: decisionToDb[decision.decision],
    requiresCfo: decision.requiresCfo,
    subsidyDisclosed: input.subsidy > 0,
    submittedAt: new Date(),
  });

  return selectBusinessCaseById(db, businessCaseId);
}

async function insertActuals(
  opportunityId: string,
  businessCaseId: string,
  input: ProjectInput,
) {
  const db = getDb();
  const varianceAmount = input.actualSpend - input.approvedBudget;
  const variancePercent =
    input.approvedBudget === 0 ? 0 : (varianceAmount / input.approvedBudget) * 100;

  await db.insert(actualCostCaptures).values({
    opportunityId,
    businessCaseId,
    contractorName: input.roleQueue === "Contractor" ? input.owner : null,
    approvedBudget: toNumeric(input.approvedBudget),
    actualSpend: toNumeric(input.actualSpend),
    surveyBudget: "0",
    surveyActual: "0",
    varianceAmount: toNumeric(varianceAmount),
    variancePercent: toNumeric(Number(variancePercent.toFixed(1))),
    surveyDeviationPct: toNumeric(input.surveyDeviation),
  });
}

async function insertAssignment(opportunityId: string, input: ProjectInput) {
  const db = getDb();
  const assignee = await findOrCreateUser(input.owner, input.roleQueue);

  await db.insert(workflowAssignments).values({
    opportunityId,
    role: roleToDb[input.roleQueue],
    assigneeId: assignee.id,
    status: statusToDb[input.state],
  });
}

async function assignWorkflow(
  opportunityId: string,
  role: Role,
  assigneeName: string,
  status: DbStatus,
) {
  const db = getDb();
  const assignee = await findOrCreateUser(assigneeName, role);

  await db.insert(workflowAssignments).values({
    opportunityId,
    role: roleToDb[role],
    assigneeId: assignee.id,
    status,
  });
}

async function completeLatestAssignment(opportunityId: string) {
  const db = getDb();
  const assignment = await getLatestAssignment(opportunityId);

  if (assignment) {
    await db
      .update(workflowAssignments)
      .set({ completedAt: new Date() })
      .where(eq(workflowAssignments.id, assignment.id));
  }

  return assignment;
}

async function issueApprovalCertificate(
  opportunityId: string,
  businessCaseId: string,
  actorId: string,
  reason: string,
) {
  const db = getDb();
  const [existing] = await db
    .select({ id: approvalCertificates.id })
    .from(approvalCertificates)
    .where(eq(approvalCertificates.businessCaseId, businessCaseId))
    .limit(1);

  if (existing) return;

  const certificateNo = `BC-CERT-${new Date().getFullYear()}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
  const storageKey = `certificates/${certificateNo}.pdf`;

  await db.insert(approvalCertificates).values({
    businessCaseId,
    certificateNo,
    fileStorageKey: storageKey,
    checksum: randomUUID(),
  });

  await db.insert(documents).values({
    opportunityId,
    uploadedById: actorId,
    type: "BC_APPROVAL_CERTIFICATE",
    name: `${certificateNo}.pdf`,
    storageKey,
    mimeType: "application/pdf",
    sizeBytes: 1,
  });

  await db.insert(approvalHistory).values({
    opportunityId,
    businessCaseId,
    actorId,
    role: "BC_ANALYST",
    action: "GENERATE_CERTIFICATE",
    notes: reason,
  });
}

function routeForPreparedBusinessCase(input: {
  type: BusinessCaseType;
  decision: DecisionOutput;
}): { status: DbStatus; role: Role; event: string; notes: string; autoApproved: boolean } {
  if (
    input.type === "Ordinary BC" &&
    (input.decision === "PROCEED" ||
      input.decision === "PROCEED WITH SUBSIDY DISCLOSURE")
  ) {
    return {
      status: statusToDb["Sales Operations Validation"],
      role: "Sales Operations",
      event: "BC_AUTO_APPROVED_TO_SALES_OPERATIONS",
      notes:
        input.decision === "PROCEED WITH SUBSIDY DISCLOSURE"
          ? "Ordinary BC auto-approved with mandatory subsidy disclosure."
          : "Ordinary BC auto-approved because metrics are within threshold.",
      autoApproved: true,
    };
  }

  return {
    status: statusToDb["Finance / CFO Approval"],
    role: "BC Analyst / Finance",
    event: "BC_ROUTED_TO_FINANCE",
    notes:
      input.type === "Margin Analysis BC"
        ? "Margin Analysis BC requires Finance review."
        : "Ordinary BC requires Finance review based on computed metrics.",
    autoApproved: false,
  };
}

export async function createPboqRequest(input: PboqRequestInput) {
  if (shouldUseLocalProjectStorage()) {
    return localCreatePboqRequest(input);
  }

  const validated = pboqRequestInputSchema.parse(input);
  const db = getDb();
  const accountManager = await findOrCreateUser(
    validated.accountManagerName,
    "Account Manager",
  );
  const hasExistingPboq = validated.pboqMode === "existing";
  const nextStatus = hasExistingPboq
    ? statusToDb["Business Case Prepared"]
    : statusToDb["PBOQ Request Submitted"];
  const nextRole: Role = hasExistingPboq ? "Account Manager" : "Fiber Planning Team";
  const nextAssignee = hasExistingPboq
    ? accountManager
    : await findOrCreateUser("Fiber Planning Team", "Fiber Planning Team");
  const [existing] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.reference, validated.opportunityNumber))
    .limit(1);

  if (existing) {
    throw new Error("Opportunity number already exists.");
  }

  const opportunityId = createId();
  await db.insert(opportunities).values({
    id: opportunityId,
    reference: validated.opportunityNumber,
    customerName: validated.customerName,
    opportunityName: validated.siteName,
    siteName: validated.siteName,
    siteCoordinates: validated.siteCoordinates,
    requiredService: validated.requiredService,
    capacity: validated.capacity,
    salesRequestor: validated.salesRequestor,
    leadNetworkPlanner: validated.leadNetworkPlanner,
    region: validated.region,
    segment: validated.segment,
    mrr: toNumeric(validated.mrr),
    nrr: toNumeric(validated.nrr),
    contractTermMonths: validated.contractTermMonths,
    accountManagerId: accountManager.id,
    status: nextStatus,
    priority: "Normal",
    requestedDate: new Date(validated.dateRequested),
    designPlanDate: new Date(validated.designPlanDate),
  });
  const opportunity = await selectOpportunityById(db, opportunityId);

  const pboqAttachment = validated.pboqAttachment
    ? await insertDocument(db, {
        opportunityId: opportunity.id,
        uploadedById: accountManager.id,
        type: "PBOQ",
        name: validated.pboqAttachment.name,
        storageKey: validated.pboqAttachment.storageKey,
        mimeType: validated.pboqAttachment.mimeType,
        sizeBytes: validated.pboqAttachment.sizeBytes,
      })
    : null;

  const pboqRequestId = createId();
  await db.insert(pboqRequests).values({
    id: pboqRequestId,
    opportunityId: opportunity.id,
    solutionDesignDocumentId: null,
    siteCount: validated.links.length,
    routeDistanceKm: toNumeric(validated.routeDistanceKm),
    surveyBudget: toNumeric(validated.surveyAvailable ? validated.actualSurveyCost : 0),
    surveyAvailable: validated.surveyAvailable,
    costSource: validated.surveyAvailable ? "ACTUAL_SURVEY" : "PBOQ_ESTIMATE",
    actualSurveyCost: toNumeric(validated.actualSurveyCost),
    notes: validated.notes || null,
    completedAt: hasExistingPboq ? new Date() : null,
  });
  const pboqRequest = await selectPboqRequestById(db, pboqRequestId);

  await db.insert(pboqCostLines).values(
    validated.links.map((link) => ({
      pboqRequestId: pboqRequest.id,
      linkName: link.linkName.trim(),
      material: toNumeric(0),
      build: toNumeric(0),
      wayleave: toNumeric(0),
      notes: encodeKickoffLinkNotes({
        region: link.region,
        service: link.service,
        capacity: link.capacity,
      }),
    })),
  );

  await db.insert(workflowAssignments).values({
    opportunityId: opportunity.id,
    role: roleToDb[nextRole],
    assigneeId: nextAssignee.id,
    status: nextStatus,
  });

  await db.insert(approvalHistory).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    role: "ACCOUNT_MANAGER",
    action: "SUBMIT",
    fromStatus: "OPPORTUNITY_CREATED",
    toStatus: nextStatus,
    notes: hasExistingPboq
      ? "Account Manager attached an existing PBOQ and moved the project to BC preparation."
      : "Account Manager requested Fiber Planning to prepare the PBOQ.",
  });

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    event: hasExistingPboq ? "PBOQ_ATTACHED_FOR_BC_PREPARATION" : "PBOQ_REQUEST_SUBMITTED",
    entityType: "PboqRequest",
    entityId: pboqRequest.id,
    metadata: {
      nextRole,
      pboqMode: validated.pboqMode,
      pboqAttachmentId: pboqAttachment?.id,
      surveyAvailable: validated.surveyAvailable,
      costSource: validated.surveyAvailable ? "ACTUAL_SURVEY" : "PBOQ_ESTIMATE",
    },
  });

  const project = await toProjectRecord(opportunity);

  if (!project) {
    throw new Error("PBOQ request was created but could not be read.");
  }

  return project;
}

export async function completeFiberPlanning(id: string, input: FiberPlanningInput) {
  if (shouldUseLocalProjectStorage()) {
    return localCompleteFiberPlanning(id, input);
  }

  const validated = fiberPlanningInputSchema.parse(input);
  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!opportunity) {
    throw new Error("Project not found.");
  }

  const [pboqRequest] = await db
    .select()
    .from(pboqRequests)
    .where(eq(pboqRequests.opportunityId, opportunity.id))
    .limit(1);

  if (!pboqRequest) {
    throw new Error("Project has no PBOQ request.");
  }
  if (
    opportunity.status !== statusToDb["PBOQ Request Submitted"] &&
    opportunity.status !== statusToDb["Fiber Planning Generates Costs"]
  ) {
    throw new Error("Project is not in a Fiber Planning stage.");
  }

  const assignment = await completeLatestAssignment(opportunity.id);
  const actorRole = assignment?.role ?? roleToDb["Fiber Planning Team"];
  const actor =
    assignment?.assigneeId ??
    (await findOrCreateUser("Fiber Planning Team", "Fiber Planning Team")).id;
  const totalCost = validated.lines.reduce(
    (total, line) => total + line.material + line.build + line.wayleave,
    0,
  );

  const existingKickoffLines = await db
    .select({ id: pboqCostLines.id })
    .from(pboqCostLines)
    .where(eq(pboqCostLines.pboqRequestId, pboqRequest.id));

  const kickoffLinkCount = validated.kickoffLinkCount ?? existingKickoffLines.length;
  assertFiberPlanningLineCount(kickoffLinkCount, validated.lines.length);

  await db.delete(pboqCostLines).where(eq(pboqCostLines.pboqRequestId, pboqRequest.id));
  await db.insert(pboqCostLines).values(
    validated.lines.map((line) => ({
      pboqRequestId: pboqRequest.id,
      linkName: line.linkName,
      material: toNumeric(line.material),
      build: toNumeric(line.build),
      wayleave: toNumeric(line.wayleave),
      notes: line.notes || null,
    })),
  );

  await db.insert(documents).values(
    validated.lines.map((line) => ({
      opportunityId: opportunity.id,
      uploadedById: actor,
      type: "PBOQ" as const,
      name: line.pboqFile.name,
      storageKey: line.pboqFile.storageKey,
      mimeType: line.pboqFile.mimeType,
      sizeBytes: line.pboqFile.sizeBytes,
    })),
  );

  await db
    .update(opportunities)
    .set({
      status: statusToDb["Business Case Prepared"],
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunity.id));
  const updatedOpportunity = await selectOpportunityById(db, opportunity.id);

  await db
    .update(pboqRequests)
    .set({
      surveyBudget: toNumeric(totalCost),
      fiberPlanningNotes: validated.fiberPlanningNotes || null,
      completedAt: new Date(),
    })
    .where(eq(pboqRequests.id, pboqRequest.id));

  const [accountManager] = await db
    .select()
    .from(users)
    .where(eq(users.id, opportunity.accountManagerId))
    .limit(1);

  await assignWorkflow(
    opportunity.id,
    "Account Manager",
    accountManager?.name ?? "Account Manager",
    statusToDb["Business Case Prepared"],
  );

  await db.insert(approvalHistory).values({
    opportunityId: opportunity.id,
    actorId: actor,
    role: actorRole,
    action: "VALIDATE",
    fromStatus: opportunity.status,
    toStatus: statusToDb["Business Case Prepared"],
    notes: "Fiber Planning generated PBOQ costs and returned the case for BC preparation.",
  });

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: actor,
    event: "FIBER_PLANNING_COMPLETED",
    entityType: "PboqRequest",
    entityId: pboqRequest.id,
    metadata: {
      lineCount: validated.lines.length,
      totalCost,
      nextRole: "Account Manager",
    },
  });

  const project = await toProjectRecord(updatedOpportunity);

  if (!project) {
    throw new Error("Fiber Planning was completed but project could not be read.");
  }

  return project;
}

/** BC preparation drafts are stored in the browser (localStorage) for now. */
export async function savePreparedBcDraft(id: string, _draft: PreparedBcDraft) {
  const project = await getProject(id);

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

export async function prepareBusinessCaseFromPboq(id: string, input: PreparedBcInput) {
  if (shouldUseLocalProjectStorage()) {
    return localPrepareBusinessCaseFromPboq(id, input);
  }

  const validated = preparedBcInputSchema.parse(input);
  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!opportunity) {
    throw new Error("Project not found.");
  }

  const pboqRequest = await getOpportunityPboqRequest(opportunity.id);

  if (!pboqRequest) {
    throw new Error("PBOQ attachment or request is required before BC preparation.");
  }

  const assignment = await completeLatestAssignment(opportunity.id);
  const actorRole = assignment?.role ?? roleToDb["Account Manager"];
  const actor =
    assignment?.assigneeId ??
    (await findOrCreateUser("Account Manager", "Account Manager")).id;
  const decision = deriveDecision({
    irr: validated.irr,
    paybackMonths: validated.payback,
    subsidyRequirement: validated.subsidy,
    capex: validated.capex,
  });
  const route = routeForPreparedBusinessCase({
    type: validated.type,
    decision: decision.decision,
  });
  const latestBusinessCase = await getLatestBusinessCase(opportunity.id);

  const businessCaseId = createId();
  await db.insert(businessCases).values({
    id: businessCaseId,
    opportunityId: opportunity.id,
    version: (latestBusinessCase?.version ?? 0) + 1,
    type: typeToDb[validated.type],
    solutionArchitectureName: validated.solutionArchitectureName,
    solutionEngineerName: validated.solutionEngineerName,
    accountNumber: validated.accountNumber,
    projectExecutiveSummary: validated.projectExecutiveSummary,
    irr: toNumeric(validated.irr),
    paybackMonths: validated.payback,
    capex: toNumeric(validated.capex),
    subsidyRequirement: toNumeric(validated.subsidy),
    approvedBudget: toNumeric(validated.approvedBudget),
    decisionOutput: decisionToDb[decision.decision],
    requiresCfo: decision.requiresCfo,
    subsidyDisclosed: decision.decision === "PROCEED WITH SUBSIDY DISCLOSURE",
    submittedAt: new Date(),
    approvedAt: route.autoApproved ? new Date() : null,
  });
  const businessCase = await selectBusinessCaseById(db, businessCaseId);

  const attachmentPayload = [
    validated.lsoAttachment,
    validated.bcTemplate,
    ...(validated.pboqOrSurveyAttachment ? [validated.pboqOrSurveyAttachment] : []),
    ...(validated.thirdPartyQuotesAttachment ? [validated.thirdPartyQuotesAttachment] : []),
    ...validated.linkEvidenceAttachments,
  ];
  const createdDocuments = await Promise.all(
    attachmentPayload.map((attachment) =>
      insertDocument(db, {
        opportunityId: opportunity.id,
        uploadedById: actor,
        type: attachment.type,
        name: attachment.name,
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      }),
    ),
  );
  const documentIds = createdDocuments.map((document) => document.id);
  const baseDocumentCount =
    2 +
    (validated.pboqOrSurveyAttachment ? 1 : 0) +
    (validated.thirdPartyQuotesAttachment ? 1 : 0);

  const pboqDocuments = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.opportunityId, opportunity.id), eq(documents.type, "PBOQ")))
    .limit(1);
  const defaultEvidenceDocumentId = pboqDocuments[0]?.id ?? documentIds[0] ?? null;

  await db.insert(businessCaseLinks).values(
    validated.links.map((link) => {
      const record = mapLinkInputToRecord(
        link,
        link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
          ? documentIds[baseDocumentCount + link.evidenceAttachmentIndex] ??
            defaultEvidenceDocumentId
          : defaultEvidenceDocumentId,
      );

      return mapLinkRecordToDbInsert(businessCase.id, record);
    }),
  );

  if (pboqRequest) {
    await db
      .update(pboqRequests)
      .set({ bcPreparationDraft: null })
      .where(eq(pboqRequests.id, pboqRequest.id));
  }

  await db
    .update(opportunities)
    .set({
      status: route.status,
      contractTermMonths: validated.contractTermMonths,
      customerName: validated.customerName,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunity.id));
  const updatedOpportunity = await selectOpportunityById(db, opportunity.id);

  await assignWorkflow(opportunity.id, route.role, route.role, route.status);

  await db.insert(approvalHistory).values({
    opportunityId: opportunity.id,
    businessCaseId: businessCase.id,
    actorId: actor,
    role: actorRole,
    action: "SUBMIT",
    fromStatus: opportunity.status,
    toStatus: route.status,
    decision: decisionToDb[decision.decision],
    notes: route.notes,
  });

  if (route.autoApproved) {
    await issueApprovalCertificate(opportunity.id, businessCase.id, actor, route.notes);
  }

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: actor,
    event: route.event,
    entityType: "BusinessCase",
    entityId: businessCase.id,
    metadata: {
      routeRole: route.role,
      decision: decision.decision,
      autoApproved: route.autoApproved,
      source: "PBOQ",
    },
  });

  const project = await toProjectRecord(updatedOpportunity);

  if (!project) {
    throw new Error("BC was prepared but project could not be read.");
  }

  return project;
}

export async function createBcSubmission(input: BcSubmissionInput) {
  if (shouldUseLocalProjectStorage()) {
    return localCreateBcSubmission(input);
  }

  const validated = bcSubmissionInputSchema.parse(input);
  const db = getDb();
  const accountManager = await findOrCreateUser(
    validated.accountManagerName,
    "Account Manager",
  );
  const decision = deriveDecision({
    irr: validated.irr,
    paybackMonths: validated.payback,
    subsidyRequirement: validated.subsidy,
    capex: validated.capex,
  });
  const route = routeForPreparedBusinessCase({
    type: validated.type,
    decision: decision.decision,
  });
  const routeAssignee = await findOrCreateUser(route.role, route.role);
  const [existing] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.reference, validated.opportunityNumber))
    .limit(1);

  if (existing) {
    throw new Error("Opportunity number already exists.");
  }

  const opportunityId = createId();
  await db.insert(opportunities).values({
    id: opportunityId,
    reference: validated.opportunityNumber,
    customerName: validated.customerName,
    opportunityName: `${validated.customerName} BC submission`,
    region: validated.region,
    segment: "Enterprise",
    mrr: toNumeric(validated.links.reduce((total, link) => total + link.mrr, 0)),
    nrr: toNumeric(validated.links.reduce((total, link) => total + link.nrr, 0)),
    contractTermMonths: validated.contractTermMonths,
    accountManagerId: accountManager.id,
    status: route.status,
    priority: "Normal",
  });
  const opportunity = await selectOpportunityById(db, opportunityId);

  const businessCaseId = createId();
  await db.insert(businessCases).values({
    id: businessCaseId,
    opportunityId: opportunity.id,
    version: 1,
    type: typeToDb[validated.type],
    solutionArchitectureName: validated.solutionArchitectureName,
    solutionEngineerName: validated.solutionEngineerName,
    accountNumber: validated.accountNumber,
    projectExecutiveSummary: validated.projectExecutiveSummary,
    irr: toNumeric(validated.irr),
    paybackMonths: validated.payback,
    capex: toNumeric(validated.capex),
    subsidyRequirement: toNumeric(validated.subsidy),
    approvedBudget: toNumeric(validated.approvedBudget),
    decisionOutput: decisionToDb[decision.decision],
    requiresCfo: decision.requiresCfo,
    subsidyDisclosed: decision.decision === "PROCEED WITH SUBSIDY DISCLOSURE",
    submittedAt: new Date(),
    approvedAt: route.autoApproved ? new Date() : null,
  });
  const businessCase = await selectBusinessCaseById(db, businessCaseId);

  const createdDocuments = await Promise.all(
    validated.attachments.map((attachment) =>
      insertDocument(db, {
        opportunityId: opportunity.id,
        uploadedById: accountManager.id,
        type: attachment.type,
        name: attachment.name,
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      }),
    ),
  );
  const documentIds = createdDocuments.map((document) => document.id);

  await db.insert(businessCaseLinks).values(
    validated.links.map((link) => {
      const record = mapLinkInputToRecord(
        link,
        link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
          ? documentIds[link.evidenceAttachmentIndex] ?? null
          : null,
      );

      return mapLinkRecordToDbInsert(businessCase.id, record);
    }),
  );

  await db.insert(workflowAssignments).values({
    opportunityId: opportunity.id,
    role: roleToDb[route.role],
    assigneeId: routeAssignee.id,
    status: route.status,
  });

  await db.insert(approvalHistory).values({
    opportunityId: opportunity.id,
    businessCaseId: businessCase.id,
    actorId: accountManager.id,
    role: "ACCOUNT_MANAGER",
    action: "SUBMIT",
    fromStatus: "OPPORTUNITY_CREATED",
    toStatus: route.status,
    decision: decisionToDb[decision.decision],
    notes: route.notes,
  });

  if (route.autoApproved) {
    await issueApprovalCertificate(opportunity.id, businessCase.id, accountManager.id, route.notes);
  }

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    event: route.event,
    entityType: "BusinessCase",
    entityId: businessCase.id,
    metadata: {
      routeRole: route.role,
      autoApproved: route.autoApproved,
      linkCount: validated.links.length,
      attachmentCount: validated.attachments.length,
    },
  });

  const project = await toProjectRecord(opportunity);

  if (!project) {
    throw new Error("BC submission was created but could not be read.");
  }

  return project;
}

export async function createBcDraft(input: BcDraftInput) {
  if (shouldUseLocalProjectStorage()) {
    return localCreateBcDraft(input);
  }

  const db = getDb();
  const accountManagerName = input.accountManagerName.trim() || "Current User";
  const accountManager = await findOrCreateUser(accountManagerName, "Account Manager");
  const draftReferenceBase = input.opportunityNumber.trim() || buildReference();
  const [referenceConflict] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.reference, draftReferenceBase))
    .limit(1);
  const opportunityReference = referenceConflict
    ? `${draftReferenceBase}-DRAFT-${randomUUID().slice(0, 4).toUpperCase()}`
    : draftReferenceBase;
  const customerName = input.customerName.trim() || "Draft Customer";
  const normalizedInput = {
    ...input,
    customerName,
    solutionArchitectureName: input.solutionArchitectureName.trim() || "Unassigned",
    solutionEngineerName: input.solutionEngineerName.trim() || "Unassigned",
    region: input.region.trim() || "Unassigned",
    type: input.type || "Ordinary BC",
    irr: Number.isFinite(input.irr) ? input.irr : 0,
    payback: Number.isFinite(input.payback) ? input.payback : 0,
    capex: Number.isFinite(input.capex) ? input.capex : 0,
    subsidy: Number.isFinite(input.subsidy) ? input.subsidy : 0,
    approvedBudget: Number.isFinite(input.approvedBudget) ? input.approvedBudget : 0,
  };
  const decision = deriveDecision({
    irr: normalizedInput.irr,
    paybackMonths: normalizedInput.payback,
    subsidyRequirement: normalizedInput.subsidy,
    capex: normalizedInput.capex,
  });
  const opportunityId = createId();
  await db.insert(opportunities).values({
    id: opportunityId,
    reference: opportunityReference,
    customerName: normalizedInput.customerName,
    opportunityName: `${normalizedInput.customerName} draft`,
    region: normalizedInput.region,
    segment: "Enterprise",
    contractTermMonths: normalizedInput.contractTermMonths || 12,
    accountManagerId: accountManager.id,
    status: "OPPORTUNITY_CREATED",
    priority: "Normal",
  });
  const opportunity = await selectOpportunityById(db, opportunityId);

  const businessCaseId = createId();
  await db.insert(businessCases).values({
    id: businessCaseId,
    opportunityId: opportunity.id,
    version: 1,
    type: typeToDb[normalizedInput.type],
    solutionArchitectureName: normalizedInput.solutionArchitectureName,
    solutionEngineerName: normalizedInput.solutionEngineerName,
    accountNumber: normalizedInput.accountNumber || null,
    projectExecutiveSummary: normalizedInput.projectExecutiveSummary || null,
    irr: toNumeric(normalizedInput.irr),
    paybackMonths: normalizedInput.payback,
    capex: toNumeric(normalizedInput.capex),
    subsidyRequirement: toNumeric(normalizedInput.subsidy),
    approvedBudget: toNumeric(normalizedInput.approvedBudget),
    decisionOutput: decisionToDb[decision.decision],
    requiresCfo: decision.requiresCfo,
    subsidyDisclosed: normalizedInput.subsidy > 0,
    submittedAt: null,
  });
  const businessCase = await selectBusinessCaseById(db, businessCaseId);

  const createdDocuments = await Promise.all(
    normalizedInput.attachments.map((attachment) =>
      insertDocument(db, {
        opportunityId: opportunity.id,
        uploadedById: accountManager.id,
        type: attachment.type,
        name: attachment.name,
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      }),
    ),
  );
  const documentIds = createdDocuments.map((document) => document.id);

  if (normalizedInput.links.length > 0) {
    await db.insert(businessCaseLinks).values(
      normalizedInput.links.map((link) => {
        const record = mapLinkInputToRecord(
          link,
          link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
            ? documentIds[link.evidenceAttachmentIndex] ?? null
            : null,
        );

        return mapLinkRecordToDbInsert(businessCase.id, record);
      }),
    );
  }

  await db.insert(workflowAssignments).values({
    opportunityId: opportunity.id,
    role: roleToDb["Account Manager"],
    assigneeId: accountManager.id,
    status: "OPPORTUNITY_CREATED",
  });

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    event: "BC_DRAFT_SAVED",
    entityType: "BusinessCase",
    entityId: businessCase.id,
    metadata: {
      nextRole: "Account Manager",
      linkCount: normalizedInput.links.length,
      attachmentCount: normalizedInput.attachments.length,
    },
  });

  const project = await toProjectRecord(opportunity);

  if (!project) {
    throw new Error("Draft was created but could not be read.");
  }

  return project;
}

export async function listProjects() {
  if (shouldUseLocalProjectStorage()) {
    return localListProjects();
  }

  const db = getDb();
  const rows = await db.select().from(opportunities).orderBy(desc(opportunities.updatedAt));
  const projects: ProjectRecord[] = [];

  for (const row of rows) {
    const project = await toProjectRecord(row);

    if (project) {
      projects.push(project);
    }
  }

  return projects;
}

type ProjectListResult = {
  projects: ProjectRecord[];
  dataUnavailable: boolean;
};

function getNestedErrorCode(error: unknown) {
  let current = error;

  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    const code = "code" in current ? current.code : undefined;

    if (typeof code === "string") {
      return code;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
}

function isDatabaseConnectionError(error: unknown) {
  return ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH"].includes(
    getNestedErrorCode(error) ?? "",
  );
}

export async function listProjectsForPage(): Promise<ProjectListResult> {
  try {
    return {
      projects: await listProjects(),
      dataUnavailable: false,
    };
  } catch (error) {
    if (!isDatabaseConnectionError(error)) {
      throw error;
    }

    console.error("Database connection failed while loading projects.", error);

    return {
      projects: [],
      dataUnavailable: true,
    };
  }
}

export async function getProject(id: string) {
  if (shouldUseLocalProjectStorage()) {
    return localGetProject(id);
  }

  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!opportunity) return undefined;

  return toProjectRecord(opportunity);
}

export async function createProject(input: ProjectInput) {
  if (shouldUseLocalProjectStorage()) {
    return localCreateProject(input);
  }

  const db = getDb();
  const accountManager = await findOrCreateUser(input.owner, "Account Manager");
  const opportunityId = createId();
  const reference = buildReference();
  await db.insert(opportunities).values({
    id: opportunityId,
    reference,
    customerName: input.customer,
    opportunityName: input.title,
    region: input.region,
    segment: "Enterprise",
    accountManagerId: accountManager.id,
    status: statusToDb[input.state],
    priority: "Normal",
  });
  const opportunity = await selectOpportunityById(db, opportunityId);
  const businessCase = await insertBusinessCase(opportunity.id, input, 1);

  await insertActuals(opportunity.id, businessCase.id, input);
  await insertAssignment(opportunity.id, input);

  const project = await toProjectRecord(opportunity);

  if (!project) {
    throw new Error("Project was created but could not be read.");
  }

  return project;
}

export async function updateProject(id: string, input: ProjectInput) {
  if (shouldUseLocalProjectStorage()) {
    return localUpdateProject(id, input);
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!existing) {
    throw new Error("Project not found.");
  }

  const accountManager = await findOrCreateUser(input.owner, "Account Manager");
  const latestBusinessCase = await getLatestBusinessCase(existing.id);
  await db
    .update(opportunities)
    .set({
      customerName: input.customer,
      opportunityName: input.title,
      region: input.region,
      accountManagerId: accountManager.id,
      status: statusToDb[input.state],
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, existing.id));
  const opportunity = await selectOpportunityById(db, existing.id);
  const businessCase = await insertBusinessCase(
    existing.id,
    input,
    (latestBusinessCase?.version ?? 0) + 1,
  );

  await insertActuals(existing.id, businessCase.id, input);
  await insertAssignment(existing.id, input);

  const project = await toProjectRecord(opportunity);

  if (!project) {
    throw new Error("Project was updated but could not be read.");
  }

  return project;
}

export async function decideFinanceWorkflow(
  id: string,
  decision: FinanceDecision,
  notes: string,
) {
  if (shouldUseLocalProjectStorage()) {
    return localDecideFinanceWorkflow(id, decision);
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!existing) {
    throw new Error("Project not found.");
  }

  const businessCase = await getLatestBusinessCase(existing.id);
  const assignment = await getLatestAssignment(existing.id);

  if (!businessCase) {
    throw new Error("Project has no business case to route.");
  }

  const route = getFinanceRoute(decision, businessCase);
  const actorRole = assignment?.role ?? roleToDb["BC Analyst / Finance"];
  const actor =
    assignment?.assigneeId ??
    (await findOrCreateUser("Finance Workflow", dbToRole[actorRole])).id;

  if (assignment) {
    await db
      .update(workflowAssignments)
      .set({ completedAt: new Date() })
      .where(eq(workflowAssignments.id, assignment.id));
  }

  await db
    .update(opportunities)
    .set({
      status: route.status,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, existing.id));
  const opportunity = await selectOpportunityById(db, existing.id);

  if (decision === "approve") {
    await db
      .update(businessCases)
      .set({
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessCases.id, businessCase.id));
    await issueApprovalCertificate(existing.id, businessCase.id, actor, route.notes);
  }

  await assignWorkflow(existing.id, route.role, route.assigneeName, route.status);

  await db.insert(approvalHistory).values({
    opportunityId: existing.id,
    businessCaseId: businessCase.id,
    actorId: actor,
    role: actorRole,
    action: route.action,
    fromStatus: existing.status,
    toStatus: route.status,
    decision: businessCase.decisionOutput,
    notes: notes || route.notes,
  });

  await db.insert(auditLogs).values({
    opportunityId: existing.id,
    actorId: actor,
    event: route.event,
    entityType: "BusinessCase",
    entityId: businessCase.id,
    metadata: {
      outcome: decision,
      assignedRole: route.role,
      notes: notes || route.notes,
    },
  });

  const project = await toProjectRecord(opportunity);

  if (!project) {
    throw new Error("Finance decision was saved but the project could not be read.");
  }

  return project;
}

export async function advanceProjectToNextStage(id: string) {
  if (shouldUseLocalProjectStorage()) {
    return localAdvanceProjectToNextStage(id);
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!existing) {
    throw new Error("Project not found.");
  }

  const project = await toProjectRecord(existing);

  if (!project) {
    throw new Error("Project has no business case to route.");
  }

  const transition =
    workflowTransitions.find(
      (item) => item.from === project.state && item.owner === project.roleQueue,
    ) ?? workflowTransitions.find((item) => item.from === project.state);

  if (!transition) {
    throw new Error("Project is already at the final workflow stage.");
  }

  const assignment = await getLatestAssignment(existing.id);
  const actorRole = assignment?.role ?? roleToDb[project.roleQueue];
  const actor =
    assignment?.assigneeId ??
    (await findOrCreateUser(project.roleQueue, project.roleQueue)).id;
  const nextTransition = workflowTransitions.find((item) => item.from === transition.to);
  const nextRole = nextTransition?.owner ?? transition.owner;
  const nextStatus = statusToDb[transition.to];

  if (assignment) {
    await db
      .update(workflowAssignments)
      .set({ completedAt: new Date() })
      .where(eq(workflowAssignments.id, assignment.id));
  }

  await db
    .update(opportunities)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, existing.id));
  const opportunity = await selectOpportunityById(db, existing.id);

  await assignWorkflow(existing.id, nextRole, assigneeNameForRole(nextRole, project), nextStatus);

  await db.insert(auditLogs).values({
    opportunityId: existing.id,
    actorId: actor,
    event: "PROJECT_SENT_TO_NEXT_STAGE",
    entityType: "Opportunity",
    entityId: existing.id,
    metadata: {
      fromState: project.state,
      toState: transition.to,
      fromRole: dbToRole[actorRole],
      nextRole,
    },
  });

  const routedProject = await toProjectRecord(opportunity);

  if (!routedProject) {
    throw new Error("Project was routed but could not be read.");
  }

  return routedProject;
}

function assigneeNameForRole(role: Role, project: ProjectRecord) {
  if (role === "Account Manager") {
    return project.owner;
  }

  if (role === "Solutions Architect") {
    return project.solutionArchitectureName;
  }

  if (role === "Solutions Engineer") {
    return project.solutionEngineerName;
  }

  return role;
}

function getFinanceRoute(
  decision: FinanceDecision,
  businessCase: typeof businessCases.$inferSelect,
): {
  status: DbStatus;
  role: Role;
  assigneeName: string;
  action: "APPROVE" | "ESCALATE" | "REQUEST_REVISION";
  event: string;
  notes: string;
} {
  if (decision === "approve") {
    return {
      status: statusToDb["Sales Operations Validation"],
      role: "Sales Operations",
      assigneeName: "Sales Operations",
      action: "APPROVE",
      event: "FINANCE_APPROVED_TO_SALES_OPERATIONS",
      notes: "Finance approved the business case for Sales Operations validation.",
    };
  }

  if (decision === "reject-escalate-cfo") {
    return {
      status: statusToDb["Finance / CFO Approval"],
      role: "CFO",
      assigneeName: "CFO",
      action: "ESCALATE",
      event: "FINANCE_REJECTED_ESCALATED_TO_CFO",
      notes: "Finance rejected the business case and escalated it to CFO review.",
    };
  }

  if (decision === "reject-question-architect") {
    return {
      status: statusToDb["Business Case Prepared"],
      role: "Solutions Architect",
      assigneeName: businessCase.solutionArchitectureName,
      action: "REQUEST_REVISION",
      event: "FINANCE_REJECTED_QUESTION_TO_SOLUTION_ARCHITECT",
      notes: "Finance rejected the business case and requested design clarification.",
    };
  }

  return {
    status: statusToDb["Business Case Prepared"],
    role: "Solutions Engineer",
    assigneeName: businessCase.solutionEngineerName,
    action: "REQUEST_REVISION",
    event: "FINANCE_REJECTED_QUESTION_TO_SOLUTION_ENGINEER",
    notes: "Finance rejected the business case and requested technical costing clarification.",
  };
}

export async function deleteProject(id: string) {
  if (shouldUseLocalProjectStorage()) {
    await localDeleteProject(id);
    return;
  }

  const db = getDb();
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.reference, id))
    .limit(1);

  if (!opportunity) return;

  const projectBusinessCases = await db
    .select()
    .from(businessCases)
    .where(eq(businessCases.opportunityId, opportunity.id));

  for (const businessCase of projectBusinessCases) {
    await db
      .delete(businessCaseLinks)
      .where(eq(businessCaseLinks.businessCaseId, businessCase.id));
    await db
      .delete(approvalCertificates)
      .where(eq(approvalCertificates.businessCaseId, businessCase.id));
    await db
      .delete(actualCostCaptures)
      .where(eq(actualCostCaptures.businessCaseId, businessCase.id));
    await db.delete(revisions).where(eq(revisions.businessCaseId, businessCase.id));
    await db
      .delete(approvalHistory)
      .where(eq(approvalHistory.businessCaseId, businessCase.id));
  }

  const projectPboqRequests = await db
    .select({ id: pboqRequests.id })
    .from(pboqRequests)
    .where(eq(pboqRequests.opportunityId, opportunity.id));

  for (const request of projectPboqRequests) {
    await db.delete(pboqCostLines).where(eq(pboqCostLines.pboqRequestId, request.id));
  }

  await db.delete(pboqRequests).where(eq(pboqRequests.opportunityId, opportunity.id));
  await db.delete(workflowAssignments).where(eq(workflowAssignments.opportunityId, opportunity.id));
  await db.delete(documents).where(eq(documents.opportunityId, opportunity.id));
  await db.delete(auditLogs).where(eq(auditLogs.opportunityId, opportunity.id));
  await db.delete(revisions).where(eq(revisions.opportunityId, opportunity.id));
  await db.delete(approvalHistory).where(eq(approvalHistory.opportunityId, opportunity.id));
  await db.delete(businessCases).where(eq(businessCases.opportunityId, opportunity.id));
  await db.delete(opportunities).where(eq(opportunities.id, opportunity.id));
}
