"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserDisplayName, getCurrentUserRole } from "@/lib/current-user";
import {
  createBcDraft,
  createBcSubmission,
  createPboqRequest,
  createProject,
  advanceProjectToNextStage,
  completeFiberPlanning,
  completeWirelessPlanning,
  confirmSduAlignment,
  confirmSalesOperationsOrder,
  decideFinanceWorkflow,
  deleteProject,
  getProject,
  prepareBusinessCaseFromPboq,
  reportSalesOperationsDiscrepancy,
  reportSduAlignmentMismatch,
  savePreparedBcDraft,
  preparedBcDraftSchema,
  submitSduSurveyCost,
  type BcDraftInput,
  type BcSubmissionInput,
  type FinanceDecisionInput,
  type FiberPlanningInput,
  type PboqRequestInput,
  type PreparedBcInput,
  type SalesOperationsDiscrepancyInput,
  type SduAlignmentMismatchInput,
  type SduSurveyCostInput,
  projectInputSchema,
  canEditProject,
  updateProject,
} from "@/lib/projects";
import { roleSlug, type Role } from "@/lib/workflow";

function parseProjectForm(formData: FormData) {
  return projectInputSchema.parse(Object.fromEntries(formData));
}

async function assertAccountManagerCanCreateProject() {
  const currentRole = await getCurrentUserRole();
  if (currentRole !== "Account Manager") {
    throw new Error("Only Account Managers can create projects.");
  }
}

function revalidateProjectViews() {
  revalidatePath("/projects");
  revalidatePath("/roles");
}

function projectsHrefForRole(role: Role) {
  return `/projects?role=${roleSlug(role)}`;
}

const accountManagerProjectsHref = projectsHrefForRole("Account Manager");

export async function createProjectAction(formData: FormData) {
  await assertAccountManagerCanCreateProject();
  const project = await createProject(parseProjectForm(formData));
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&saved=project`);
}

export async function createPboqRequestAction(formData: FormData) {
  await assertAccountManagerCanCreateProject();
  const accountManagerName = await getCurrentUserDisplayName();
  const project = await createPboqRequest({
    ...parsePboqRequestForm(formData),
    accountManagerName,
    salesRequestor: accountManagerName,
  });

  revalidateProjectViews();
  redirect(
    `${projectsHrefForRole(project.roleQueue)}&submitted=${
      project.pboqRequest?.costSource === "FIBRE_READY" ? "fibre-ready" : "pboq"
    }`,
  );
}

export async function completeFiberPlanningAction(id: string, formData: FormData) {
  const existingProject = await getProject(id);
  const isPlanningRole =
    existingProject?.roleQueue === "Fiber Planning Team" ||
    existingProject?.roleQueue === "Wireless Planning Team";
  const isPlanningStage =
    isPlanningRole &&
    (existingProject.state === "PBOQ Request Submitted" ||
      existingProject.state === "Fiber Planning Generates Costs" ||
      existingProject.state === "Wireless Planning Generates Costs" ||
      existingProject.state === "Business Case Prepared");
  if (!existingProject || !isPlanningStage) {
    throw new Error("Planning submission is only allowed for planning queue projects.");
  }
  const planningRole = existingProject.roleQueue;

  let planningInput: FiberPlanningInput;
  try {
    planningInput = parseFiberPlanningForm(formData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Planning could not be validated.";
    redirect(`/projects/${encodeURIComponent(id)}?fiberError=${encodeURIComponent(message)}`);
  }

  let project;
  try {
    project =
      planningRole === "Wireless Planning Team"
        ? await completeWirelessPlanning(id, planningInput)
        : await completeFiberPlanning(id, planningInput);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Planning could not be saved.";
    redirect(`/projects/${encodeURIComponent(id)}?fiberError=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(planningRole)}&submitted=planning`);
}

export async function prepareBusinessCaseFromPboqAction(id: string, formData: FormData) {
  const project = await prepareBusinessCaseFromPboq(id, parsePreparedBcForm(formData));

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&submitted=bc`);
}

