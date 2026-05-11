"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBcSubmission,
  createProject,
  deleteProject,
  type BcSubmissionInput,
  projectInputSchema,
  updateProject,
} from "@/lib/projects";

function parseProjectForm(formData: FormData) {
  return projectInputSchema.parse(Object.fromEntries(formData));
}

function revalidateProjectViews() {
  revalidatePath("/projects");
  revalidatePath("/roles");
  revalidatePath("/lifecycle");
}

export async function createProjectAction(formData: FormData) {
  const project = await createProject(parseProjectForm(formData));
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function createBcSubmissionAction(formData: FormData) {
  const project = await createBcSubmission(parseBcSubmissionForm(formData));
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(id: string, formData: FormData) {
  const project = await updateProject(id, parseProjectForm(formData));
  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const id = zString(formData.get("id"));
  await deleteProject(id);
  revalidateProjectViews();
  redirect("/projects");
}

function zString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Project id is required.");
  }

  return value;
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

function parseBcSubmissionForm(formData: FormData): BcSubmissionInput {
  const attachments: BcSubmissionInput["attachments"] = [
    fileAttachment(formData, "bcTemplate", "BC_TEMPLATE"),
    fileAttachment(formData, "pboqFile", "PBOQ"),
    fileAttachment(formData, "orderForm", "ORDER_FORM"),
  ];
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

  const links = Array.from(rawRows.entries())
    .sort(([left], [right]) => left - right)
    .filter(([, row]) => Object.values(row).some((value) => value && value.length > 0))
    .map(([index, row]) => {
      const requiresEvidence =
        Boolean(row.linkName) &&
        Boolean(row.material) &&
        Boolean(row.labor) &&
        Boolean(row.wayleave) &&
        Boolean(row.mrr);
      const evidenceAttachmentIndex = attachments.length;

      if (requiresEvidence) {
        attachments.push(
          fileAttachment(formData, `linkEvidence-${index}`, "ACTUAL_SURVEY_QUOTE"),
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

  return {
    opportunityNumber: textField(formData, "opportunityNumber"),
    customerName: textField(formData, "customerName"),
    solutionArchitectureName: textField(formData, "solutionArchitectureName"),
    solutionEngineerName: textField(formData, "solutionEngineerName"),
    accountManagerName: textField(formData, "accountManagerName"),
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

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function fileAttachment(
  formData: FormData,
  name: string,
  type: BcSubmissionInput["attachments"][number]["type"],
): BcSubmissionInput["attachments"][number] {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0 || value.name.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return {
    type,
    name: value.name,
    mimeType: value.type || "application/octet-stream",
    sizeBytes: value.size,
    storageKey: `metadata/${randomUUID()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
  };
}
