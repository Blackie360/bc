import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectLinkRecord, ProjectRecord } from "@/lib/project-record-types";
import {
  normalizeLinkOnnetOffnet,
  normalizeProjectServiceType,
  normalizeRequiredService,
} from "@/lib/projects-types";

function localProjectStoragePath() {
  return (
    process.env.PROJECT_LOCAL_STORAGE_FILE ??
    path.join(process.cwd(), ".data", "projects.json")
  );
}

function normalizeProjectLink(link: ProjectLinkRecord): ProjectLinkRecord {
  return {
    ...link,
    service: link.service === "DFA" ? "DF" : link.service,
    onnetOffnet: link.onnetOffnet ? normalizeLinkOnnetOffnet(link.onnetOffnet) : null,
    providerName: link.providerName ?? null,
    supplierQuoteDocumentId: link.supplierQuoteDocumentId ?? null,
  };
}

function normalizeProjectRecord(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    requiredService: normalizeRequiredService(project.requiredService),
    links: project.links.map(normalizeProjectLink),
  };
}

export async function readLocalProjects(): Promise<ProjectRecord[]> {
  try {
    const contents = await readFile(localProjectStoragePath(), "utf8");
    const parsed = JSON.parse(contents);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return (parsed as ProjectRecord[]).map(normalizeProjectRecord);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

export async function writeLocalProjects(projects: ProjectRecord[]) {
  const filePath = localProjectStoragePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function updateLocalProjects(
  updater: (projects: ProjectRecord[]) => ProjectRecord[] | Promise<ProjectRecord[]>,
) {
  const projects = await readLocalProjects();
  const updatedProjects = await updater(projects);
  await writeLocalProjects(updatedProjects);
  return updatedProjects;
}
