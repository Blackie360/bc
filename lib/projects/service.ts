import "server-only";

import {
  localCreateBcDraft,
  localCreateBcSubmission,
  localPrepareBusinessCaseFromPboq,
  savePreparedBcDraft,
} from "@/lib/projects/operations/bc";
import {
  localCreateProject,
  localDeleteProject,
  localGetProject,
  localListProjects,
  localUpdateProject,
} from "@/lib/projects/operations/crud";
import { localDecideFinanceWorkflow } from "@/lib/projects/operations/finance";
import {
  localCompleteFiberPlanning,
  localCreatePboqRequest,
} from "@/lib/projects/operations/pboq";
import {
  localConfirmSalesOperationsOrder,
  localReportSalesOperationsDiscrepancy,
} from "@/lib/projects/operations/sales-ops";
import {
  localConfirmSduAlignment,
  localReportSduAlignmentMismatch,
  localSubmitSduSurveyCost,
} from "@/lib/projects/operations/sdu";
import { localAdvanceProjectToNextStage } from "@/lib/projects/operations/workflow";
import type {
  BcDraftInput,
  BcSubmissionInput,
  FiberPlanningInput,
  PreparedBcInput,
  ProjectInput,
  PboqRequestInput,
  WirelessPlanningInput,
} from "@/lib/projects/schemas";
import type {
  FinanceDecisionInput,
  SalesOperationsDiscrepancyInput,
  SduAlignmentMismatchInput,
  SduSurveyCostInput,
} from "@/lib/projects/types";

export async function createPboqRequest(input: PboqRequestInput) {
  return localCreatePboqRequest(input);
}

export async function completeFiberPlanning(id: string, input: FiberPlanningInput) {
  return localCompleteFiberPlanning(id, input);
}

export async function completeWirelessPlanning(id: string, input: WirelessPlanningInput) {
  return localCompleteFiberPlanning(id, input);
}

export async function prepareBusinessCaseFromPboq(id: string, input: PreparedBcInput) {
  return localPrepareBusinessCaseFromPboq(id, input);
}

export async function createBcSubmission(input: BcSubmissionInput) {
  return localCreateBcSubmission(input);
}

export async function createBcDraft(input: BcDraftInput) {
  return localCreateBcDraft(input);
}

export { savePreparedBcDraft };

export async function listProjects() {
  return localListProjects();
}

export async function listProjectsForPage() {
  try {
    return {
      projects: await listProjects(),
      dataUnavailable: false,
    };
  } catch (error) {
    console.error("Failed to load projects from local storage.", error);

    return {
      projects: [],
      dataUnavailable: true,
    };
  }
}

export async function getProject(id: string) {
  return localGetProject(id);
}

export async function createProject(input: ProjectInput) {
  return localCreateProject(input);
}

export async function updateProject(id: string, input: ProjectInput) {
  return localUpdateProject(id, input);
}

export async function decideFinanceWorkflow(id: string, input: FinanceDecisionInput) {
  return localDecideFinanceWorkflow(id, input);
}

export async function confirmSalesOperationsOrder(id: string) {
  return localConfirmSalesOperationsOrder(id);
}

export async function reportSalesOperationsDiscrepancy(
  id: string,
  input: SalesOperationsDiscrepancyInput,
) {
  return localReportSalesOperationsDiscrepancy(id, input);
}

export async function confirmSduAlignment(id: string) {
  return localConfirmSduAlignment(id);
}

export async function reportSduAlignmentMismatch(
  id: string,
  input: SduAlignmentMismatchInput,
) {
  return localReportSduAlignmentMismatch(id, input);
}

export async function submitSduSurveyCost(id: string, input: SduSurveyCostInput) {
  return localSubmitSduSurveyCost(id, input);
}

export async function advanceProjectToNextStage(id: string) {
  return localAdvanceProjectToNextStage(id);
}

export async function deleteProject(id: string) {
  await localDeleteProject(id);
}
