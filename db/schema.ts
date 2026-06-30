import {
  boolean,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { linkCostSourceValues, linkOnnetOffnetValues } from "@/lib/projects-types";
import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { PboqCostLineRecord } from "@/lib/pboq-kickoff-links";
import type {
  BcApprovalCertificateRecord,
  CertificateDistributionRecipient,
  FinanceDecisionRecord,
  ProjectRecord,
} from "@/lib/project-record-types";
import { roles, workflowStates } from "@/lib/workflow";

const businessCaseTypes = ["Ordinary BC", "Margin Analysis BC"] as const;
const decisionOutputs = [
  "PENDING",
  "PROCEED",
  "SEEK FINANCE APPROVAL",
  "PROCEED WITH SUBSIDY DISCLOSURE",
] as const;
const pboqTechnologies = ["Fibre Ready", "Fibre Entry", "Wireless"] as const;
const pboqCostSources = ["ACTUAL_SURVEY", "PBOQ_ESTIMATE", "FIBRE_READY"] as const;
const documentTypes = [
  "LSO",
  "BC_TEMPLATE",
  "PBOQ",
  "ACTUAL_SURVEY_QUOTE",
  "CONTRACTOR_QUOTE",
  "ORDER_FORM",
  "BC_APPROVAL_CERTIFICATE",
] as const;
const financeDecisionValues = [
  "approve",
  "reject",
  "escalate-cfo",
  "escallate-ceo",
  "question-architect",
  "sales-ops-discrepancy",
  "sdu-alignment-mismatch",
  "sdu-survey-variance",
] as const;

const money = (name: string) => decimal(name, { precision: 15, scale: 2 });
const percent = (name: string) => decimal(name, { precision: 8, scale: 2 });

export const opportunities = mysqlTable(
  "opportunities",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    customer: varchar("customer", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    siteName: varchar("site_name", { length: 255 }).notNull(),
    siteCoordinates: varchar("site_coordinates", { length: 255 }).notNull(),
    region: varchar("region", { length: 120 }).notNull(),
    owner: varchar("owner", { length: 255 }).notNull(),
    state: mysqlEnum("state", workflowStates).notNull(),
    roleQueue: mysqlEnum("role_queue", roles).notNull(),
    type: mysqlEnum("type", businessCaseTypes).notNull(),
    requiredService: varchar("required_service", { length: 80 }).notNull(),
    capacity: varchar("capacity", { length: 255 }).notNull(),
    salesRequestor: varchar("sales_requestor", { length: 255 }).notNull(),
    leadNetworkPlanner: varchar("lead_network_planner", { length: 255 }).notNull(),
    accountManagerName: varchar("account_manager_name", { length: 255 }).notNull(),
    dateRequested: timestamp("date_requested").notNull(),
    designPlanDate: datetime("design_plan_date"),
    accountNumber: varchar("account_number", { length: 191 }).notNull().default(""),
    solutionArchitectureName: varchar("solution_architecture_name", { length: 255 })
      .notNull()
      .default(""),
    solutionEngineerName: varchar("solution_engineer_name", { length: 255 })
      .notNull()
      .default(""),
    projectExecutiveSummary: text("project_executive_summary").notNull(),
    opportunityMrr: money("opportunity_mrr").notNull().default("0"),
    opportunityNrr: money("opportunity_nrr").notNull().default("0"),
    totalMrr: money("total_mrr").notNull().default("0"),
    totalMrc: money("total_mrc").notNull().default("0"),
    totalNrc: money("total_nrc").notNull().default("0"),
    totalNrr: money("total_nrr").notNull().default("0"),
    irr: percent("irr").notNull().default("0"),
    payback: int("payback").notNull().default(36),
    capex: money("capex").notNull().default("0"),
    subsidy: money("subsidy").notNull().default("0"),
    approvedBudget: money("approved_budget").notNull().default("0"),
    actualSpend: money("actual_spend").notNull().default("0"),
    surveyDeviation: percent("survey_deviation").notNull().default("0"),
    nrv: money("nrv").notNull().default("0"),
    tcv: money("tcv").notNull().default("0"),
    exchangeRateKesUsd: money("exchange_rate_kes_usd").notNull().default("130"),
    contractTermMonths: int("contract_term_months").notNull().default(12),
    due: varchar("due", { length: 120 }).notNull(),
    decision: mysqlEnum("decision", decisionOutputs).notNull().default("PENDING"),
    certificateIssued: boolean("certificate_issued").notNull().default(false),
    variance: percent("variance").notNull().default("0"),
    revisions: int("revisions").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    roleQueueIdx: index("opportunities_role_queue_idx").on(table.roleQueue),
    stateIdx: index("opportunities_state_idx").on(table.state),
    updatedAtIdx: index("opportunities_updated_at_idx").on(table.updatedAt),
  }),
);

