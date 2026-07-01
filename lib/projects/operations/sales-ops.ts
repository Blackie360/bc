import "server-only";

import type { ProjectRecord } from "@/lib/project-record-types";
import { revokeBcApprovalCertificate } from "@/lib/projects/certificate";
import { localSalesOperationsDiscrepancyRecord } from "@/lib/projects/routing";
import type { SalesOperationsDiscrepancyInput } from "@/lib/projects/types";
import { updateLocalProjects } from "@/lib/projects/storage";

export async function localConfirmSalesOperationsOrder(id: string) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      if (
        project.state !== "Sales Operations Validation" ||
        project.roleQueue !== "Sales Operations"
      ) {
        throw new Error("Sales Operations review is only allowed for Sales Operations queue projects.");
      }

      updatedProject = {
        ...project,
        state: "SDU Validation",
        roleQueue: "SDU",
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

export async function localReportSalesOperationsDiscrepancy(
  id: string,
  input: SalesOperationsDiscrepancyInput,
) {
  let updatedProject: ProjectRecord | undefined;
  const discrepancy = localSalesOperationsDiscrepancyRecord(input);

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      if (
        project.state !== "Sales Operations Validation" ||
        project.roleQueue !== "Sales Operations"
      ) {
        throw new Error("Sales Operations discrepancy is only allowed for Sales Operations queue projects.");
      }

      updatedProject = {
        ...revokeBcApprovalCertificate(project),
        state: "Finance / CFO Approval",
        roleQueue: "BC Analyst / Finance",
        revisions: project.revisions + 1,
        financeDecisions: [...(project.financeDecisions ?? []), discrepancy],
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
