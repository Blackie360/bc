import { z } from "zod";
import {
  normalizeLinkOnnetOffnet,
  linkCostSourceValues,
  linkOnnetOffnetValues,
  projectServiceTypeValues,
} from "@/lib/projects-types";

export const LIFECYCLE_STORAGE_VERSION = 1 as const;

export const lifecycleDraftScopes = {
  pboqRequest: "draft:pboq-request",
  bcSubmission: "draft:bc-submission",
} as const;

export type LifecycleDraftScope =
  (typeof lifecycleDraftScopes)[keyof typeof lifecycleDraftScopes];

export const lifecycleStages = [
  "pboqRequest",
  "fiberPlanning",
  "bcPreparation",
  "bcSubmission",
  "projectEdit",
  "financeDecision",
] as const;

export type LifecycleStage = (typeof lifecycleStages)[number];

const attachmentMetadataSchema = z.object({
  name: z.string(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
});
const attachmentMetadataListSchema = z.array(attachmentMetadataSchema);

export const pboqKickoffLinkDraftSchema = z.object({
  linkName: z.string().optional(),
  region: z.string().optional(),
  siteCoordinates: z.string().optional(),
  buildingName: z.string().optional(),
  service: z.enum(projectServiceTypeValues).optional(),
  capacity: z.string().optional(),
});

export const pboqRequestDraftSchema = z.object({
  savedAt: z.string(),
  opportunityNumber: z.string().optional(),
  dateRequested: z.string().optional(),
  customerName: z.string().optional(),
  mrr: z.string().optional(),
  nrr: z.string().optional(),
  contractTermMonths: z.string().optional(),
  siteName: z.string().optional(),
  siteCoordinates: z.string().optional(),
  requiredService: z.enum(projectServiceTypeValues).optional(),
  capacity: z.string().optional(),
  leadNetworkPlanner: z.string().optional(),
  region: z.string().optional(),
  links: z.array(pboqKickoffLinkDraftSchema).optional(),
});

export const fiberPlanningLineDraftSchema = z.object({
  linkName: z.string().optional(),
  siteCoordinates: z.string().optional(),
  material: z.string().optional(),
  build: z.string().optional(),
  wayleave: z.string().optional(),
  notes: z.string().optional(),
  pboqFile: attachmentMetadataSchema.optional(),
});

export const fiberPlanningDraftSchema = z.object({
  savedAt: z.string(),
  fiberPlanningNotes: z.string().optional(),
  lines: z.array(fiberPlanningLineDraftSchema).optional(),
});

export const preparedBcDraftLinkSchema = z.object({
  linkName: z.string().optional(),
  service: z.string().optional(),
  technology: z.string().optional(),
  onnetOffnet: z
    .preprocess(
      (value) => normalizeLinkOnnetOffnet(typeof value === "string" ? value : undefined),
      z.enum(linkOnnetOffnetValues),
    )
    .optional(),
  costSource: z.enum(linkCostSourceValues).optional(),
  onnetCapacity: z.string().optional(),
  offnetCapacity: z.string().optional(),
  providerName: z.string().optional(),
  newBuildCost: z.string().optional(),
  provisioningCost: z.string().optional(),
  materialCost: z.string().optional(),
  wayleaveCost: z.string().optional(),
  mrc: z.string().optional(),
  mrr: z.string().optional(),
  nrr: z.string().optional(),
  nrv: z.string().optional(),
  tcv: z.string().optional(),
});

export const preparedBcOtherExpenseDraftSchema = z.object({
  label: z.string().optional(),
  monthlyCost: z.string().optional(),
});

export const preparedBcDraftSchema = z.object({
  savedAt: z.string(),
  activeTab: z.enum(["details", "links", "metrics"]).optional(),
  accountNumber: z.string().optional(),
  solutionArchitectureName: z.string().optional(),
  solutionEngineerName: z.string().optional(),
  contractTermMonths: z.coerce.number().int().positive().optional(),
  projectExecutiveSummary: z.string().optional(),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]).optional(),
  pboqOrSurveyType: z.enum(["PBOQ", "ACTUAL_SURVEY"]).optional(),
  irr: z.coerce.number().optional(),
  payback: z.coerce.number().int().positive().optional(),
  capex: z.coerce.number().nonnegative().optional(),
  subsidy: z.coerce.number().nonnegative().optional(),
  approvedBudget: z.coerce.number().nonnegative().optional(),
  nrv: z.coerce.number().optional(),
  tcv: z.coerce.number().nonnegative().optional(),
  exchangeRateKesUsd: z.coerce.number().positive().optional(),
  links: z.array(preparedBcDraftLinkSchema).optional(),
  otherExpenses: z.array(preparedBcOtherExpenseDraftSchema).optional(),
  lsoAttachment: attachmentMetadataSchema.optional(),
  bcTemplate: attachmentMetadataSchema.optional(),
  bcTemplates: attachmentMetadataListSchema.optional(),
  pboqOrSurveyAttachment: attachmentMetadataSchema.optional(),
  thirdPartyQuotesAttachment: attachmentMetadataSchema.optional(),
  linkEvidenceAttachments: z.array(attachmentMetadataSchema).optional(),
  linkSupplierQuoteAttachments: z.array(attachmentMetadataSchema).optional(),
});

