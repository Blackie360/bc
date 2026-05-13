import "server-only";

import { randomUUID } from "node:crypto";
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
  deriveDecision,
  roles,
  workflowTransitions,
  workflowStates,
  type BusinessCaseType,
  type DecisionOutput,
  type Role,
  type WorkflowState,
} from "@/lib/workflow";

type DbRole = (typeof users.$inferSelect)["role"];
type DbStatus = (typeof opportunities.$inferSelect)["status"];
type DbBusinessCaseType = (typeof businessCases.$inferSelect)["type"];
type DbDecision = (typeof businessCases.$inferSelect)["decisionOutput"];
type DbDocumentType = (typeof documents.$inferSelect)["type"];
type DbPboqCostSource = (typeof pboqRequests.$inferSelect)["costSource"];

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

export const bcLinkInputSchema = z.object({
  linkName: z.string().min(1),
  material: z.coerce.number().nonnegative(),
  labor: z.coerce.number().nonnegative(),
  wayleave: z.coerce.number().nonnegative(),
  mrr: z.coerce.number().nonnegative(),
  mrc: z.coerce.number().nonnegative(),
  nrc: z.coerce.number().nonnegative(),
  nrr: z.coerce.number().nonnegative(),
  evidenceAttachmentIndex: z.number().int().nonnegative(),
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
  attachments: z.array(
    z.object({
      type: z.enum(["BC_TEMPLATE", "PBOQ", "ORDER_FORM", "ACTUAL_SURVEY_QUOTE"]),
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
    opportunityName: z.string().min(3),
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
  labor: z.coerce.number().nonnegative(),
  wayleave: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

export const fiberPlanningInputSchema = z.object({
  fiberPlanningNotes: z.string().optional(),
  lines: z.array(pboqCostLineInputSchema).min(1),
  pboqFile: z.object({
    type: z.literal("PBOQ"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
});

export type FiberPlanningInput = z.infer<typeof fiberPlanningInputSchema>;

export const preparedBcInputSchema = z.object({
  solutionArchitectureName: z.string().min(2),
  solutionEngineerName: z.string().min(2),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  bcTemplate: z.object({
    type: z.literal("BC_TEMPLATE"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
  orderForm: z.object({
    type: z.literal("ORDER_FORM"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
});

export type PreparedBcInput = z.infer<typeof preparedBcInputSchema>;
export type BcDraftInput = {
  opportunityNumber: string;
  customerName: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  accountManagerName: string;
  region: string;
  type: BusinessCaseType;
  irr: number;
  payback: number;
  capex: number;
  subsidy: number;
  approvedBudget: number;
  links: Array<{
    linkName: string;
    material: number;
    labor: number;
    wayleave: number;
    mrr: number;
    mrc: number;
    nrc: number;
    nrr: number;
    evidenceAttachmentIndex: number;
  }>;
  attachments: BcSubmissionInput["attachments"];
};

export type ProjectLinkRecord = {
  id: string;
  linkName: string;
  material: number;
  labor: number;
  wayleave: number;
  mrr: number;
  mrc: number;
  nrc: number;
  nrr: number;
  evidenceDocumentId: string | null;
};

export type ProjectDocumentRecord = {
  id: string;
  type: DbDocumentType;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type PboqCostLineRecord = {
  id: string;
  linkName: string;
  material: number;
  labor: number;
  wayleave: number;
  notes: string | null;
};

export type PboqRequestRecord = {
  id: string;
  siteCount: number;
  routeDistanceKm: number;
  surveyBudget: number;
  surveyAvailable: boolean;
  costSource: DbPboqCostSource;
  actualSurveyCost: number;
  notes: string | null;
  fiberPlanningNotes: string | null;
  completedAt: string | null;
  costLines: PboqCostLineRecord[];
};

export type ProjectRecord = ProjectInput & {
  id: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  opportunityMrr: number;
  opportunityNrr: number;
  contractTermMonths: number;
  pboqRequest?: PboqRequestRecord;
  links: ProjectLinkRecord[];
  documents: ProjectDocumentRecord[];
  totalMrr: number;
  totalMrc: number;
  totalNrc: number;
  totalNrr: number;
  decision: DecisionOutput | "PENDING";
  certificateIssued: boolean;
  variance: number;
  revisions: number;
  createdAt: string;
  updatedAt: string;
};

export type FinanceDecision =
  | "approve"
  | "reject-escalate-cfo"
  | "reject-question-architect"
  | "reject-question-engineer";

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

  const [created] = await db
    .insert(users)
    .values({
      name,
      email,
      role: roleToDb[role],
    })
    .returning();

  return created;
}

function buildReference() {
  return `BC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
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
      labor: dbNumber(line.labor),
      wayleave: dbNumber(line.wayleave),
      notes: line.notes,
    })),
  };
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
    material: dbNumber(row.material),
    labor: dbNumber(row.labor),
    wayleave: dbNumber(row.wayleave),
    mrr: dbNumber(row.mrr),
    mrc: dbNumber(row.mrc),
    nrc: dbNumber(row.nrc),
    nrr: dbNumber(row.nrr),
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
      (total, line) => total + line.material + line.labor + line.wayleave,
      0,
    ) ?? 0;
  const approvedBudget = businessCase
    ? dbNumber(businessCase.approvedBudget)
    : pboqBudget;
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
    region: opportunity.region,
    owner: accountManager?.name ?? "Unassigned",
    solutionArchitectureName: businessCase?.solutionArchitectureName ?? "Unassigned",
    solutionEngineerName: businessCase?.solutionEngineerName ?? "Unassigned",
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
    capex: businessCase ? dbNumber(businessCase.capex) : pboqBudget,
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
  const [businessCase] = await db
    .insert(businessCases)
    .values({
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
    })
    .returning();

  return businessCase;
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
  const validated = pboqRequestInputSchema.parse(input);
  const db = getDb();
  const accountManager = await findOrCreateUser(
    validated.accountManagerName,
    "Account Manager",
  );
  const fiberPlanner = await findOrCreateUser("Fiber Planning Team", "Fiber Planning Team");
  const [existing] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.reference, validated.opportunityNumber))
    .limit(1);

  if (existing) {
    throw new Error("Opportunity number already exists.");
  }

  const [opportunity] = await db
    .insert(opportunities)
    .values({
      reference: validated.opportunityNumber,
      customerName: validated.customerName,
      opportunityName: validated.opportunityName,
      region: validated.region,
      segment: validated.segment,
      mrr: toNumeric(validated.mrr),
      nrr: toNumeric(validated.nrr),
      contractTermMonths: validated.contractTermMonths,
      accountManagerId: accountManager.id,
      status: statusToDb["PBOQ Request Submitted"],
      priority: "Normal",
    })
    .returning();

  const [pboqAttachment] = validated.pboqAttachment
    ? await db
        .insert(documents)
        .values({
          opportunityId: opportunity.id,
          uploadedById: accountManager.id,
          type: "PBOQ",
          name: validated.pboqAttachment.name,
          storageKey: validated.pboqAttachment.storageKey,
          mimeType: validated.pboqAttachment.mimeType,
          sizeBytes: validated.pboqAttachment.sizeBytes,
        })
        .returning()
    : [];

  const [pboqRequest] = await db
    .insert(pboqRequests)
    .values({
      opportunityId: opportunity.id,
      solutionDesignDocumentId: null,
      siteCount: validated.siteCount,
      routeDistanceKm: toNumeric(validated.routeDistanceKm),
      surveyBudget: toNumeric(validated.surveyAvailable ? validated.actualSurveyCost : 0),
      surveyAvailable: validated.surveyAvailable,
      costSource: validated.surveyAvailable ? "ACTUAL_SURVEY" : "PBOQ_ESTIMATE",
      actualSurveyCost: toNumeric(validated.actualSurveyCost),
      notes: validated.notes || null,
    })
    .returning();

  await db.insert(workflowAssignments).values({
    opportunityId: opportunity.id,
    role: roleToDb["Fiber Planning Team"],
    assigneeId: fiberPlanner.id,
    status: statusToDb["PBOQ Request Submitted"],
  });

  await db.insert(approvalHistory).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    role: "ACCOUNT_MANAGER",
    action: "SUBMIT",
    fromStatus: "OPPORTUNITY_CREATED",
    toStatus: statusToDb["PBOQ Request Submitted"],
    notes: "Account Manager submitted PBOQ request attachment.",
  });

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    event: "PBOQ_REQUEST_SUBMITTED",
    entityType: "PboqRequest",
    entityId: pboqRequest.id,
    metadata: {
      nextRole: "Fiber Planning Team",
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

  const assignment = await completeLatestAssignment(opportunity.id);
  const actorRole = assignment?.role ?? roleToDb["Fiber Planning Team"];
  const actor =
    assignment?.assigneeId ??
    (await findOrCreateUser("Fiber Planning Team", "Fiber Planning Team")).id;
  const totalCost = validated.lines.reduce(
    (total, line) => total + line.material + line.labor + line.wayleave,
    0,
  );

  await db.delete(pboqCostLines).where(eq(pboqCostLines.pboqRequestId, pboqRequest.id));
  await db.insert(pboqCostLines).values(
    validated.lines.map((line) => ({
      pboqRequestId: pboqRequest.id,
      linkName: line.linkName,
      material: toNumeric(line.material),
      labor: toNumeric(line.labor),
      wayleave: toNumeric(line.wayleave),
      notes: line.notes || null,
    })),
  );

  await db.insert(documents).values({
    opportunityId: opportunity.id,
    uploadedById: actor,
    type: "PBOQ",
    name: validated.pboqFile.name,
    storageKey: validated.pboqFile.storageKey,
    mimeType: validated.pboqFile.mimeType,
    sizeBytes: validated.pboqFile.sizeBytes,
  });

  const [updatedOpportunity] = await db
    .update(opportunities)
    .set({
      status: statusToDb["Business Case Prepared"],
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunity.id))
    .returning();

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

export async function prepareBusinessCaseFromPboq(id: string, input: PreparedBcInput) {
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

  if (!pboqRequest || pboqRequest.costLines.length === 0) {
    throw new Error("PBOQ cost lines are required before BC preparation.");
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

  const [businessCase] = await db
    .insert(businessCases)
    .values({
      opportunityId: opportunity.id,
      version: (latestBusinessCase?.version ?? 0) + 1,
      type: typeToDb[validated.type],
      solutionArchitectureName: validated.solutionArchitectureName,
      solutionEngineerName: validated.solutionEngineerName,
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
    })
    .returning();

  const createdDocuments = await Promise.all(
    [validated.bcTemplate, validated.orderForm].map((attachment) =>
      db
        .insert(documents)
        .values({
          opportunityId: opportunity.id,
          uploadedById: actor,
          type: attachment.type,
          name: attachment.name,
          storageKey: attachment.storageKey,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        })
        .returning(),
    ),
  );

  const pboqDocuments = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.opportunityId, opportunity.id), eq(documents.type, "PBOQ")))
    .limit(1);
  const pboqDocumentId = pboqDocuments[0]?.id ?? createdDocuments[0][0].id;
  const perLinkMrr =
    pboqRequest.costLines.length === 0
      ? 0
      : dbNumber(opportunity.mrr) / pboqRequest.costLines.length;
  const perLinkNrr =
    pboqRequest.costLines.length === 0
      ? 0
      : dbNumber(opportunity.nrr) / pboqRequest.costLines.length;

  await db.insert(businessCaseLinks).values(
    pboqRequest.costLines.map((line) => ({
      businessCaseId: businessCase.id,
      linkName: line.linkName,
      material: toNumeric(line.material),
      labor: toNumeric(line.labor),
      wayleave: toNumeric(line.wayleave),
      mrr: toNumeric(perLinkMrr),
      mrc: "0",
      nrc: "0",
      nrr: toNumeric(perLinkNrr),
      evidenceDocumentId: pboqDocumentId,
    })),
  );

  const [updatedOpportunity] = await db
    .update(opportunities)
    .set({
      status: route.status,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunity.id))
    .returning();

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

  const [opportunity] = await db
    .insert(opportunities)
    .values({
      reference: validated.opportunityNumber,
      customerName: validated.customerName,
      opportunityName: `${validated.customerName} BC submission`,
      region: validated.region,
      segment: "Enterprise",
      mrr: toNumeric(validated.links.reduce((total, link) => total + link.mrr, 0)),
      nrr: toNumeric(validated.links.reduce((total, link) => total + link.nrr, 0)),
      contractTermMonths: 12,
      accountManagerId: accountManager.id,
      status: route.status,
      priority: "Normal",
    })
    .returning();

  const [businessCase] = await db
    .insert(businessCases)
    .values({
      opportunityId: opportunity.id,
      version: 1,
      type: typeToDb[validated.type],
      solutionArchitectureName: validated.solutionArchitectureName,
      solutionEngineerName: validated.solutionEngineerName,
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
    })
    .returning();

  const createdDocuments = await Promise.all(
    validated.attachments.map((attachment) =>
      db
        .insert(documents)
        .values({
          opportunityId: opportunity.id,
          uploadedById: accountManager.id,
          type: attachment.type,
          name: attachment.name,
          storageKey: attachment.storageKey,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        })
        .returning(),
    ),
  );
  const documentIds = createdDocuments.map(([document]) => document.id);

  await db.insert(businessCaseLinks).values(
    validated.links.map((link) => ({
      businessCaseId: businessCase.id,
      linkName: link.linkName,
      material: toNumeric(link.material),
      labor: toNumeric(link.labor),
      wayleave: toNumeric(link.wayleave),
      mrr: toNumeric(link.mrr),
      mrc: toNumeric(link.mrc),
      nrc: toNumeric(link.nrc),
      nrr: toNumeric(link.nrr),
      evidenceDocumentId: documentIds[link.evidenceAttachmentIndex],
    })),
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
  const [opportunity] = await db
    .insert(opportunities)
    .values({
      reference: opportunityReference,
      customerName: normalizedInput.customerName,
      opportunityName: `${normalizedInput.customerName} draft`,
      region: normalizedInput.region,
      segment: "Enterprise",
      accountManagerId: accountManager.id,
      status: "OPPORTUNITY_CREATED",
      priority: "Normal",
    })
    .returning();

  const [businessCase] = await db
    .insert(businessCases)
    .values({
      opportunityId: opportunity.id,
      version: 1,
      type: typeToDb[normalizedInput.type],
      solutionArchitectureName: normalizedInput.solutionArchitectureName,
      solutionEngineerName: normalizedInput.solutionEngineerName,
      irr: toNumeric(normalizedInput.irr),
      paybackMonths: normalizedInput.payback,
      capex: toNumeric(normalizedInput.capex),
      subsidyRequirement: toNumeric(normalizedInput.subsidy),
      approvedBudget: toNumeric(normalizedInput.approvedBudget),
      decisionOutput: decisionToDb[decision.decision],
      requiresCfo: decision.requiresCfo,
      subsidyDisclosed: normalizedInput.subsidy > 0,
      submittedAt: null,
    })
    .returning();

  const createdDocuments = await Promise.all(
    normalizedInput.attachments.map((attachment) =>
      db
        .insert(documents)
        .values({
          opportunityId: opportunity.id,
          uploadedById: accountManager.id,
          type: attachment.type,
          name: attachment.name,
          storageKey: attachment.storageKey,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        })
        .returning(),
    ),
  );
  const documentIds = createdDocuments.map(([document]) => document.id);

  if (normalizedInput.links.length > 0) {
    await db.insert(businessCaseLinks).values(
      normalizedInput.links.map((link) => ({
        businessCaseId: businessCase.id,
        linkName: link.linkName,
        material: toNumeric(link.material),
        labor: toNumeric(link.labor),
        wayleave: toNumeric(link.wayleave),
        mrr: toNumeric(link.mrr),
        mrc: toNumeric(link.mrc),
        nrc: toNumeric(link.nrc),
        nrr: toNumeric(link.nrr),
        evidenceDocumentId: documentIds[link.evidenceAttachmentIndex] ?? null,
      })),
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

export async function getProject(id: string) {
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
  const db = getDb();
  const accountManager = await findOrCreateUser(input.owner, "Account Manager");
  const [opportunity] = await db
    .insert(opportunities)
    .values({
      reference: buildReference(),
      customerName: input.customer,
      opportunityName: input.title,
      region: input.region,
      segment: "Enterprise",
      accountManagerId: accountManager.id,
      status: statusToDb[input.state],
      priority: "Normal",
    })
    .returning();
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
  const [opportunity] = await db
    .update(opportunities)
    .set({
      customerName: input.customer,
      opportunityName: input.title,
      region: input.region,
      accountManagerId: accountManager.id,
      status: statusToDb[input.state],
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, existing.id))
    .returning();
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

  const [opportunity] = await db
    .update(opportunities)
    .set({
      status: route.status,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, existing.id))
    .returning();

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

  const [opportunity] = await db
    .update(opportunities)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, existing.id))
    .returning();

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
