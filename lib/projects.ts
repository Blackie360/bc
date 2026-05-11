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

const roleToDb: Record<Role, DbRole> = {
  "Account Manager": "ACCOUNT_MANAGER",
  "Fiber Planning Team": "FIBER_PLANNING",
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

export type ProjectRecord = ProjectInput & {
  id: string;
  decision: DecisionOutput;
  variance: number;
  revisions: number;
  createdAt: string;
  updatedAt: string;
};

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
