import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { PboqCostLineRecord } from "@/lib/pboq-kickoff-links";
import type { LinkCostSource, LinkOnnetOffnet } from "@/lib/projects-types";
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
  onnetCapacity: string | null;
  offnetCapacity: string | null;
  evidenceDocumentId: string | null;
};

export type ProjectDocumentRecord = {
  id: string;
  type: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type PboqRequestRecord = {
  id: string;
  siteCount: number;
  routeDistanceKm: number;
  surveyBudget: number;
  surveyAvailable: boolean;
  costSource: "ACTUAL_SURVEY" | "PBOQ_ESTIMATE";
  actualSurveyCost: number;
  notes: string | null;
  fiberPlanningNotes: string | null;
  completedAt: string | null;
  costLines: PboqCostLineRecord[];
  bcPreparationDraft?: PreparedBcDraft | null;
};

export type FinanceDecisionRecord = {
  id: string;
  decision: "approve" | "reject" | "escalate-cfo" | "question-architect";
  notes: string;
  createdAt: string;
};

export type ProjectRecord = ProjectInput & {
  id: string;
  siteName: string;
  siteCoordinates: string;
  requiredService: "EPL" | "DIA" | "DFA" | "Unspecified";
  capacity: string;
  salesRequestor: string;
  leadNetworkPlanner: string;
  dateRequested: string;
  designPlanDate: string | null;
  accountNumber: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  projectExecutiveSummary: string;
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
  financeDecisions?: FinanceDecisionRecord[];
  certificateIssued: boolean;
  variance: number;
  revisions: number;
  createdAt: string;
  updatedAt: string;
};
