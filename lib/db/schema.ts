import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { randomUUID } from "node:crypto";

const textId = (name: string) =>
  varchar(name, { length: 36 }).primaryKey().$defaultFn(randomUUID);

const userRoleValues = [
  "ACCOUNT_MANAGER",
  "FIBER_PLANNING",
  "SOLUTION_ARCHITECT",
  "SOLUTION_ENGINEER",
  "BC_ANALYST",
  "CFO",
  "SALES_OPERATIONS",
  "SDU",
  "SITE_ACQUISITION_MANAGER",
  "PROJECT_MANAGER",
  "CONTRACTOR",
] as const;

const opportunityStatusValues = [
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
] as const;

const businessCaseTypeValues = ["ORDINARY_BC", "MARGIN_ANALYSIS_BC"] as const;

const decisionOutputValues = [
  "PROCEED",
  "SEEK_FINANCE_APPROVAL",
  "PROCEED_WITH_SUBSIDY_DISCLOSURE",
] as const;

const pboqCostSourceValues = ["ACTUAL_SURVEY", "PBOQ_ESTIMATE"] as const;

const requiredServiceValues = ["EPL", "DIA", "DFA"] as const;

const approvalActionValues = [
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "REVERT",
  "ESCALATE",
  "VALIDATE",
  "REQUEST_REVISION",
  "CAPTURE_ACTUALS",
  "GENERATE_CERTIFICATE",
] as const;

const documentTypeValues = [
  "SOLUTION_DESIGN",
  "PBOQ",
  "PBOQ_SUMMARY_PROOF",
  "PBOQ_BUILD_PROOF",
  "PBOQ_MATERIAL_PROOF",
  "PBOQ_WAYLEAVE_PROOF",
  "BC_TEMPLATE",
  "BUSINESS_CASE",
  "SITE_ACQUISITION",
  "SURVEY_REPORT",
  "CONTRACTOR_QUOTE",
  "ORDER_FORM",
  "LSO",
  "ACTUAL_SURVEY_QUOTE",
  "BC_APPROVAL_CERTIFICATE",
  "ACTUAL_COST_EVIDENCE",
] as const;

const linkOnnetOffnetValues = ["ONNET", "OFFNET"] as const;

const linkCostSourceValues = ["PBOQ", "ACTUAL_SURVEY", "THIRD_PARTY_QUOTE"] as const;