export const bcSubmissionLinkDraftSchema = preparedBcDraftLinkSchema.extend({
  nrc: z.string().optional(),
});

export const bcSubmissionDraftSchema = z.object({
  savedAt: z.string(),
  opportunityNumber: z.string().optional(),
  customerName: z.string().optional(),
  accountNumber: z.string().optional(),
  solutionArchitectureName: z.string().optional(),
  solutionEngineerName: z.string().optional(),
  contractTermMonths: z.string().optional(),
  region: z.string().optional(),
  projectExecutiveSummary: z.string().optional(),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]).optional(),
  pboqOrSurveyType: z.enum(["PBOQ", "ACTUAL_SURVEY"]).optional(),
  irr: z.string().optional(),
  payback: z.string().optional(),
  capex: z.string().optional(),
  subsidy: z.string().optional(),
  approvedBudget: z.string().optional(),
  nrv: z.string().optional(),
  tcv: z.string().optional(),
  exchangeRateKesUsd: z.string().optional(),
  links: z.array(bcSubmissionLinkDraftSchema).optional(),
  lsoAttachment: attachmentMetadataSchema.optional(),
  bcTemplate: attachmentMetadataSchema.optional(),
  pboqOrSurveyAttachment: attachmentMetadataSchema.optional(),
  thirdPartyQuotesAttachment: attachmentMetadataSchema.optional(),
  linkEvidenceAttachments: z.array(attachmentMetadataSchema).optional(),
  linkSupplierQuoteAttachments: z.array(attachmentMetadataSchema).optional(),
});

export const projectEditDraftSchema = z.object({
  savedAt: z.string(),
  customer: z.string().optional(),
  region: z.string().optional(),
  title: z.string().optional(),
  owner: z.string().optional(),
  state: z.string().optional(),
  roleQueue: z.string().optional(),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]).optional(),
  due: z.string().optional(),
  irr: z.string().optional(),
  payback: z.string().optional(),
  capex: z.string().optional(),
  subsidy: z.string().optional(),
  approvedBudget: z.string().optional(),
  actualSpend: z.string().optional(),
  surveyDeviation: z.string().optional(),
});

export const financeDecisionDraftSchema = z.object({
  savedAt: z.string(),
  notesByDecision: z.record(z.string(), z.string()).optional(),
});

const lifecycleStagesSchema = z.object({
  pboqRequest: pboqRequestDraftSchema.optional(),
  fiberPlanning: fiberPlanningDraftSchema.optional(),
  bcPreparation: preparedBcDraftSchema.optional(),
  bcSubmission: bcSubmissionDraftSchema.optional(),
  projectEdit: projectEditDraftSchema.optional(),
  financeDecision: financeDecisionDraftSchema.optional(),
});

export const projectLifecycleSchema = z.object({
  version: z.literal(LIFECYCLE_STORAGE_VERSION),
  updatedAt: z.string(),
  stages: lifecycleStagesSchema,
});

export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>;
export type PboqRequestDraft = z.infer<typeof pboqRequestDraftSchema>;
export type FiberPlanningDraft = z.infer<typeof fiberPlanningDraftSchema>;
export type FiberPlanningLineDraft = z.infer<typeof fiberPlanningLineDraftSchema>;
export type PreparedBcDraft = z.infer<typeof preparedBcDraftSchema>;
export type PreparedBcDraftLink = z.infer<typeof preparedBcDraftLinkSchema>;
export type BcSubmissionDraft = z.infer<typeof bcSubmissionDraftSchema>;
export type BcSubmissionLinkDraft = z.infer<typeof bcSubmissionLinkDraftSchema>;
export type ProjectEditDraft = z.infer<typeof projectEditDraftSchema>;
export type FinanceDecisionDraft = z.infer<typeof financeDecisionDraftSchema>;
export type ProjectLifecycle = z.infer<typeof projectLifecycleSchema>;
export type LifecycleStageDraftMap = {
  pboqRequest: PboqRequestDraft;
  fiberPlanning: FiberPlanningDraft;
  bcPreparation: PreparedBcDraft;
  bcSubmission: BcSubmissionDraft;
  projectEdit: ProjectEditDraft;
  financeDecision: FinanceDecisionDraft;
};

const legacyBcPreparationKeyPrefix = "bc-preparation-draft:";

