"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserDisplayName } from "@/lib/current-user";
import {
  createBcDraft,
  createBcSubmission,
  createPboqRequest,
  createProject,
  advanceProjectToNextStage,
  completeFiberPlanning,
  decideFinanceWorkflow,
  deleteProject,
  getProject,
  prepareBusinessCaseFromPboq,
  type BcDraftInput,
  type BcSubmissionInput,
  type FiberPlanningInput,
  type FinanceDecision,
  type PboqRequestInput,
  type PreparedBcInput,
  projectInputSchema,
  updateProject,
} from "@/lib/projects";
import { roleSlug, type Role } from "@/lib/workflow";

function parseProjectForm(formData: FormData) {
  return projectInputSchema.parse(Object.fromEntries(formData));
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
  const project = await createProject(parseProjectForm(formData));
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&saved=project`);
}

export async function createPboqRequestAction(formData: FormData) {
  const accountManagerName = await getCurrentUserDisplayName();
  await createPboqRequest({
    ...parsePboqRequestForm(formData),
    accountManagerName,
  });

  revalidateProjectViews();
  redirect(`${accountManagerProjectsHref}&submitted=pboq`);
}

export async function completeFiberPlanningAction(id: string, formData: FormData) {
  const existingProject = await getProject(id);
  const isFiberPlanningStage =
    existingProject?.roleQueue === "Fiber Planning Team" &&
    (existingProject.state === "PBOQ Request Submitted" ||
      existingProject.state === "Fiber Planning Generates Costs");
  if (!existingProject || !isFiberPlanningStage) {
    throw new Error("Fiber Planning submission is only allowed for Fiber Planning queue projects.");
  }

  const project = await completeFiberPlanning(id, parseFiberPlanningForm(formData));

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&submitted=fiber`);
}

