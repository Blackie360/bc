import { z } from "zod";
import { pboqKickoffLinkInputSchema } from "@/lib/pboq-kickoff-links";
import {
  isThirdPartyLink,
  linkCostSourceValues,
  linkOnnetOffnetValues,
  normalizeLinkOnnetOffnet,
} from "@/lib/projects-types";
import { roles, workflowStates, type BusinessCaseType } from "@/lib/workflow";

export const projectInputSchema = z.object({
  customer: z.string().min(2),
  title: z.string().min(3),
  region: z.string().min(2),
  owner: z.string().min(2),
  state: z.enum(workflowStates),
  roleQueue: z.enum(roles),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  actualSpend: z.coerce.number().nonnegative(),
  surveyDeviation: z.coerce.number(),
  due: z.string().min(2),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const bcLinkInputSchema = z
  .object({
    linkName: z.string().min(1),
    service: z.string().min(1),
    technology: z.string().min(1),
    onnetOffnet: z.preprocess(
      (value) => normalizeLinkOnnetOffnet(typeof value === "string" ? value : undefined),
      z.enum(linkOnnetOffnetValues),
    ),
    costSource: z.enum(linkCostSourceValues),
    newBuildCost: z.coerce.number().nonnegative(),
    provisioningCost: z.coerce.number().nonnegative(),
    materialCost: z.coerce.number().nonnegative(),
    wayleaveCost: z.coerce.number().nonnegative(),
    mrr: z.coerce.number().nonnegative(),
    mrc: z.coerce.number().nonnegative(),
    nrc: z.coerce.number().nonnegative(),
    nrr: z.coerce.number(),
    nrv: z.coerce.number().nonnegative().default(0),
    tcv: z.coerce.number().nonnegative().default(0),
    onnetCapacity: z.string().optional(),
    offnetCapacity: z.string().optional(),
    providerName: z.string().optional(),
    evidenceAttachmentIndex: z.number().int().nonnegative().optional(),
    supplierQuoteAttachmentIndex: z.number().int().nonnegative().optional(),
  })
  .superRefine((link, context) => {
    if (!isThirdPartyLink(link.onnetOffnet)) {
      return;
    }

    if (!link.providerName?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provider name is required for 3rd Party links.",
        path: ["providerName"],
      });
    }

    if (!link.offnetCapacity?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "3rd Party capacity is required for Offnet links.",
        path: ["offnetCapacity"],
      });
    }

    if (link.costSource !== "3rd Party Quote") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Offnet links must use 3rd Party Quote as the source.",
        path: ["costSource"],
      });
    }

    if (link.supplierQuoteAttachmentIndex == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Supplier quote is required for Offnet links.",
        path: ["supplierQuoteAttachmentIndex"],
      });
    }

    if (link.mrc <= 0 && link.nrc <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Offnet links require quote pricing (MRC and/or NRC) for calculations.",
        path: ["mrc"],
      });
    }
  });

export const bcSubmissionInputSchema = z.object({
  opportunityNumber: z.string().min(2),
  customerName: z.string().min(2),
  solutionArchitectureName: z.string().min(2),
  solutionEngineerName: z.string().min(2),
  accountManagerName: z.string().min(2),
  region: z.string().min(2).default("Unassigned"),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  nrv: z.coerce.number(),
  tcv: z.coerce.number().nonnegative(),
  exchangeRateKesUsd: z.coerce.number().positive(),
  links: z.array(bcLinkInputSchema).min(1),
  accountNumber: z.string().min(1),
  contractTermMonths: z.coerce.number().int().positive(),
  projectExecutiveSummary: z.string().min(10),
  attachments: z.array(
    z.object({
      type: z.enum([
        "LSO",
        "BC_TEMPLATE",
        "PBOQ",
        "ACTUAL_SURVEY_QUOTE",
        "CONTRACTOR_QUOTE",
        "ORDER_FORM",
      ]),
      name: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      storageKey: z.string().min(1),
    }),
  ),
});

export type BcSubmissionInput = z.infer<typeof bcSubmissionInputSchema>;

