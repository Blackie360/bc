import "server-only";

import type { FinanceDecisionRecord, ProjectRecord } from "@/lib/project-record-types";
import { createId } from "@/lib/projects/ids";
import type {
  FinanceDecision,
  FinanceDecisionInput,
  SalesOperationsDiscrepancyInput,
  SduAlignmentMismatchInput,
} from "@/lib/projects/types";
import { shouldRouteSubsidyToSalesOperations } from "@/lib/subsidy-routing";
import type { Role, WorkflowState } from "@/lib/workflow";

export function localRouteForPreparedBusinessCase(subsidyUsd: number): {
  state: WorkflowState;
  role: Role;
  autoApproved: boolean;
} {
  if (shouldRouteSubsidyToSalesOperations(subsidyUsd)) {
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

export function localFinanceRoute(
  project: ProjectRecord,
  decision: FinanceDecision,
): { state: WorkflowState; role: Role } {
  switch (decision) {
    case "approve":
      return { state: "Sales Operations Validation", role: "Sales Operations" };
    case "reject":
      return { state: project.state, role: project.roleQueue };
    case "escalate-cfo":
      return { state: "Finance / CFO Approval", role: "CFO" };
    case "question-architect":
      return { state: "Business Case Prepared", role: "Solutions Architect" };
    default: {
      const exhaustive: never = decision;
      return exhaustive;
    }
  }
}

export function localFinanceDecisionRecord(input: FinanceDecisionInput): FinanceDecisionRecord {
  const notes = input.notes.trim();
  if (notes.length < 3) {
    throw new Error("Finance comments are required.");
  }

  return {
    id: createId(),
    decision: input.decision,
    notes,
    createdAt: new Date().toISOString(),
  };
}

export function localSalesOperationsDiscrepancyRecord(
  input: SalesOperationsDiscrepancyInput,
): FinanceDecisionRecord {
  const notes = input.notes.trim();
  if (notes.length < 3) {
    throw new Error("Discrepancy notes are required.");
  }

  return {
    id: createId(),
    decision: "sales-ops-discrepancy",
    notes,
    createdAt: new Date().toISOString(),
  };
}

export function localSduAlignmentMismatchRecord(
  input: SduAlignmentMismatchInput,
): FinanceDecisionRecord {
  const notes = input.notes.trim();
  if (notes.length < 3) {
    throw new Error("SDU mismatch justification is required.");
  }

  return {
    id: createId(),
    decision: "sdu-alignment-mismatch",
    notes,
    createdAt: new Date().toISOString(),
  };
}

export function localSduSurveyVarianceRecord(input: {
  actualSurveyCost: number;
  baselineSurveyCost: number;
  deviationPercent: number;
}): FinanceDecisionRecord {
  return {
    id: createId(),
    decision: "sdu-survey-variance",
    notes: [
      "Actual survey cost exceeded the SDU variance threshold.",
      `Baseline survey cost: ${input.baselineSurveyCost}`,
      `Actual survey cost: ${input.actualSurveyCost}`,
      `Deviation: ${input.deviationPercent}%`,
    ].join("\n"),
    createdAt: new Date().toISOString(),
  };
}
