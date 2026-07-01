import "server-only";

import type { ProjectRecord } from "@/lib/project-record-types";
import { updateLocalProjects } from "@/lib/projects/storage";
import { workflowTransitions } from "@/lib/workflow";

export async function localAdvanceProjectToNextStage(id: string) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      const transition =
        workflowTransitions.find(
          (item) => item.from === project.state && item.owner === project.roleQueue,
        ) ?? workflowTransitions.find((item) => item.from === project.state);

      if (!transition) {
        throw new Error("Project is already at the final workflow stage.");
      }

      const nextTransition = workflowTransitions.find((item) => item.from === transition.to);
      updatedProject = {
        ...project,
        state: transition.to,
        roleQueue: nextTransition?.owner ?? transition.owner,
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
