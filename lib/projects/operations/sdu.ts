import "server-only";

import { z } from "zod";
import type { ProjectRecord } from "@/lib/project-record-types";
import { revokeBcApprovalCertificate } from "@/lib/projects/certificate";
import {
  assertSduStage,
  isFibreReadyOpportunity,
  surveyCostDeviationPercent,
} from "@/lib/projects/helpers";
import {
  localSduAlignmentMismatchRecord,
  localSduSurveyVarianceRecord,
} from "@/lib/projects/routing";
import {
  SURVEY_COST_DEVIATION_THRESHOLD_PERCENT,
  type SduAlignmentMismatchInput,
  type SduSurveyCostInput,
} from "@/lib/projects/types";
import { updateLocalProjects } from "@/lib/projects/storage";

export async function localConfirmSduAlignment(id: string) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      assertSduStage(project);
      if (
        !isFibreReadyOpportunity(project) &&
        !project.pboqRequest?.surveyAvailable &&
        !project.pboqRequest?.actualSurveyCost
      ) {
        throw new Error("Existing survey evidence is required before proceeding to Site Acquisition.");
      }

      updatedProject = {
        ...project,
        state: "Survey & Site Acquisition",
        roleQueue: "Site Acquisition Manager",
        updatedAt: new Date().toISOString(),
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

export async function localReportSduAlignmentMismatch(
  id: string,
  input: SduAlignmentMismatchInput,
) {
  let updatedProject: ProjectRecord | undefined;
  const mismatch = localSduAlignmentMismatchRecord(input);

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      assertSduStage(project);

      updatedProject = {
        ...revokeBcApprovalCertificate(project),
        state: "Finance / CFO Approval",
        roleQueue: "BC Analyst / Finance",
        revisions: project.revisions + 1,
        financeDecisions: [...(project.financeDecisions ?? []), mismatch],
        updatedAt: mismatch.createdAt,
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

export async function localSubmitSduSurveyCost(id: string, input: SduSurveyCostInput) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      assertSduStage(project);
      if (!project.pboqRequest) {
        throw new Error("Survey handling requires a PBOQ request.");
      }

      const actualSurveyCost = z.coerce.number().nonnegative().parse(input.actualSurveyCost);
      const baselineSurveyCost = project.pboqRequest.surveyBudget || project.approvedBudget;
      const deviationPercent = surveyCostDeviationPercent(baselineSurveyCost, actualSurveyCost);
      const now = new Date().toISOString();
      const pboqRequest = {
        ...project.pboqRequest,
        surveyAvailable: true,
        costSource: "ACTUAL_SURVEY" as const,
        actualSurveyCost,
      };

      if (deviationPercent > SURVEY_COST_DEVIATION_THRESHOLD_PERCENT) {
        const variance = localSduSurveyVarianceRecord({
          actualSurveyCost,
          baselineSurveyCost,
          deviationPercent,
        });
        updatedProject = {
          ...revokeBcApprovalCertificate(project),
          state: "Business Case Prepared",
          roleQueue: "Account Manager",
          approvedBudget: actualSurveyCost,
          capex: Math.max(project.capex, actualSurveyCost),
          surveyDeviation: deviationPercent,
          revisions: project.revisions + 1,
          pboqRequest,
          financeDecisions: [...(project.financeDecisions ?? []), variance],
          updatedAt: variance.createdAt,
        };

        return updatedProject;
      }

      updatedProject = {
        ...project,
        state: "Survey & Site Acquisition",
        roleQueue: "Site Acquisition Manager",
        approvedBudget: Math.max(project.approvedBudget, actualSurveyCost),
        surveyDeviation: deviationPercent,
        pboqRequest,
        updatedAt: now,
      };

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}
