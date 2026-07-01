import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { PboqCostLineRecord } from "@/lib/pboq-kickoff-links";
import type {
  LinkCostSource,
  LinkOnnetOffnet,
  ProjectRecordRequiredService,
} from "@/lib/projects-types";
import type {
  BusinessCaseType,
  DecisionOutput,
  Role,
  WorkflowState,
} from "@/lib/workflow";

export type ProjectInput = {
  customer: string;
  title: string;
  region: string;
  owner: string;
  state: WorkflowState;
  roleQueue: Role;
  type: BusinessCaseType;
  irr: number;
  payback: number;
  capex: number;
  subsidy: number;
  approvedBudget: number;
  actualSpend: number;
  surveyDeviation: number;
  due: string;
};

export type ProjectLinkRecord = {
  id: string;
  linkName: string;
  service: string;
  technology: string;
  onnetOffnet: LinkOnnetOffnet | null;
  costSource: LinkCostSource | null;
  newBuildCost: number;
  provisioningCost: number;
  materialCost: number;
  wayleaveCost: number;
  mrr: number;
  mrc: number;
  nrc: number;
  nrr: number;
  nrv: number;
  tcv: number;
  onnetCapacity: string | null;
  offnetCapacity: string | null;
  providerName: string | null;
  evidenceDocumentId: string | null;
  supplierQuoteDocumentId: string | null;
};

export type ProjectDocumentRecord = {
  id: string;
  type: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type CertificateDistributionRecipient =
  | "Sales Operations"
  | "Account Manager"
  | "Designated SDU Officer"
  | "Full SDU Team";

export type BcApprovalCertificateRecord = {
  id: string;
  documentId: string;
  salesforceOpportunityId: string;
  salesforceUploadStatus: "uploaded";
  distributedTo: CertificateDistributionRecipient[];
  issuedAt: string;
};

export type PboqRequestRecord = {
  id: string;
  technology?: "Fibre Ready" | "Fibre Entry" | "Wireless";
  siteCount: number;
  routeDistanceKm: number;
  surveyBudget: number;
  surveyAvailable: boolean;
  costSource: "ACTUAL_SURVEY" | "PBOQ_ESTIMATE" | "FIBRE_READY";
  actualSurveyCost: number;
  notes: string | null;
  fiberPlanningNotes: string | null;
  completedAt: string | null;
  costLines: PboqCostLineRecord[];
  bcPreparationDraft?: PreparedBcDraft | null;
};

export type FinanceDecisionRecord = {
  id: string;
  decision:
    | "approve"
    | "reject"
    | "escalate-cfo"
    | "escallate-ceo"
    | "question-architect"
    | "sales-ops-discrepancy"
    | "sdu-alignment-mismatch"
    | "sdu-survey-variance";
  notes: string;
  createdAt: string;
};
export type ProjectRecord = ProjectInput & {
  id: string;
  siteName: string;
  siteCoordinates: string;
  requiredService: ProjectRecordRequiredService;
  capacity: string;
  salesRequestor: string;
  leadNetworkPlanner: string;
  accountManagerName: string;
  dateRequested: string;
  designPlanDate: string | null;
  accountNumber: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  projectExecutiveSummary: string;
  opportunityMrr: number;
  opportunityNrr: number;
  contractTermMonths: number;
  exchangeRateKesUsd: number;
  pboqRequest?: PboqRequestRecord;
  links: ProjectLinkRecord[];
  documents: ProjectDocumentRecord[];
  totalMrr: number;
  totalMrc: number;
  totalNrc: number;
  totalNrr: number;
  nrv?: number;
  tcv?: number;
  decision: DecisionOutput | "PENDING";
  financeDecisions?: FinanceDecisionRecord[];
  certificateIssued: boolean;
  certificate?: BcApprovalCertificateRecord | null;
  variance: number;
  revisions: number;
  createdAt: string;
  updatedAt: string;
};