export async function prepareBusinessCaseFromPboqAction(id: string, formData: FormData) {
  const project = await prepareBusinessCaseFromPboq(id, parsePreparedBcForm(formData));

  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&submitted=bc`);
}

export async function createBcSubmissionAction(formData: FormData) {
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
  if (existing.roleQueue === "Fiber Planning Team") {
    throw new Error(
      "Fiber Planning projects cannot be edited from Project Edit. Use the Fiber Planning submission form.",
    );
  }

  const project = await updateProject(id, parseProjectForm(formData));
  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`${projectsHrefForRole(project.roleQueue)}&saved=project`);
}

export async function decideFinanceWorkflowAction(id: string, formData: FormData) {
  const project = await decideFinanceWorkflow(
    id,
    financeDecisionField(formData),
    textField(formData, "notes"),
  );

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

function financeDecisionField(formData: FormData): FinanceDecision {
  const value = textField(formData, "decision");

  if (
    value === "approve" ||
    value === "reject-escalate-cfo" ||
    value === "reject-question-architect" ||
    value === "reject-question-engineer"
  ) {
    return value;
  }

  throw new Error("Finance decision is required.");
}

const linkFieldNames = [
  "linkName",
  "material",
  "labor",
  "wayleave",
  "mrr",
  "mrc",
  "nrc",
  "nrr",
] as const;

type LinkFieldName = (typeof linkFieldNames)[number];
type RawLinkRow = Partial<Record<LinkFieldName, string>>;
const pboqCostLineFieldNames = ["linkName", "material", "build", "wayleave", "notes"] as const;
type PboqCostLineFieldName = (typeof pboqCostLineFieldNames)[number];
type RawPboqCostLineRow = Partial<Record<PboqCostLineFieldName, string>>;

type BcSubmissionFormFields = Omit<BcSubmissionInput, "accountManagerName">;
type BcDraftFormFields = Omit<BcDraftInput, "accountManagerName">;
type PboqRequestFormFields = Omit<PboqRequestInput, "accountManagerName">;

function parsePboqRequestForm(formData: FormData): PboqRequestFormFields {
  const pboqMode = textField(formData, "pboqMode");

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName"),
    siteName: textField(formData, "siteName"),
    siteCoordinates: textField(formData, "siteCoordinates"),
    requiredService: textField(formData, "requiredService") as PboqRequestInput["requiredService"],
    capacity: textField(formData, "capacity"),
    dateRequested: textField(formData, "dateRequested"),
    salesRequestor: textField(formData, "salesRequestor"),
    leadNetworkPlanner: textField(formData, "leadNetworkPlanner"),
    designPlanDate: textField(formData, "designPlanDate") || textField(formData, "dateRequested"),
    region: textField(formData, "region"),
    segment: "Enterprise",
    mrr: Number(textField(formData, "mrr")),
    nrr: Number(textField(formData, "nrr")),
    contractTermMonths: Number(textField(formData, "contractTermMonths")),
    pboqMode: pboqMode === "existing" ? "existing" : "request",
    routeDistanceKm: 0,
    siteCount: 0,
    surveyAvailable: false,
    actualSurveyCost: 0,
    notes: textField(formData, "notes"),
    pboqAttachment: optionalFileAttachment(
      formData,
      "pboqAttachment",
      "PBOQ",
    ),
  };
}

function parseFiberPlanningForm(formData: FormData): FiberPlanningInput {
  const summaryProofFile = optionalFileAttachment(formData, "summaryProofFile", "PBOQ_SUMMARY_PROOF");
  const buildProofFile = optionalFileAttachment(formData, "buildProofFile", "PBOQ_BUILD_PROOF");
  const materialProofFile = optionalFileAttachment(
    formData,
    "materialProofFile",
    "PBOQ_MATERIAL_PROOF",
  );
  const wayleaveProofFile = optionalFileAttachment(
    formData,
    "wayleaveProofFile",
    "PBOQ_WAYLEAVE_PROOF",
  );
  const hasCategoryProofs = Boolean(buildProofFile && materialProofFile && wayleaveProofFile);

  if (!summaryProofFile && !hasCategoryProofs) {
    throw new Error(
      "Attach either one combined summary Excel or all three proof Excels (Build, Material, Wayleave).",
    );
  }

  validateExcelAttachment(summaryProofFile);
  validateExcelAttachment(buildProofFile);
  validateExcelAttachment(materialProofFile);
  validateExcelAttachment(wayleaveProofFile);

  return {
    fiberPlanningNotes: textField(formData, "fiberPlanningNotes"),
    lines: parsePboqCostLines(formData),
    pboqFile: fileAttachment(formData, "pboqFile", "PBOQ"),
    summaryProofFile,
    buildProofFile,
    materialProofFile,
    wayleaveProofFile,
  };
}

function parsePreparedBcForm(formData: FormData): PreparedBcInput {
  return {
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    type: textField(formData, "type") as PreparedBcInput["type"],
    irr: Number(textField(formData, "irr")),
    payback: Number(textField(formData, "payback")),
    capex: Number(textField(formData, "capex")),
    subsidy: Number(textField(formData, "subsidy")),
    approvedBudget: Number(textField(formData, "approvedBudget")),
    bcTemplate: fileAttachment(formData, "bcTemplate", "BC_TEMPLATE"),
    orderForm: fileAttachment(formData, "orderForm", "ORDER_FORM"),
  };
}

function parsePboqCostLines(formData: FormData): FiberPlanningInput["lines"] {
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
  const pboqAttachment = fileAttachment(formData, "pboqFile", "PBOQ");
  const attachments: BcSubmissionInput["attachments"] = [
    fileAttachment(formData, "bcTemplate", "BC_TEMPLATE"),
    pboqAttachment,
    fileAttachment(formData, "orderForm", "ORDER_FORM"),
  ];
  const links = parseLinks(formData, attachments);

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName"),
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    region: textField(formData, "region") || "Unassigned",
    type: textField(formData, "type") as BcSubmissionInput["type"],
    irr: Number(textField(formData, "irr")),
    payback: Number(textField(formData, "payback")),
    capex: Number(textField(formData, "capex")),
    subsidy: Number(textField(formData, "subsidy")),
    approvedBudget: Number(textField(formData, "approvedBudget")),
    links,
    attachments,
  };
}

function parseBcDraftForm(formData: FormData): BcDraftFormFields {
  const attachments: BcDraftInput["attachments"] = [];
  const mainAttachments = [
    optionalFileAttachment(formData, "bcTemplate", "BC_TEMPLATE"),
    optionalFileAttachment(formData, "pboqFile", "PBOQ"),
    optionalFileAttachment(formData, "orderForm", "ORDER_FORM"),
  ];
  for (const attachment of mainAttachments) {
    if (attachment) attachments.push(attachment);
  }
  const links = parseLinks(formData, attachments, true);

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName"),
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    region: textField(formData, "region"),
    type: textField(formData, "type") as BcDraftInput["type"],
    irr: numberField(formData, "irr"),
    payback: numberField(formData, "payback"),
    capex: numberField(formData, "capex"),
    subsidy: numberField(formData, "subsidy"),
    approvedBudget: numberField(formData, "approvedBudget"),
    links,
    attachments,
  };
}

function parseLinks(
  formData: FormData,
  attachments: Array<BcSubmissionInput["attachments"][number]>,
  allowPartialRows = false,
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
      if (allowPartialRows) {
        const optionalEvidence = optionalFileAttachment(
          formData,
          `linkEvidence-${index}`,
          "ACTUAL_SURVEY_QUOTE",
        );
        const evidenceAttachmentIndex = optionalEvidence ? attachments.length : -1;

        if (optionalEvidence) {
          attachments.push(optionalEvidence);
        }

        return {
          linkName: row.linkName ?? `Draft link ${index + 1}`,
          material: numberOrZero(row.material),
          labor: numberOrZero(row.labor),
          wayleave: numberOrZero(row.wayleave),
          mrr: numberOrZero(row.mrr),
          mrc: numberOrZero(row.mrc),
          nrc: numberOrZero(row.nrc),
          nrr: numberOrZero(row.nrr),
          evidenceAttachmentIndex,
        };
      }

      const hasCorePricing = hasLinkPricing(row);
      const evidenceAttachmentIndex = attachments.length;

      if (hasCorePricing) {
        attachments.push(
          fileAttachment(
            formData,
            `linkEvidence-${index}`,
            "ACTUAL_SURVEY_QUOTE",
            "Actual survey quote is required when link pricing is submitted.",
          ),
        );
      }

      return {
        linkName: row.linkName ?? "",
        material: Number(row.material),
        labor: Number(row.labor),
        wayleave: Number(row.wayleave),
        mrr: Number(row.mrr),
        mrc: Number(row.mrc),
        nrc: Number(row.nrc),
        nrr: Number(row.nrr),
        evidenceAttachmentIndex,
      };
    });
}

function hasLinkPricing(row: RawLinkRow) {
  const requiredFields = [
    "linkName",
    "material",
    "labor",
    "wayleave",
    "mrr",
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
      "Link Name, Material, Labor, Wayleave, and MRR must be completed together.",
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

function validateExcelAttachment(attachment: ReturnType<typeof optionalFileAttachment>) {
  if (!attachment) return;

  const loweredName = attachment.name.toLowerCase();
  const isExcelName = loweredName.endsWith(".xlsx") || loweredName.endsWith(".xls");
  if (!isExcelName) {
    throw new Error("Proof attachments must be Excel files (.xls or .xlsx).");
  }
}

function submissionIntent(formData: FormData) {
  return textField(formData, "intent") === "draft" ? "draft" : "submit";
}