export const users = mysqlTable("User", {
  id: textId("id"),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: mysqlEnum("role", userRoleValues).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const opportunities = mysqlTable("Opportunity", {
  id: textId("id"),
  reference: varchar("reference", { length: 64 }).notNull().unique(),
  customerName: text("customerName").notNull(),
  opportunityName: text("opportunityName").notNull(),
  siteName: text("siteName"),
  siteCoordinates: text("siteCoordinates"),
  requiredService: mysqlEnum("requiredService", requiredServiceValues),
  capacity: text("capacity"),
  salesRequestor: text("salesRequestor"),
  leadNetworkPlanner: text("leadNetworkPlanner"),
  region: text("region").notNull(),
  segment: text("segment").notNull(),
  mrr: decimal("mrr", { precision: 14, scale: 2 }).default("0").notNull(),
  nrr: decimal("nrr", { precision: 14, scale: 2 }).default("0").notNull(),
  contractTermMonths: int("contractTermMonths").default(12).notNull(),
  accountManagerId: varchar("accountManagerId", { length: 36 })
    .notNull()
    .references(() => users.id),
  status: mysqlEnum("status", opportunityStatusValues).default("OPPORTUNITY_CREATED").notNull(),
  priority: varchar("priority", { length: 32 }).default("Normal").notNull(),
  requestedDate: timestamp("requestedDate", { mode: "date" }).defaultNow().notNull(),
  designPlanDate: timestamp("designPlanDate", { mode: "date" }),
  targetInstallDate: timestamp("targetInstallDate", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const pboqRequests = mysqlTable("PboqRequest", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 })
    .notNull()
    .unique()
    .references(() => opportunities.id),
  solutionDesignDocumentId: varchar("solutionDesignDocumentId", { length: 36 }),
  siteCount: int("siteCount").notNull(),
  routeDistanceKm: decimal("routeDistanceKm", { precision: 10, scale: 2 }).notNull(),
  surveyBudget: decimal("surveyBudget", { precision: 14, scale: 2 }).notNull(),
  surveyAvailable: boolean("surveyAvailable").default(false).notNull(),
  costSource: mysqlEnum("costSource", pboqCostSourceValues).default("PBOQ_ESTIMATE").notNull(),
  actualSurveyCost: decimal("actualSurveyCost", { precision: 14, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  fiberPlanningNotes: text("fiberPlanningNotes"),
  bcPreparationDraft: json("bcPreparationDraft"),
  requestedAt: timestamp("requestedAt", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completedAt", { mode: "date" }),
});

export const pboqCostLines = mysqlTable("PboqCostLine", {
  id: textId("id"),
  pboqRequestId: varchar("pboqRequestId", { length: 36 })
    .notNull()
    .references(() => pboqRequests.id),
  linkName: text("linkName").notNull(),
  material: decimal("material", { precision: 14, scale: 2 }).notNull(),
  build: decimal("build", { precision: 14, scale: 2 }).notNull(),
  wayleave: decimal("wayleave", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const businessCases = mysqlTable(
  "BusinessCase",
  {
    id: textId("id"),
    opportunityId: varchar("opportunityId", { length: 36 })
      .notNull()
      .references(() => opportunities.id),
    version: int("version").default(1).notNull(),
    type: mysqlEnum("type", businessCaseTypeValues).notNull(),
    solutionArchitectureName: text("solutionArchitectureName").default("Unassigned").notNull(),
    solutionEngineerName: text("solutionEngineerName").default("Unassigned").notNull(),
    accountNumber: text("accountNumber"),
    projectExecutiveSummary: text("projectExecutiveSummary"),
    irr: decimal("irr", { precision: 8, scale: 2 }).notNull(),
    paybackMonths: int("paybackMonths").notNull(),
    capex: decimal("capex", { precision: 14, scale: 2 }).notNull(),
    subsidyRequirement: decimal("subsidyRequirement", { precision: 14, scale: 2 }).notNull(),
    approvedBudget: decimal("approvedBudget", { precision: 14, scale: 2 }).notNull(),
    grossMarginPercent: decimal("grossMarginPercent", { precision: 8, scale: 2 }),
    decisionOutput: mysqlEnum("decisionOutput", decisionOutputValues).notNull(),
    requiresCfo: boolean("requiresCfo").default(false).notNull(),
    subsidyDisclosed: boolean("subsidyDisclosed").default(false).notNull(),
    submittedAt: timestamp("submittedAt", { mode: "date" }),
    approvedAt: timestamp("approvedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    opportunityVersionUnique: uniqueIndex("BusinessCase_opportunityId_version_unique").on(
      table.opportunityId,
      table.version,
    ),
  }),
);

export const businessCaseLinks = mysqlTable("BusinessCaseLink", {
  id: textId("id"),
  businessCaseId: varchar("businessCaseId", { length: 36 })
    .notNull()
    .references(() => businessCases.id),
  linkName: text("linkName").notNull(),
  service: text("service"),
  technology: text("technology"),
  onnetOffnet: mysqlEnum("onnetOffnet", linkOnnetOffnetValues),
  costSource: mysqlEnum("costSource", linkCostSourceValues),
  material: decimal("material", { precision: 14, scale: 2 }).notNull(),
  labor: decimal("labor", { precision: 14, scale: 2 }).notNull(),
  provisioningCost: decimal("provisioningCost", { precision: 14, scale: 2 }).default("0").notNull(),
  wayleave: decimal("wayleave", { precision: 14, scale: 2 }).notNull(),
  mrr: decimal("mrr", { precision: 14, scale: 2 }).notNull(),
  mrc: decimal("mrc", { precision: 14, scale: 2 }).notNull(),
  nrc: decimal("nrc", { precision: 14, scale: 2 }).notNull(),
  nrr: decimal("nrr", { precision: 14, scale: 2 }).notNull(),
  onnetCapacity: text("onnetCapacity"),
  offnetCapacity: text("offnetCapacity"),
  evidenceDocumentId: varchar("evidenceDocumentId", { length: 36 }).references(() => documents.id),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const workflowAssignments = mysqlTable("WorkflowAssignment", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 })
    .notNull()
    .references(() => opportunities.id),
  role: mysqlEnum("role", userRoleValues).notNull(),
  assigneeId: varchar("assigneeId", { length: 36 }).references(() => users.id),
  status: mysqlEnum("status", opportunityStatusValues).notNull(),
  dueAt: timestamp("dueAt", { mode: "date" }),
  completedAt: timestamp("completedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const approvalHistory = mysqlTable("ApprovalHistory", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 })
    .notNull()
    .references(() => opportunities.id),
  businessCaseId: varchar("businessCaseId", { length: 36 }).references(() => businessCases.id),
  actorId: varchar("actorId", { length: 36 })
    .notNull()
    .references(() => users.id),
  role: mysqlEnum("role", userRoleValues).notNull(),
  action: mysqlEnum("action", approvalActionValues).notNull(),
  fromStatus: mysqlEnum("fromStatus", opportunityStatusValues),
  toStatus: mysqlEnum("toStatus", opportunityStatusValues),
  decision: mysqlEnum("decision", decisionOutputValues),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const revisions = mysqlTable("Revision", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 })
    .notNull()
    .references(() => opportunities.id),
  businessCaseId: varchar("businessCaseId", { length: 36 }).references(() => businessCases.id),
  requestedById: varchar("requestedById", { length: 36 })
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  notes: text("notes").notNull(),
  revisionNumber: int("revisionNumber").notNull(),
  resolvedAt: timestamp("resolvedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const documents = mysqlTable("Document", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 })
    .notNull()
    .references(() => opportunities.id),
  uploadedById: varchar("uploadedById", { length: 36 })
    .notNull()
    .references(() => users.id),
  type: mysqlEnum("type", documentTypeValues).notNull(),
  name: text("name").notNull(),
  storageKey: text("storageKey").notNull(),
  mimeType: varchar("mimeType", { length: 255 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const actualCostCaptures = mysqlTable("ActualCostCapture", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 })
    .notNull()
    .references(() => opportunities.id),
  businessCaseId: varchar("businessCaseId", { length: 36 })
    .notNull()
    .references(() => businessCases.id),
  contractorName: text("contractorName"),
  approvedBudget: decimal("approvedBudget", { precision: 14, scale: 2 }).notNull(),
  actualSpend: decimal("actualSpend", { precision: 14, scale: 2 }).notNull(),
  surveyBudget: decimal("surveyBudget", { precision: 14, scale: 2 }).notNull(),
  surveyActual: decimal("surveyActual", { precision: 14, scale: 2 }).notNull(),
  varianceAmount: decimal("varianceAmount", { precision: 14, scale: 2 }).notNull(),
  variancePercent: decimal("variancePercent", { precision: 8, scale: 2 }).notNull(),
  surveyDeviationPct: decimal("surveyDeviationPct", { precision: 8, scale: 2 }).notNull(),
  capturedAt: timestamp("capturedAt", { mode: "date" }).defaultNow().notNull(),
});

export const approvalCertificates = mysqlTable("ApprovalCertificate", {
  id: textId("id"),
  businessCaseId: varchar("businessCaseId", { length: 36 })
    .notNull()
    .unique()
    .references(() => businessCases.id),
  certificateNo: varchar("certificateNo", { length: 128 }).notNull().unique(),
  issuedAt: timestamp("issuedAt", { mode: "date" }).defaultNow().notNull(),
  fileStorageKey: text("fileStorageKey").notNull(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
});

export const auditLogs = mysqlTable("AuditLog", {
  id: textId("id"),
  opportunityId: varchar("opportunityId", { length: 36 }).references(() => opportunities.id),
  actorId: varchar("actorId", { length: 36 }).references(() => users.id),
  event: varchar("event", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 128 }).notNull(),
  entityId: varchar("entityId", { length: 36 }).notNull(),
  metadata: json("metadata").notNull(),
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

export const pboqRequestsRelations = relations(pboqRequests, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [pboqRequests.opportunityId],
    references: [opportunities.id],
  }),
  costLines: many(pboqCostLines),
}));

export const pboqCostLinesRelations = relations(pboqCostLines, ({ one }) => ({
  pboqRequest: one(pboqRequests, {
    fields: [pboqCostLines.pboqRequestId],
    references: [pboqRequests.id],
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
  links: many(businessCaseLinks),
}));

export const businessCaseLinksRelations = relations(businessCaseLinks, ({ one }) => ({
  businessCase: one(businessCases, {
    fields: [businessCaseLinks.businessCaseId],
    references: [businessCases.id],
  }),
  evidenceDocument: one(documents, {
    fields: [businessCaseLinks.evidenceDocumentId],
    references: [documents.id],
  }),
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
export type BusinessCaseLink = typeof businessCaseLinks.$inferSelect;
