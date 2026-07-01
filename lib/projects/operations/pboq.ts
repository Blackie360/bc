import "server-only";

import type { ProjectDocumentRecord, ProjectRecord } from "@/lib/project-record-types";
import {
  assertFiberPlanningLineCount,
  deriveProjectCapacity,
  deriveProjectRequiredService,
} from "@/lib/projects/derive";
import { createId } from "@/lib/projects/ids";
import { mapKickoffLinksToCostLineRecords } from "@/lib/projects/mappers";
import { localDocument, createLocalProjectRecord } from "@/lib/projects/record-factory";
import {
  type FiberPlanningInput,
  type PboqRequestInput,
  fiberPlanningInputSchema,
  pboqRequestInputSchema,
} from "@/lib/projects/schemas";
import {
  readLocalProjects,
  updateLocalProjects,
  writeLocalProjects,
} from "@/lib/projects/storage";

export async function localCreatePboqRequest(input: PboqRequestInput) {
  const validated = pboqRequestInputSchema.parse(input);
  const projects = await readLocalProjects();

  if (projects.some((project) => project.id === validated.opportunityNumber)) {
    throw new Error("Opportunity number already exists.");
  }

  const now = new Date().toISOString();
  const hasExistingPboq = validated.pboqMode === "existing";
  const isFibreReady = validated.technology === "Fibre Ready";
  const kickoffCostLines = mapKickoffLinksToCostLineRecords(validated.links);
  const pboqDocument = validated.pboqAttachment
    ? localDocument(validated.pboqAttachment, now)
    : undefined;
  const project = createLocalProjectRecord(
    {
      customer: validated.customerName,
      title: validated.siteName,
      region: validated.region,
      owner: validated.accountManagerName,
      state: "Opportunity Created",
      roleQueue: "Account Manager",
      type: "Ordinary BC",
      irr: 0,
      payback: 36,
      capex: 0,
      subsidy: 0,
      approvedBudget: validated.surveyAvailable ? validated.actualSurveyCost : 0,
      actualSpend: 0,
      surveyDeviation: 0,
      due: "Unscheduled",
    },
    {
      id: validated.opportunityNumber,
      siteName: validated.siteName,
      siteCoordinates: validated.siteCoordinates,
      requiredService: deriveProjectRequiredService(validated.links),
      capacity: deriveProjectCapacity(validated.links),
      salesRequestor: validated.salesRequestor,
      leadNetworkPlanner: validated.leadNetworkPlanner,
      dateRequested: new Date(validated.dateRequested).toISOString(),
      designPlanDate: new Date(validated.designPlanDate).toISOString(),
      opportunityMrr: validated.mrr,
      opportunityNrr: validated.nrr,
      contractTermMonths: validated.contractTermMonths,
      totalMrr: validated.mrr,
      totalNrr: validated.nrr,
      decision: "PENDING",
      documents: pboqDocument ? [pboqDocument] : [],
      pboqRequest: {
        id: createId(),
        technology: validated.technology,
        siteCount: validated.links.length,
        routeDistanceKm: validated.routeDistanceKm,
        surveyBudget: validated.surveyAvailable ? validated.actualSurveyCost : 0,
        surveyAvailable: validated.surveyAvailable,
        costSource: isFibreReady
          ? "FIBRE_READY"
          : validated.surveyAvailable
            ? "ACTUAL_SURVEY"
            : "PBOQ_ESTIMATE",
        actualSurveyCost: validated.actualSurveyCost,
        notes: validated.notes || null,
        fiberPlanningNotes: null,
        completedAt: hasExistingPboq || isFibreReady ? now : null,
        costLines: kickoffCostLines,
      },
    },
  );

  await writeLocalProjects([project, ...projects]);
  return project;
}

export async function localCompleteFiberPlanning(id: string, input: FiberPlanningInput) {
  const validated = fiberPlanningInputSchema.parse(input);
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      if (!project.pboqRequest) throw new Error("Project has no PBOQ request.");
      if (
        project.state !== "PBOQ Request Submitted" &&
        project.state !== "Fiber Planning Generates Costs" &&
        project.state !== "Wireless Planning Generates Costs" &&
        project.state !== "Business Case Prepared"
      ) {
        throw new Error("Project is not in a planning stage.");
      }

      const kickoffLinkCount =
        validated.kickoffLinkCount ?? project.pboqRequest.costLines.length;
      assertFiberPlanningLineCount(kickoffLinkCount, validated.lines.length);

      const now = new Date().toISOString();
      const newDocuments: ProjectDocumentRecord[] = [];
      const pboqDocumentsByLine = validated.lines.map((line) => {
        const existingDocumentId = line.pboqFile.storageKey.startsWith("existing-document:")
          ? line.pboqFile.storageKey.replace("existing-document:", "")
          : null;
        const existingDocument = existingDocumentId
          ? project.documents.find((document) => document.id === existingDocumentId)
          : undefined;

        if (existingDocument) {
          return existingDocument;
        }

        const document = localDocument(line.pboqFile, now);
        newDocuments.push(document);
        return document;
      });
      const costLines = validated.lines.map((line, index) => ({
        id: project.pboqRequest?.costLines[index]?.id ?? createId(),
        linkName: line.linkName,
        siteCoordinates: line.siteCoordinates?.trim() || undefined,
        material: line.material,
        build: line.build,
        wayleave: line.wayleave,
        pboqDocumentId: pboqDocumentsByLine[index]?.id ?? null,
        notes: line.notes || null,
      }));
      const primarySiteCoordinates =
        costLines.find((line) => line.siteCoordinates)?.siteCoordinates ??
        project.siteCoordinates;
      const totalCost = costLines.reduce(
        (total, line) => total + line.material + line.build + line.wayleave,
        0,
      );

      updatedProject = {
        ...project,
        siteCoordinates: primarySiteCoordinates,
        state: "Business Case Prepared",
        roleQueue: "Account Manager",
        capex: totalCost,
        approvedBudget: totalCost,
        pboqRequest: {
          ...project.pboqRequest,
          surveyBudget: totalCost,
          fiberPlanningNotes: validated.fiberPlanningNotes || null,
          completedAt: now,
          costLines,
        },
        documents: [...newDocuments, ...project.documents],
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