export function lifecycleStorageKey(scope: string) {
  return `project-lifecycle:${scope}`;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function parseLifecycle(raw: string): ProjectLifecycle | null {
  try {
    const parsed = projectLifecycleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parseLegacyBcPreparationDraft(raw: string): PreparedBcDraft | null {
  try {
    const parsed = preparedBcDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function emptyLifecycle(): ProjectLifecycle {
  return {
    version: LIFECYCLE_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    stages: {},
  };
}

export function readProjectLifecycle(scope: string): ProjectLifecycle | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(lifecycleStorageKey(scope));
  if (raw) {
    return parseLifecycle(raw);
  }

  if (!scope.startsWith("draft:")) {
    const legacyRaw = localStorage.getItem(`${legacyBcPreparationKeyPrefix}${scope}`);
    if (legacyRaw) {
      const legacyDraft = parseLegacyBcPreparationDraft(legacyRaw);
      if (legacyDraft) {
        const migrated = mergeProjectLifecycleStage(scope, "bcPreparation", legacyDraft);
        localStorage.removeItem(`${legacyBcPreparationKeyPrefix}${scope}`);
        return migrated;
      }
    }
  }

  return null;
}

export function writeProjectLifecycle(scope: string, lifecycle: ProjectLifecycle) {
  if (!isBrowser()) return;

  localStorage.setItem(
    lifecycleStorageKey(scope),
    JSON.stringify({
      ...lifecycle,
      version: LIFECYCLE_STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function readLifecycleStage<S extends LifecycleStage>(
  scope: string,
  stage: S,
): LifecycleStageDraftMap[S] | null {
  const lifecycle = readProjectLifecycle(scope);
  const draft = lifecycle?.stages[stage];

  if (!draft || typeof draft !== "object" || !("savedAt" in draft)) {
    return null;
  }

  return draft as LifecycleStageDraftMap[S];
}

export function mergeProjectLifecycleStage<S extends LifecycleStage>(
  scope: string,
  stage: S,
  draft: LifecycleStageDraftMap[S],
): ProjectLifecycle {
  const current = readProjectLifecycle(scope) ?? emptyLifecycle();
  const next: ProjectLifecycle = {
    ...current,
    version: LIFECYCLE_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    stages: {
      ...current.stages,
      [stage]: draft,
    },
  };

  writeProjectLifecycle(scope, next);
  return next;
}

export function clearLifecycleStage(scope: string, stage: LifecycleStage) {
  if (!isBrowser()) return;

  const current = readProjectLifecycle(scope);
  if (!current) return;

  const nextStages = { ...current.stages };
  delete nextStages[stage];
  const next: ProjectLifecycle = {
    ...current,
    updatedAt: new Date().toISOString(),
    stages: nextStages,
  };

  if (Object.keys(next.stages).length === 0) {
    localStorage.removeItem(lifecycleStorageKey(scope));
    if (!scope.startsWith("draft:")) {
      localStorage.removeItem(`${legacyBcPreparationKeyPrefix}${scope}`);
    }
    return;
  }

  writeProjectLifecycle(scope, next);

  if (stage === "bcPreparation" && !scope.startsWith("draft:")) {
    localStorage.removeItem(`${legacyBcPreparationKeyPrefix}${scope}`);
  }
}

export function clearProjectLifecycle(scope: string) {
  if (!isBrowser()) return;

  localStorage.removeItem(lifecycleStorageKey(scope));

  if (!scope.startsWith("draft:")) {
    localStorage.removeItem(`${legacyBcPreparationKeyPrefix}${scope}`);
  }
}

export function readFormFieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);

  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLSelectElement ||
    field instanceof HTMLTextAreaElement
  ) {
    return field.value;
  }

  return "";
}

export function readIndexedFormRows<T extends Record<string, string>>(
  form: HTMLFormElement,
  prefix: string,
  fields: readonly (keyof T & string)[],
): T[] {
  const rawRows = new Map<number, Record<string, string>>();
  const pattern = new RegExp(`^${prefix}\\[(\\d+)]\\[(\\w+)]$`);

  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value !== "string") continue;

    const match = key.match(pattern);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2];

    if (!fields.includes(field as keyof T & string)) continue;

    const row = rawRows.get(index) ?? {};
    row[field] = value.trim();
    rawRows.set(index, row);
  }

  return Array.from(rawRows.entries())
    .sort(([left], [right]) => left - right)
    .map(([, row]) => row as T);
}

export function formatDraftSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(savedAt));
}

export function readFileMetadata(input: HTMLInputElement): AttachmentMetadata | undefined {
  const file = input.files?.[0];

  if (!file || file.name.length === 0) {
    return undefined;
  }

  return {
    name: file.name,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
  };
}

export function readFileMetadataList(input: HTMLInputElement): AttachmentMetadata[] | undefined {
  const files = Array.from(input.files ?? []).filter((file) => file.name.length > 0);

  if (files.length === 0) {
    return undefined;
  }

  return files.map((file) => ({
    name: file.name,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
  }));
}
