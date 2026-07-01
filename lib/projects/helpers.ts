import type { ProjectRecord } from "@/lib/project-record-types";
import type { Role } from "@/lib/workflow";

export function isAccountManagerBcPreparationStage(project: ProjectRecord) {
  return (
    project.roleQueue === "Account Manager" &&
    project.state === "Business Case Prepared" &&
    project.decision === "PENDING" &&
    Boolean(project.pboqRequest?.completedAt)
  );
}

export function canEditProject(project: ProjectRecord) {
  if (
    project.roleQueue === "Fiber Planning Team" ||
    project.roleQueue === "Wireless Planning Team"
  ) {
    return false;
  }

  if (isAccountManagerBcPreparationStage(project)) {
    return false;
  }

  return true;
}

export function projectDecisionStatus(project: Pick<ProjectRecord, "decision">) {
  return project.decision === "PENDING" ? "Pending" : "Done";
}

export function hasPboqDocumentAttachment(project: ProjectRecord) {
  return project.documents.some(
    (document) => document.type === "PBOQ" || document.type === "ACTUAL_SURVEY_QUOTE",
  );
}

export function isFibreReadyOpportunity(project: ProjectRecord) {
  return (
    project.pboqRequest?.technology === "Fibre Ready" ||
    project.pboqRequest?.costSource === "FIBRE_READY"
  );
}

export function planningRoleForProject(project: ProjectRecord): Role | null {
  const technology = project.pboqRequest?.technology;

  if (technology === "Fibre Entry") {
    return "Fiber Planning Team";
  }

  if (technology === "Wireless") {
    return "Wireless Planning Team";
  }

  return null;
}

export function projectBelongsToRole(project: ProjectRecord, role: Role) {
  const planningRole = planningRoleForProject(project);
  const belongsByRetainedPlanning =
    planningRole === role && Boolean(project.pboqRequest?.completedAt);

  if (project.roleQueue === role) {
    return true;
  }

  return belongsByRetainedPlanning;
}

export function assertSduStage(project: ProjectRecord) {
  if (project.state !== "SDU Validation" || project.roleQueue !== "SDU") {
    throw new Error("SDU validation is only allowed for SDU queue projects.");
  }
}

export function surveyCostDeviationPercent(
  baselineSurveyCost: number,
  actualSurveyCost: number,
) {
  if (baselineSurveyCost === 0) {
    return actualSurveyCost === 0 ? 0 : 100;
  }

  return Number(
    (Math.abs(actualSurveyCost - baselineSurveyCost) / baselineSurveyCost * 100).toFixed(1),
  );
}
