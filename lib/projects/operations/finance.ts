import "server-only";

import type { ProjectRecord } from "@/lib/project-record-types";
import { issueBcApprovalCertificate } from "@/lib/projects/certificate";
import {
  localFinanceDecisionRecord,
  localFinanceRoute,
} from "@/lib/projects/routing";
import type { FinanceDecisionInput } from "@/lib/projects/types";
import { updateLocalProjects } from "@/lib/projects/storage";

export async function localDecideFinanceWorkflow(id: string, input: FinanceDecisionInput) {
  let updatedProject: ProjectRecord | undefined;
  const financeDecision = localFinanceDecisionRecord(input);

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      const route = localFinanceRoute(project, input.decision);
      const decidedProject = {
        ...project,
        state: route.state,
        roleQueue: route.role,
        financeDecisions: [...(project.financeDecisions ?? []), financeDecision],
        updatedAt: new Date().toISOString(),
      };
      updatedProject =
        input.decision === "approve"
          ? issueBcApprovalCertificate(decidedProject, financeDecision.createdAt)
          : decidedProject;

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}