export const pboqRequestInputSchema = z
  .object({
    opportunityNumber: z.string().min(2),
    customerName: z.string().min(2),
    technology: z.enum(["Fibre Ready", "Fibre Entry", "Wireless"]),
    siteName: z.string().min(2),
    siteCoordinates: z.string().min(2),
    dateRequested: z.string().min(1),
    salesRequestor: z.string().min(2),
    leadNetworkPlanner: z.string().min(2),
    designPlanDate: z.string().min(1),
    accountManagerName: z.string().min(2),
    region: z.string().min(2),
    segment: z.string().min(2),
    mrr: z.coerce.number().nonnegative(),
    nrr: z.coerce.number().nonnegative(),
    contractTermMonths: z.coerce.number().int().positive(),
    pboqMode: z.enum(["existing", "request"]).default("request"),
    routeDistanceKm: z.coerce.number().nonnegative().default(0),
    siteCount: z.coerce.number().int().nonnegative().default(0),
    surveyAvailable: z.boolean().default(false),
    actualSurveyCost: z.coerce.number().nonnegative().default(0),
    notes: z.string().optional(),
    links: z.array(pboqKickoffLinkInputSchema).min(1),
    pboqAttachment: z
      .object({
        type: z.literal("PBOQ"),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      })
      .optional(),
  })
  .refine(
    (input) => !input.surveyAvailable || input.actualSurveyCost > 0,
    {
      message: "Actual survey cost is required when the survey is already conducted.",
      path: ["actualSurveyCost"],
    },
  )
  .refine(
    (input) => input.pboqMode !== "existing" || Boolean(input.pboqAttachment),
    {
      message: "Existing PBOQ attachment is required.",
      path: ["pboqAttachment"],
    },
  );

export type PboqRequestInput = z.infer<typeof pboqRequestInputSchema>;

export const pboqCostLineInputSchema = z.object({
  linkName: z.string().min(1),
  siteCoordinates: z.string().min(2).optional(),
  material: z.coerce.number().nonnegative(),
  build: z.coerce.number().nonnegative(),
  wayleave: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

const pboqAttachmentInputSchema = z.object({
  type: z.literal("PBOQ"),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storageKey: z.string().min(1),
});

export const fiberPlanningLineInputSchema = pboqCostLineInputSchema.extend({
  pboqFile: pboqAttachmentInputSchema,
});

export const fiberPlanningInputSchema = z.object({
  fiberPlanningNotes: z.string().optional(),
  lines: z.array(fiberPlanningLineInputSchema).min(1),
  kickoffLinkCount: z.coerce.number().int().positive().optional(),
});

export type FiberPlanningInput = z.infer<typeof fiberPlanningInputSchema>;
export type WirelessPlanningInput = FiberPlanningInput;

export const preparedBcInputSchema = z.object({
  customerName: z.string().min(2),
  accountNumber: z.string().min(1),
  opportunityNumber: z.string().min(2),
  accountManagerName: z.string().min(2),
  solutionArchitectureName: z.string().min(2),
  solutionEngineerName: z.string().min(2),
  contractTermMonths: z.coerce.number().int().positive(),
  projectExecutiveSummary: z.string().min(10),
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  payback: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidy: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
  nrv: z.coerce.number().nonnegative(),
  tcv: z.coerce.number().nonnegative(),
  exchangeRateKesUsd: z.coerce.number().positive(),
  otherExpenses: z
    .array(
      z.object({
        label: z.string().default(""),
        monthlyCost: z.coerce.number().nonnegative(),
      }),
    )
    .default([]),
  links: z.array(bcLinkInputSchema).min(1),
  lsoAttachment: z.object({
    type: z.literal("LSO"),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().min(1),
  }),
  bcTemplates: z
    .array(
      z.object({
        type: z.literal("BC_TEMPLATE"),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      }),
    )
    .min(1),
  pboqOrSurveyAttachment: z
    .object({
      type: z.enum(["PBOQ", "ACTUAL_SURVEY_QUOTE"]),
      name: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      storageKey: z.string().min(1),
    })
    .optional(),
  thirdPartyQuotesAttachment: z
    .object({
      type: z.literal("CONTRACTOR_QUOTE"),
      name: z.string().min(1),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
      storageKey: z.string().min(1),
    })
    .optional(),
  linkEvidenceAttachments: z
    .array(
      z.object({
        type: z.enum(["PBOQ", "ACTUAL_SURVEY_QUOTE", "CONTRACTOR_QUOTE"]),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      }),
    )
    .default([]),
  linkSupplierQuoteAttachments: z
    .array(
      z.object({
        type: z.literal("CONTRACTOR_QUOTE"),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        storageKey: z.string().min(1),
      }),
    )
    .default([]),
});

export type PreparedBcInput = z.infer<typeof preparedBcInputSchema>;

export type BcDraftInput = {
  opportunityNumber: string;
  customerName: string;
  accountNumber: string;
  solutionArchitectureName: string;
  solutionEngineerName: string;
  accountManagerName: string;
  contractTermMonths: number;
  projectExecutiveSummary: string;
  region: string;
  type: BusinessCaseType;
  irr: number;
  payback: number;
  capex: number;
  subsidy: number;
  approvedBudget: number;
  nrv: number;
  tcv: number;
  exchangeRateKesUsd: number;
  links: Array<
    z.infer<typeof bcLinkInputSchema> & {
      evidenceAttachmentIndex?: number;
      supplierQuoteAttachmentIndex?: number;
    }
  >;
  attachments: BcSubmissionInput["attachments"];
};