/** BC preparation drafts are persisted in browser localStorage via project lifecycle storage. */
export async function savePreparedBcDraftAction(id: string, draftJson: string) {
  const draft = preparedBcDraftSchema.parse(JSON.parse(draftJson));
  await savePreparedBcDraft(id, draft);
}

export async function createBcSubmissionAction(formData: FormData) {
  await assertAccountManagerCanCreateProject();
  const accountManagerName = await getCurrentUserDisplayName();
  const intent = submissionIntent(formData);
  if (intent === "draft") {
    await createBcDraft({
      ...parseBcDraftForm(formData),
      accountManagerName,
    });
  } else {
    await createBcSubmission({
      ...parseBcSubmissionForm(formData),
      accountManagerName,
    });
  }
  revalidateProjectViews();
  redirect(
    intent === "draft"
      ? `${accountManagerProjectsHref}&draft=saved`
      : `${accountManagerProjectsHref}&submitted=bc`,
  );
}

export async function updateProjectAction(id: string, formData: FormData) {
  const existing = await getProject(id);
  if (!existing) {
    throw new Error("Project not found.");
  }
  if (!canEditProject(existing)) {
    throw new Error(
      existing.roleQueue === "Fiber Planning Team" ||
        existing.roleQueue === "Wireless Planning Team"
        ? "Planning projects cannot be edited from Project Edit. Use the Planning submission form."
        : "This project cannot be edited while the Account Manager is preparing the business case. Use the BC preparation form.",
    );
  }

  const project = await updateProject(id, parseProjectForm(formData));
  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&saved=project`);
}

export async function decideFinanceWorkflowAction(id: string, formData: FormData) {
  const project = await decideFinanceWorkflow(id, parseFinanceDecisionForm(formData));

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function confirmSalesOperationsOrderAction(id: string) {
  const project = await confirmSalesOperationsOrder(id);

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function reportSalesOperationsDiscrepancyAction(id: string, formData: FormData) {
  const project = await reportSalesOperationsDiscrepancy(
    id,
    parseSalesOperationsDiscrepancyForm(formData),
  );

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function confirmSduAlignmentAction(id: string) {
  const project = await confirmSduAlignment(id);

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function reportSduAlignmentMismatchAction(id: string, formData: FormData) {
  const project = await reportSduAlignmentMismatch(
    id,
    parseSduAlignmentMismatchForm(formData),
  );

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function submitSduSurveyCostAction(id: string, formData: FormData) {
  const project = await submitSduSurveyCost(id, parseSduSurveyCostForm(formData));

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function advanceProjectToNextStageAction(id: string) {
  const project = await advanceProjectToNextStage(id);

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
}

export async function deleteProjectAction(formData: FormData) {
  const id = zString(formData.get("id"));
  const project = await getProject(id);
  await deleteProject(id);
  revalidateProjectViews();
  redirect(project ? projectsHrefForRole(project.roleQueue) : "/projects");
}

function zString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Project id is required.");
  }

  return value;
}

function parseFinanceDecisionForm(formData: FormData): FinanceDecisionInput {
  const value = textField(formData, "decision");
  const notes = textField(formData, "notes").trim();
  if (notes.length < 3) {
    throw new Error("Finance comments are required.");
  }

  if (
    value === "approve" ||
    value === "reject" ||
    value === "escalate-cfo" ||
    value === "question-architect"
  ) {
    return {
      decision: value,
      notes,
    };
  }

  throw new Error("Finance decision is required.");
}

function parseSalesOperationsDiscrepancyForm(
  formData: FormData,
): SalesOperationsDiscrepancyInput {
  const notes = textField(formData, "notes").trim();
  if (notes.length < 3) {
    throw new Error("Discrepancy notes are required.");
  }

  return { notes };
}

function parseSduAlignmentMismatchForm(formData: FormData): SduAlignmentMismatchInput {
  const notes = textField(formData, "notes").trim();
  if (notes.length < 3) {
    throw new Error("SDU mismatch justification is required.");
  }

  return { notes };
}

function parseSduSurveyCostForm(formData: FormData): SduSurveyCostInput {
  return {
    actualSurveyCost: numberOrZero(textField(formData, "actualSurveyCost")),
  };
}

const linkFieldNames = [
  "linkName",
  "service",
  "technology",
  "onnetOffnet",
  "costSource",
  "newBuildCost",
  "provisioningCost",
  "materialCost",
  "wayleaveCost",
  "mrr",
  "mrc",
  "nrc",
  "nrr",
  "nrv",
  "tcv",
  "onnetCapacity",
  "offnetCapacity",
] as const;

type LinkFieldName = (typeof linkFieldNames)[number];
type RawLinkRow = Partial<Record<LinkFieldName, string>>;
const pboqCostLineFieldNames = ["linkName", "material", "build", "wayleave", "notes"] as const;
type PboqCostLineFieldName = (typeof pboqCostLineFieldNames)[number];
type RawPboqCostLineRow = Partial<Record<PboqCostLineFieldName, string>>;
const pboqKickoffLinkFieldNames = [
  "linkName",
  "region",
  "siteCoordinates",
  "buildingName",
  "service",
  "capacity",
] as const;
type PboqKickoffLinkFieldName = (typeof pboqKickoffLinkFieldNames)[number];
type RawPboqKickoffLinkRow = Partial<Record<PboqKickoffLinkFieldName, string>>;

type BcSubmissionFormFields = Omit<BcSubmissionInput, "accountManagerName">;
type BcDraftFormFields = Omit<BcDraftInput, "accountManagerName">;
type PboqRequestFormFields = Omit<PboqRequestInput, "accountManagerName" | "salesRequestor">;

function parsePboqRequestForm(formData: FormData): PboqRequestFormFields {
  const pboqMode = textField(formData, "pboqMode");
  const technology = textField(formData, "technology");
  const links = parsePboqKickoffLinks(formData);
  const mrr = numberOrZero(textField(formData, "mrr"));
  const nrr = numberOrZero(textField(formData, "nrr"));

  if (links.length === 0) {
    throw new Error("Add at least one link before submitting the PBOQ request.");
  }

  const normalizedLinks = links.map((link, index) => {
    const linkName = link.linkName?.trim() ?? "";
    if (!linkName) {
      throw new Error(`Link ${index + 1} requires a link name.`);
    }

    const region = link.region?.trim() ?? "";
    if (region.length < 2) {
      throw new Error(`Link ${index + 1} requires a region.`);
    }

    const siteCoordinates = link.siteCoordinates?.trim() ?? "";
    if (siteCoordinates.length < 2) {
      throw new Error(`Link ${index + 1} requires site coordinates.`);
    }

    const buildingName = link.buildingName?.trim() ?? "";
    if (buildingName.length < 2) {
      throw new Error(`Link ${index + 1} requires a building name.`);
    }

    const capacity = link.capacity?.trim() ?? "";
    if (!capacity) {
      throw new Error(`Link ${index + 1} requires a capacity.`);
    }

    const service = link.service as PboqRequestInput["links"][number]["service"] | undefined;
    if (service !== "EPL" && service !== "DIA" && service !== "DFA") {
      throw new Error(`Link ${index + 1} requires a service.`);
    }

    return {
      linkName,
      region,
      service,
      capacity,
    };
  });
  const primaryLink = links[0];
  const siteName = primaryLink.buildingName?.trim() ?? "";
  const siteCoordinates = primaryLink.siteCoordinates?.trim() ?? "";

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName") || siteName,
    technology: technology as PboqRequestInput["technology"],
    siteName,
    siteCoordinates,
    dateRequested: textField(formData, "dateRequested"),
    leadNetworkPlanner: textField(formData, "leadNetworkPlanner") || "Unassigned",
    designPlanDate: textField(formData, "designPlanDate") || textField(formData, "dateRequested"),
    region: normalizedLinks[0].region,
    segment: "Enterprise",
    mrr,
    nrr,
    contractTermMonths: Number(textField(formData, "contractTermMonths")),
    pboqMode: pboqMode === "existing" ? "existing" : "request",
    routeDistanceKm: 0,
    siteCount: links.length,
    surveyAvailable: false,
    actualSurveyCost: 0,
    notes: textField(formData, "notes"),
    links: normalizedLinks,
    pboqAttachment: optionalFileAttachment(
      formData,
      "pboqAttachment",
      "PBOQ",
    ),
  };
}

function parsePboqKickoffLinks(formData: FormData): RawPboqKickoffLinkRow[] {
  const rawRows = new Map<number, RawPboqKickoffLinkRow>();
  const linkFieldPattern = /^kickoffLinks\[(\d+)]\[(\w+)]$/;

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    const match = key.match(linkFieldPattern);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2] as PboqKickoffLinkFieldName;

    if (!pboqKickoffLinkFieldNames.includes(field)) continue;

    rawRows.set(index, {
      ...rawRows.get(index),
      [field]: value.trim(),
    });
  }

  return Array.from(rawRows.entries())
    .sort(([left], [right]) => left - right)
    .filter(([, row]) => Boolean(row.linkName?.length))
    .map(([, row]) => row);
}

function parseFiberPlanningForm(formData: FormData): FiberPlanningInput {
  const kickoffLinkCountRaw = textField(formData, "kickoffLinkCount");
  const kickoffLinkCount =
    kickoffLinkCountRaw.length > 0 ? Number(kickoffLinkCountRaw) : undefined;
  const lines = parsePboqCostLines(formData).map((line, index) => ({
    ...line,
    pboqFile:
      optionalFileAttachment(formData, `pboqLines[${index}][pboqFile]`, "PBOQ") ??
      existingPboqAttachment(formData, index, line.linkName),
  }));

  return {
    fiberPlanningNotes: textField(formData, "fiberPlanningNotes"),
    lines,
    kickoffLinkCount:
      kickoffLinkCount != null && Number.isFinite(kickoffLinkCount) && kickoffLinkCount > 0
        ? kickoffLinkCount
        : undefined,
  };
}

function existingPboqAttachment(formData: FormData, index: number, linkName: string) {
  const name = textField(formData, `pboqLines[${index}][existingPboqFileName]`);
  const documentId = textField(formData, `pboqLines[${index}][existingPboqDocumentId]`);
  const mimeType =
    textField(formData, `pboqLines[${index}][existingPboqMimeType]`) ||
    "application/octet-stream";
  const sizeBytes = numberOrZero(textField(formData, `pboqLines[${index}][existingPboqSizeBytes]`));

  if (!name || !documentId || sizeBytes <= 0) {
    throw new Error(`PBOQ file for ${linkName} is required.`);
  }

  return {
    type: "PBOQ" as const,
    name,
    mimeType,
    sizeBytes,
    storageKey: `existing-document:${documentId}`,
  };
}

function parsePreparedBcForm(formData: FormData): PreparedBcInput {
  const linkEvidenceAttachments: PreparedBcInput["linkEvidenceAttachments"] = [];
  const links = parseLinks(formData, linkEvidenceAttachments, false, "PBOQ", true);
  const pboqOrSurveyType = textField(formData, "pboqOrSurveyType");

  return {
    customerName: textField(formData, "customerName"),
    accountNumber: textField(formData, "accountNumber"),
    opportunityNumber: textField(formData, "opportunityNumber"),
    accountManagerName: textField(formData, "accountManagerName"),
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    contractTermMonths: Number(textField(formData, "contractTermMonths")),
    projectExecutiveSummary: textField(formData, "projectExecutiveSummary"),
    type: textField(formData, "type") as PreparedBcInput["type"],
    irr: Number(textField(formData, "irr")),
    payback: Number(textField(formData, "payback")),
    capex: Number(textField(formData, "capex")),
    subsidy: Number(textField(formData, "subsidy")),
    approvedBudget: Number(textField(formData, "approvedBudget")),
    nrv: numberField(formData, "nrv"),
    tcv: numberField(formData, "tcv"),
    exchangeRateKesUsd: Number(textField(formData, "exchangeRateKesUsd")),
    links,
    lsoAttachment: fileAttachment(formData, "lsoAttachment", "LSO"),
    bcTemplates: fileAttachments(formData, "bcTemplate", "BC_TEMPLATE"),
    pboqOrSurveyAttachment: optionalFileAttachment(
      formData,
      "pboqOrSurveyAttachment",
      pboqOrSurveyType === "ACTUAL_SURVEY" ? "ACTUAL_SURVEY_QUOTE" : "PBOQ",
    ),
    thirdPartyQuotesAttachment: optionalFileAttachment(
      formData,
      "thirdPartyQuotesAttachment",
      "CONTRACTOR_QUOTE",
    ),
    linkEvidenceAttachments,
  };
}

function parsePboqCostLines(
  formData: FormData,
): Array<Omit<FiberPlanningInput["lines"][number], "pboqFile">> {
  const rawRows = new Map<number, RawPboqCostLineRow>();
  const lineFieldPattern = /^pboqLines\[(\d+)]\[(\w+)]$/;

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    const match = key.match(lineFieldPattern);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2] as PboqCostLineFieldName;

    if (!pboqCostLineFieldNames.includes(field)) continue;

    rawRows.set(index, {
      ...rawRows.get(index),
      [field]: value.trim(),
    });
  }

  return Array.from(rawRows.entries())
    .sort(([left], [right]) => left - right)
    .filter(([, row]) => Object.values(row).some((value) => value && value.length > 0))
    .map(([index, row]) => ({
      linkName: row.linkName ?? `PBOQ link ${index + 1}`,
      material: numberOrZero(row.material),
      build: numberOrZero(row.build),
      wayleave: numberOrZero(row.wayleave),
      notes: row.notes ?? "",
    }));
}

function parseBcSubmissionForm(formData: FormData): BcSubmissionFormFields {
  const pboqOrSurveyType = textField(formData, "pboqOrSurveyType");
  const attachments: BcSubmissionInput["attachments"] = [
    fileAttachment(formData, "lsoAttachment", "LSO"),
    fileAttachment(formData, "bcTemplate", "BC_TEMPLATE"),
    fileAttachment(
      formData,
      "pboqOrSurveyAttachment",
      pboqOrSurveyType === "ACTUAL_SURVEY" ? "ACTUAL_SURVEY_QUOTE" : "PBOQ",
    ),
  ];
  const thirdPartyQuotes = optionalFileAttachment(
    formData,
    "thirdPartyQuotesAttachment",
    "CONTRACTOR_QUOTE",
  );
  if (thirdPartyQuotes) attachments.push(thirdPartyQuotes);
  const links = parseLinks(formData, attachments);

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName"),
    accountNumber: textField(formData, "accountNumber"),
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    contractTermMonths: Number(textField(formData, "contractTermMonths")),
    projectExecutiveSummary: textField(formData, "projectExecutiveSummary"),
    region: textField(formData, "region") || "Unassigned",
    type: textField(formData, "type") as BcSubmissionInput["type"],
    irr: Number(textField(formData, "irr")),
    payback: Number(textField(formData, "payback")),
    capex: Number(textField(formData, "capex")),
    subsidy: Number(textField(formData, "subsidy")),
    approvedBudget: Number(textField(formData, "approvedBudget")),
    nrv: numberField(formData, "nrv"),
    tcv: numberField(formData, "tcv"),
    exchangeRateKesUsd: Number(textField(formData, "exchangeRateKesUsd")),
    links,
    attachments,
  };
}

function parseBcDraftForm(formData: FormData): BcDraftFormFields {
  const attachments: BcDraftInput["attachments"] = [];
  const mainAttachments = [
    optionalFileAttachment(formData, "lsoAttachment", "LSO"),
    optionalFileAttachment(formData, "bcTemplate", "BC_TEMPLATE"),
    optionalFileAttachment(formData, "pboqOrSurveyAttachment", "PBOQ"),
    optionalFileAttachment(formData, "pboqOrSurveyAttachment", "ACTUAL_SURVEY_QUOTE"),
    optionalFileAttachment(formData, "thirdPartyQuotesAttachment", "CONTRACTOR_QUOTE"),
  ];
  for (const attachment of mainAttachments) {
    if (attachment) attachments.push(attachment);
  }
  const links = parseLinks(formData, attachments, true);

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName"),
    accountNumber: textField(formData, "accountNumber"),
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    contractTermMonths: numberField(formData, "contractTermMonths") || 12,
    projectExecutiveSummary: textField(formData, "projectExecutiveSummary"),
    region: textField(formData, "region"),
    type: textField(formData, "type") as BcDraftInput["type"],
    irr: numberField(formData, "irr"),
    payback: numberField(formData, "payback"),
    capex: numberField(formData, "capex"),
    subsidy: numberField(formData, "subsidy"),
    approvedBudget: numberField(formData, "approvedBudget"),
    nrv: numberField(formData, "nrv"),
    tcv: numberField(formData, "tcv"),
    exchangeRateKesUsd: numberField(formData, "exchangeRateKesUsd"),
    links,
    attachments,
  };
}

function parseLinks(
  formData: FormData,
  attachments: Array<BcSubmissionInput["attachments"][number]>,
  allowPartialRows = false,
  defaultEvidenceType: "PBOQ" | "ACTUAL_SURVEY_QUOTE" | "CONTRACTOR_QUOTE" = "ACTUAL_SURVEY_QUOTE",
  optionalLinkEvidence = false,
) {
  const rawRows = new Map<number, RawLinkRow>();
  const linkFieldPattern = /^links\[(\d+)]\[(\w+)]$/;

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    const match = key.match(linkFieldPattern);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2] as LinkFieldName;

    if (!linkFieldNames.includes(field)) continue;

    rawRows.set(index, {
      ...rawRows.get(index),
      [field]: value.trim(),
    });
  }

  return Array.from(rawRows.entries())
    .sort(([left], [right]) => left - right)
    .filter(([, row]) => Object.values(row).some((value) => value && value.length > 0))
    .map(([index, row]) => {
      const nrcBreakdown = {
        newBuildCost: numberOrZero(row.newBuildCost),
        provisioningCost: numberOrZero(row.provisioningCost),
        materialCost: numberOrZero(row.materialCost),
        wayleaveCost: numberOrZero(row.wayleaveCost),
      };
      const computedNrc =
        nrcBreakdown.newBuildCost +
        nrcBreakdown.provisioningCost +
        nrcBreakdown.materialCost +
        nrcBreakdown.wayleaveCost;
      const parsedNrc = numberOrZero(row.nrc);
      const linkPayload = {
        linkName: row.linkName ?? (allowPartialRows ? `Draft link ${index + 1}` : ""),
        service: row.service ?? (allowPartialRows ? "Unspecified" : ""),
        technology: row.technology ?? (allowPartialRows ? "Unspecified" : ""),
        onnetOffnet: (row.onnetOffnet ?? "Onnet") as BcSubmissionInput["links"][number]["onnetOffnet"],
        costSource: (row.costSource ?? "PBOQ") as BcSubmissionInput["links"][number]["costSource"],
        ...nrcBreakdown,
        mrr: numberOrZero(row.mrr),
        mrc: numberOrZero(row.mrc),
        nrc: parsedNrc > 0 ? parsedNrc : computedNrc,
        nrr: numberOrZero(row.nrr),
        nrv: numberOrZero(row.nrv),
        tcv: numberOrZero(row.tcv),
        onnetCapacity: row.onnetCapacity ?? "",
        offnetCapacity: row.offnetCapacity ?? "",
      };

      if (allowPartialRows) {
        const evidenceType =
          linkPayload.costSource === "3rd Party Quote"
            ? "CONTRACTOR_QUOTE"
            : linkPayload.costSource === "Actual Survey"
              ? "ACTUAL_SURVEY_QUOTE"
              : defaultEvidenceType;
        const optionalEvidence = optionalFileAttachment(
          formData,
          `linkEvidence-${index}`,
          evidenceType,
        );
        if (optionalEvidence) {
          attachments.push(optionalEvidence);
        }

        return {
          ...linkPayload,
          ...(optionalEvidence ? { evidenceAttachmentIndex: attachments.length - 1 } : {}),
        };
      }

      if (!hasLinkPricing(row)) {
        throw new Error("Each link requires name, service, technology, and NRC breakdown fields.");
      }

      const evidenceType =
        linkPayload.costSource === "3rd Party Quote"
          ? "CONTRACTOR_QUOTE"
          : linkPayload.costSource === "Actual Survey"
            ? "ACTUAL_SURVEY_QUOTE"
            : defaultEvidenceType;

      if (optionalLinkEvidence) {
        const optionalEvidence = optionalFileAttachment(
          formData,
          `linkEvidence-${index}`,
          evidenceType,
        );
        if (optionalEvidence) {
          attachments.push(optionalEvidence);
        }

        return {
          ...linkPayload,
          ...(optionalEvidence ? { evidenceAttachmentIndex: attachments.length - 1 } : {}),
        };
      }

      const evidenceAttachmentIndex = attachments.length;
      attachments.push(
        fileAttachment(
          formData,
          `linkEvidence-${index}`,
          evidenceType,
          "Per-link PBOQ, survey, or 3rd party quote evidence is required.",
        ),
      );

      return {
        ...linkPayload,
        evidenceAttachmentIndex,
      };
    });
}

function hasLinkPricing(row: RawLinkRow) {
  const requiredFields = [
    "linkName",
    "service",
    "technology",
    "newBuildCost",
    "provisioningCost",
    "materialCost",
    "wayleaveCost",
  ] satisfies LinkFieldName[];
  const providedFields = requiredFields.filter((field) => {
    const value = row[field];

    return value != null && value.length > 0;
  });

  if (providedFields.length === 0) {
    return false;
  }

  if (providedFields.length !== requiredFields.length) {
    throw new Error(
      "Link Name, Service, Technology, and all NRC breakdown fields must be completed together.",
    );
  }

  return true;
}

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function numberField(formData: FormData, name: string) {
  return numberOrZero(textField(formData, name));
}

function numberOrZero(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type AttachmentType =
  | BcSubmissionInput["attachments"][number]["type"]
  | PreparedBcInput["lsoAttachment"]["type"]
  | "SOLUTION_DESIGN"
  | "BC_APPROVAL_CERTIFICATE"
  | "PBOQ_SUMMARY_PROOF"
  | "PBOQ_BUILD_PROOF"
  | "PBOQ_MATERIAL_PROOF"
  | "PBOQ_WAYLEAVE_PROOF";

function fileAttachment<TType extends AttachmentType>(
  formData: FormData,
  name: string,
  type: TType,
  requiredMessage = `${name} is required.`,
) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0 || value.name.length === 0) {
    throw new Error(requiredMessage);
  }

  return {
    type,
    name: value.name,
    mimeType: value.type || "application/octet-stream",
    sizeBytes: value.size,
    storageKey: `metadata/${randomUUID()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
  };
}

function fileAttachments<TType extends AttachmentType>(
  formData: FormData,
  name: string,
  type: TType,
  requiredMessage = `${name} is required.`,
) {
  const values = formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0 && value.name.length > 0);

  if (values.length === 0) {
    throw new Error(requiredMessage);
  }

  return values.map((value) => ({
    type,
    name: value.name,
    mimeType: value.type || "application/octet-stream",
    sizeBytes: value.size,
    storageKey: `metadata/${randomUUID()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
  }));
}

function optionalFileAttachment<TType extends AttachmentType>(
  formData: FormData,
  name: string,
  type: TType,
) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0 || value.name.length === 0) {
    return undefined;
  }

  return {
    type,
    name: value.name,
    mimeType: value.type || "application/octet-stream",
    sizeBytes: value.size,
    storageKey: `metadata/${randomUUID()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
  };
}

function submissionIntent(formData: FormData) {
  return textField(formData, "intent") === "draft" ? "draft" : "submit";
}
