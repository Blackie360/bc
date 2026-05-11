import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

const textId = (name: string) => text(name).primaryKey().$defaultFn(randomUUID);

export const userRole = pgEnum("UserRole", [
  "ACCOUNT_MANAGER",
  "FIBER_PLANNING",
  "BC_ANALYST",
  "CFO",
  "SALES_OPERATIONS",
  "SDU",
  "SITE_ACQUISITION_MANAGER",
  "PROJECT_MANAGER",
  "CONTRACTOR",
]);

export const opportunityStatus = pgEnum("OpportunityStatus", [
  "OPPORTUNITY_CREATED",
  "PBOQ_REQUESTED",
  "FIBER_PLANNING_COSTS",
  "BUSINESS_CASE_PREPARED",
  "FINANCIAL_METRICS_COMPUTED",
  "APPROVAL_ROUTING",
  "FINANCE_CFO_APPROVAL",
  "SALES_OPERATIONS_VALIDATION",
  "SDU_VALIDATION",
  "SURVEY_SITE_ACQUISITION",
  "CONTRACTOR_IMPLEMENTATION",
  "ACTUAL_COST_CAPTURE",
  "BUDGET_ACTUAL_ANALYSIS",
  "PROJECT_CLOSURE_REPORTING",
  "REVERTED",
  "CANCELLED",
]);

export const businessCaseType = pgEnum("BusinessCaseType", [
  "ORDINARY_BC",
  "MARGIN_ANALYSIS_BC",
]);

export const decisionOutput = pgEnum("DecisionOutput", [
  "PROCEED",
  "SEEK_FINANCE_APPROVAL",
  "PROCEED_WITH_SUBSIDY_DISCLOSURE",
]);

export const approvalAction = pgEnum("ApprovalAction", [
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "REVERT",
  "ESCALATE",
  "VALIDATE",
  "REQUEST_REVISION",
  "CAPTURE_ACTUALS",
  "GENERATE_CERTIFICATE",
]);

export const documentType = pgEnum("DocumentType", [
  "SOLUTION_DESIGN",
  "PBOQ",
  "BUSINESS_CASE",
  "SITE_ACQUISITION",
  "SURVEY_REPORT",
  "CONTRACTOR_QUOTE",
  "BC_APPROVAL_CERTIFICATE",
  "ACTUAL_COST_EVIDENCE",
]);

