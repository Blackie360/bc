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

export type ProjectRecord = ProjectInput & {
  id: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  links: ProjectLinkRecord[];
  documents: ProjectDocumentRecord[];
  totalMrr: number;
  totalMrc: number;
  totalNrc: number;
  totalNrr: number;
  decision: DecisionOutput;
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
  const [links, projectDocuments] = await Promise.all([
    getBusinessCaseLinks(businessCase?.id),
    getProjectDocuments(opportunity.id),
  ]);

  if (!businessCase) {
    return undefined;
  }

  const approvedBudget = dbNumber(businessCase.approvedBudget);
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
    solutionArchitectureName: businessCase.solutionArchitectureName,
    solutionEngineerName: businessCase.solutionEngineerName,
    links,
    documents: projectDocuments,
    totalMrr: links.reduce((total, link) => total + link.mrr, 0),
    totalMrc: links.reduce((total, link) => total + link.mrc, 0),
    totalNrc: links.reduce((total, link) => total + link.nrc, 0),
    totalNrr: links.reduce((total, link) => total + link.nrr, 0),
    state: dbToStatus[opportunity.status],
    roleQueue: assignment ? dbToRole[assignment.role] : "Account Manager",
    type: dbToType[businessCase.type],
    irr: dbNumber(businessCase.irr),
    payback: businessCase.paybackMonths,
    capex: dbNumber(businessCase.capex),
    subsidy: dbNumber(businessCase.subsidyRequirement),
    approvedBudget,
    actualSpend,
    decision: dbToDecision[businessCase.decisionOutput],
    variance: Number(variance.toFixed(1)),
    surveyDeviation: dbNumber(actuals?.surveyDeviationPct),
    revisions: Math.max(0, businessCase.version - 1),
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
  const financeRole: Role = "BC Analyst / Finance";
  const financeAssignee = await findOrCreateUser(financeRole, financeRole);
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
      accountManagerId: accountManager.id,
      status: "FINANCE_CFO_APPROVAL",
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
      subsidyDisclosed: validated.subsidy > 0,
      submittedAt: new Date(),
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
    role: roleToDb[financeRole],
    assigneeId: financeAssignee.id,
    status: "FINANCE_CFO_APPROVAL",
  });

  await db.insert(approvalHistory).values({
    opportunityId: opportunity.id,
    businessCaseId: businessCase.id,
    actorId: accountManager.id,
    role: "ACCOUNT_MANAGER",
    action: "SUBMIT",
    fromStatus: "OPPORTUNITY_CREATED",
    toStatus: "FINANCE_CFO_APPROVAL",
    decision: decisionToDb[decision.decision],
    notes: decision.reason,
  });

  await db.insert(auditLogs).values({
    opportunityId: opportunity.id,
    actorId: accountManager.id,
    event: "BC_SUBMITTED_TO_FINANCE",
    entityType: "BusinessCase",
    entityId: businessCase.id,
    metadata: {
      financeRole,
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
  const projects = await Promise.all(rows.map((row) => toProjectRecord(row)));

  return projects.filter((project): project is ProjectRecord => Boolean(project));
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

  await db.delete(pboqRequests).where(eq(pboqRequests.opportunityId, opportunity.id));
  await db.delete(workflowAssignments).where(eq(workflowAssignments.opportunityId, opportunity.id));
  await db.delete(documents).where(eq(documents.opportunityId, opportunity.id));
  await db.delete(auditLogs).where(eq(auditLogs.opportunityId, opportunity.id));
  await db.delete(revisions).where(eq(revisions.opportunityId, opportunity.id));
  await db.delete(approvalHistory).where(eq(approvalHistory.opportunityId, opportunity.id));
  await db.delete(businessCases).where(eq(businessCases.opportunityId, opportunity.id));
  await db.delete(opportunities).where(eq(opportunities.id, opportunity.id));
}
