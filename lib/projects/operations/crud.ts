import "server-only";

import type { ProjectRecord } from "@/lib/project-record-types";
import type { ProjectInput } from "@/lib/projects/schemas";
import { projectInputSchema } from "@/lib/projects/schemas";
import {
  createLocalProjectRecord,
  updateLocalProjectRecord,
} from "@/lib/projects/record-factory";
import {
  readLocalProjects,
  updateLocalProjects,
} from "@/lib/projects/storage";

export async function localListProjects() {
  return readLocalProjects();
}

export async function localGetProject(id: string) {
  return (await readLocalProjects()).find((project) => project.id === id);
}

export async function localCreateProject(input: ProjectInput) {
  const project = createLocalProjectRecord(projectInputSchema.parse(input));
  await updateLocalProjects((projects) => [project, ...projects]);
  return project;
}

export async function localUpdateProject(id: string, input: ProjectInput) {
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;

      updatedProject = updateLocalProjectRecord(project, projectInputSchema.parse(input));
      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

export async function localDeleteProject(id: string) {
  await updateLocalProjects((projects) => projects.filter((project) => project.id !== id));
}