export const pboqRequests = mysqlTable(
  "pboq_requests",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    opportunityId: varchar("opportunity_id", { length: 191 })
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    technology: mysqlEnum("technology", pboqTechnologies),
    siteCount: int("site_count").notNull().default(0),
    routeDistanceKm: decimal("route_distance_km", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    surveyBudget: money("survey_budget").notNull().default("0"),
    surveyAvailable: boolean("survey_available").notNull().default(false),
    costSource: mysqlEnum("cost_source", pboqCostSources).notNull(),
    actualSurveyCost: money("actual_survey_cost").notNull().default("0"),
    notes: text("notes"),
    fiberPlanningNotes: text("fiber_planning_notes"),
    completedAt: datetime("completed_at"),
    bcPreparationDraft: json("bc_preparation_draft").$type<PreparedBcDraft | null>(),
  },
  (table) => ({
    opportunityIdx: index("pboq_requests_opportunity_idx").on(table.opportunityId),
  }),
);

export const pboqCostLines = mysqlTable(
  "pboq_cost_lines",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    pboqRequestId: varchar("pboq_request_id", { length: 191 })
      .notNull()
      .references(() => pboqRequests.id, { onDelete: "cascade" }),
    linkName: varchar("link_name", { length: 255 }).notNull(),
    siteCoordinates: varchar("site_coordinates", { length: 255 }),
    material: money("material").notNull().default("0"),
    build: money("build").notNull().default("0"),
    wayleave: money("wayleave").notNull().default("0"),
    pboqDocumentId: varchar("pboq_document_id", { length: 191 }),
    notes: text("notes"),
    rawRecord: json("raw_record").$type<PboqCostLineRecord | null>(),
  },
  (table) => ({
    requestIdx: index("pboq_cost_lines_request_idx").on(table.pboqRequestId),
  }),
);

export const projectLinks = mysqlTable(
  "project_links",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    opportunityId: varchar("opportunity_id", { length: 191 })
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    linkName: varchar("link_name", { length: 255 }).notNull(),
    service: varchar("service", { length: 80 }).notNull(),
    technology: varchar("technology", { length: 120 }).notNull(),
    onnetOffnet: mysqlEnum("onnet_offnet", linkOnnetOffnetValues),
    costSource: mysqlEnum("cost_source", linkCostSourceValues),
    newBuildCost: money("new_build_cost").notNull().default("0"),
    provisioningCost: money("provisioning_cost").notNull().default("0"),
    materialCost: money("material_cost").notNull().default("0"),
    wayleaveCost: money("wayleave_cost").notNull().default("0"),
    mrr: money("mrr").notNull().default("0"),
    mrc: money("mrc").notNull().default("0"),
    nrc: money("nrc").notNull().default("0"),
    nrr: money("nrr").notNull().default("0"),
    nrv: money("nrv").notNull().default("0"),
    tcv: money("tcv").notNull().default("0"),
    onnetCapacity: varchar("onnet_capacity", { length: 120 }),
    offnetCapacity: varchar("offnet_capacity", { length: 120 }),
    evidenceDocumentId: varchar("evidence_document_id", { length: 191 }),
  },
  (table) => ({
    opportunityIdx: index("project_links_opportunity_idx").on(table.opportunityId),
  }),
);

export const projectDocuments = mysqlTable(
  "project_documents",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    opportunityId: varchar("opportunity_id", { length: 191 })
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", documentTypes).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    opportunityIdx: index("project_documents_opportunity_idx").on(table.opportunityId),
    typeIdx: index("project_documents_type_idx").on(table.type),
  }),
);

export const financeDecisions = mysqlTable(
  "finance_decisions",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    opportunityId: varchar("opportunity_id", { length: 191 })
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    decision: mysqlEnum("decision", financeDecisionValues).notNull(),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    rawRecord: json("raw_record").$type<FinanceDecisionRecord | null>(),
  },
  (table) => ({
    opportunityIdx: index("finance_decisions_opportunity_idx").on(table.opportunityId),
  }),
);

export const bcApprovalCertificates = mysqlTable(
  "bc_approval_certificates",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    opportunityId: varchar("opportunity_id", { length: 191 })
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    documentId: varchar("document_id", { length: 191 }).notNull(),
    salesforceOpportunityId: varchar("salesforce_opportunity_id", { length: 191 }).notNull(),
    salesforceUploadStatus: varchar("salesforce_upload_status", { length: 80 }).notNull(),
    distributedTo: json("distributed_to").$type<CertificateDistributionRecipient[]>().notNull(),
    issuedAt: timestamp("issued_at").notNull(),
    rawRecord: json("raw_record").$type<BcApprovalCertificateRecord | null>(),
  },
  (table) => ({
    opportunityIdx: index("bc_approval_certificates_opportunity_idx").on(table.opportunityId),
  }),
);

export type OpportunityInsert = typeof opportunities.$inferInsert;
export type OpportunitySelect = typeof opportunities.$inferSelect;
export type ProjectPersistenceSnapshot = ProjectRecord;
