export type {
  FinanceDecisionRecord,
  PboqRequestRecord,
  ProjectDocumentRecord,
  ProjectLinkRecord,
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