export const users = pgTable("User", {
  id: textId("id"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRole("role").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const opportunities = pgTable("Opportunity", {
  id: textId("id"),
  reference: text("reference").notNull().unique(),
  customerName: text("customerName").notNull(),
  opportunityName: text("opportunityName").notNull(),
  region: text("region").notNull(),
  segment: text("segment").notNull(),
  accountManagerId: text("accountManagerId")
    .notNull()
    .references(() => users.id),
  status: opportunityStatus("status").default("OPPORTUNITY_CREATED").notNull(),
  priority: text("priority").default("Normal").notNull(),
  requestedDate: timestamp("requestedDate", { mode: "date" }).defaultNow().notNull(),
  targetInstallDate: timestamp("targetInstallDate", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const pboqRequests = pgTable("PboqRequest", {
  id: textId("id"),
  opportunityId: text("opportunityId")
    .notNull()
    .unique()
    .references(() => opportunities.id),
  solutionDesignDocumentId: text("solutionDesignDocumentId"),
  siteCount: integer("siteCount").notNull(),
  routeDistanceKm: numeric("routeDistanceKm", { precision: 10, scale: 2 }).notNull(),
  surveyBudget: numeric("surveyBudget", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  requestedAt: timestamp("requestedAt", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completedAt", { mode: "date" }),
});

export const businessCases = pgTable(
  "BusinessCase",
  {
    id: textId("id"),
    opportunityId: text("opportunityId")
      .notNull()
      .references(() => opportunities.id),
    version: integer("version").default(1).notNull(),
    type: businessCaseType("type").notNull(),
    irr: numeric("irr", { precision: 8, scale: 2 }).notNull(),
    paybackMonths: integer("paybackMonths").notNull(),
    capex: numeric("capex", { precision: 14, scale: 2 }).notNull(),
    subsidyRequirement: numeric("subsidyRequirement", { precision: 14, scale: 2 }).notNull(),
    approvedBudget: numeric("approvedBudget", { precision: 14, scale: 2 }).notNull(),
    grossMarginPercent: numeric("grossMarginPercent", { precision: 8, scale: 2 }),
    decisionOutput: decisionOutput("decisionOutput").notNull(),
    requiresCfo: boolean("requiresCfo").default(false).notNull(),
    subsidyDisclosed: boolean("subsidyDisclosed").default(false).notNull(),
    submittedAt: timestamp("submittedAt", { mode: "date" }),
    approvedAt: timestamp("approvedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.opportunityId, table.version)],
);

export const workflowAssignments = pgTable("WorkflowAssignment", {
  id: textId("id"),
  opportunityId: text("opportunityId")
    .notNull()
    .references(() => opportunities.id),
  role: userRole("role").notNull(),
  assigneeId: text("assigneeId").references(() => users.id),
  status: opportunityStatus("status").notNull(),
  dueAt: timestamp("dueAt", { mode: "date" }),
  completedAt: timestamp("completedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const approvalHistory = pgTable("ApprovalHistory", {
  id: textId("id"),
  opportunityId: text("opportunityId")
    .notNull()
    .references(() => opportunities.id),
  businessCaseId: text("businessCaseId").references(() => businessCases.id),
  actorId: text("actorId")
    .notNull()
    .references(() => users.id),
  role: userRole("role").notNull(),
  action: approvalAction("action").notNull(),
  fromStatus: opportunityStatus("fromStatus"),
  toStatus: opportunityStatus("toStatus"),
  decision: decisionOutput("decision"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const revisions = pgTable("Revision", {
  id: textId("id"),
  opportunityId: text("opportunityId")
    .notNull()
    .references(() => opportunities.id),
  businessCaseId: text("businessCaseId").references(() => businessCases.id),
  requestedById: text("requestedById")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  notes: text("notes").notNull(),
  revisionNumber: integer("revisionNumber").notNull(),
  resolvedAt: timestamp("resolvedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const documents = pgTable("Document", {
  id: textId("id"),
  opportunityId: text("opportunityId")
    .notNull()
    .references(() => opportunities.id),
  uploadedById: text("uploadedById")
    .notNull()
    .references(() => users.id),
  type: documentType("type").notNull(),
  name: text("name").notNull(),
  storageKey: text("storageKey").notNull(),
  mimeType: text("mimeType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const actualCostCaptures = pgTable("ActualCostCapture", {
  id: textId("id"),
  opportunityId: text("opportunityId")
    .notNull()
    .references(() => opportunities.id),
  businessCaseId: text("businessCaseId")
    .notNull()
    .references(() => businessCases.id),
  contractorName: text("contractorName"),
  approvedBudget: numeric("approvedBudget", { precision: 14, scale: 2 }).notNull(),
  actualSpend: numeric("actualSpend", { precision: 14, scale: 2 }).notNull(),
  surveyBudget: numeric("surveyBudget", { precision: 14, scale: 2 }).notNull(),
  surveyActual: numeric("surveyActual", { precision: 14, scale: 2 }).notNull(),
  varianceAmount: numeric("varianceAmount", { precision: 14, scale: 2 }).notNull(),
  variancePercent: numeric("variancePercent", { precision: 8, scale: 2 }).notNull(),
  surveyDeviationPct: numeric("surveyDeviationPct", { precision: 8, scale: 2 }).notNull(),
  capturedAt: timestamp("capturedAt", { mode: "date" }).defaultNow().notNull(),
});

export const approvalCertificates = pgTable("ApprovalCertificate", {
  id: textId("id"),
  businessCaseId: text("businessCaseId")
    .notNull()
    .unique()
    .references(() => businessCases.id),
  certificateNo: text("certificateNo").notNull().unique(),
  issuedAt: timestamp("issuedAt", { mode: "date" }).defaultNow().notNull(),
  fileStorageKey: text("fileStorageKey").notNull(),
  checksum: text("checksum").notNull(),
});

export const auditLogs = pgTable("AuditLog", {
  id: textId("id"),
  opportunityId: text("opportunityId").references(() => opportunities.id),
  actorId: text("actorId").references(() => users.id),
  event: text("event").notNull(),
  entityType: text("entityType").notNull(),
  entityId: text("entityId").notNull(),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  createdOpportunities: many(opportunities),
  assignments: many(workflowAssignments),
  approvals: many(approvalHistory),
  auditLogs: many(auditLogs),
  documents: many(documents),
  revisions: many(revisions),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  accountManager: one(users, {
    fields: [opportunities.accountManagerId],
    references: [users.id],
  }),
  pboqRequest: one(pboqRequests),
  businessCases: many(businessCases),
  assignments: many(workflowAssignments),
  approvals: many(approvalHistory),
  documents: many(documents),
  auditLogs: many(auditLogs),
  revisions: many(revisions),
  actualCosts: many(actualCostCaptures),
}));

export const pboqRequestsRelations = relations(pboqRequests, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [pboqRequests.opportunityId],
    references: [opportunities.id],
  }),
}));

export const businessCasesRelations = relations(businessCases, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [businessCases.opportunityId],
    references: [opportunities.id],
  }),
  revisions: many(revisions),
  approvals: many(approvalHistory),
  certificate: one(approvalCertificates),
  actualCosts: many(actualCostCaptures),
}));

export const workflowAssignmentsRelations = relations(workflowAssignments, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [workflowAssignments.opportunityId],
    references: [opportunities.id],
  }),
  assignee: one(users, {
    fields: [workflowAssignments.assigneeId],
    references: [users.id],
  }),
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [approvalHistory.opportunityId],
    references: [opportunities.id],
  }),
  businessCase: one(businessCases, {
    fields: [approvalHistory.businessCaseId],
    references: [businessCases.id],
  }),
  actor: one(users, {
    fields: [approvalHistory.actorId],
    references: [users.id],
  }),
}));

export const revisionsRelations = relations(revisions, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [revisions.opportunityId],
    references: [opportunities.id],
  }),
  businessCase: one(businessCases, {
    fields: [revisions.businessCaseId],
    references: [businessCases.id],
  }),
  requestedBy: one(users, {
    fields: [revisions.requestedById],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [documents.opportunityId],
    references: [opportunities.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedById],
    references: [users.id],
  }),
}));

export const actualCostCapturesRelations = relations(actualCostCaptures, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [actualCostCaptures.opportunityId],
    references: [opportunities.id],
  }),
  businessCase: one(businessCases, {
    fields: [actualCostCaptures.businessCaseId],
    references: [businessCases.id],
  }),
}));

export const approvalCertificatesRelations = relations(approvalCertificates, ({ one }) => ({
  businessCase: one(businessCases, {
    fields: [approvalCertificates.businessCaseId],
    references: [businessCases.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [auditLogs.opportunityId],
    references: [opportunities.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type BusinessCase = typeof businessCases.$inferSelect;
export type NewBusinessCase = typeof businessCases.$inferInsert;
