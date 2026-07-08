import type { LinkRowState } from "@/lib/bc/prepared-bc-rows";
import type { BcFormTab } from "@/lib/bc/form-tabs";
import {
  readFormFieldValue,
  readIndexedFormRows,
  readFileMetadata,
  readFileMetadataList,
  type PreparedBcDraft,
} from "@/lib/project-lifecycle-storage";

export function buildPreparedBcDraft(
  form: HTMLFormElement,
  activeTab: BcFormTab,
  rows: LinkRowState[],
): PreparedBcDraft {
  const readAttachment = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? readFileMetadata(input) : undefined;
  };
  const readAttachments = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? readFileMetadataList(input) : undefined;
  };

  return {
    savedAt: new Date().toISOString(),
    activeTab,
    accountNumber: readFormFieldValue(form, "accountNumber"),
    solutionArchitectureName: readFormFieldValue(form, "solutionArchitectureName"),
    solutionEngineerName: readFormFieldValue(form, "solutionEngineerName"),
    contractTermMonths: Number(readFormFieldValue(form, "contractTermMonths")) || undefined,
    projectExecutiveSummary: readFormFieldValue(form, "projectExecutiveSummary"),
    type: readFormFieldValue(form, "type") as PreparedBcDraft["type"],
    pboqOrSurveyType: readFormFieldValue(form, "pboqOrSurveyType") as PreparedBcDraft["pboqOrSurveyType"],
    irr: Number(readFormFieldValue(form, "irr")) || undefined,
    payback: Number(readFormFieldValue(form, "payback")) || undefined,
    capex: Number(readFormFieldValue(form, "capex")) || undefined,
    subsidy: Number(readFormFieldValue(form, "subsidy")) || undefined,
    approvedBudget: Number(readFormFieldValue(form, "approvedBudget")) || undefined,
    nrv: Number(readFormFieldValue(form, "nrv")) || undefined,
    tcv: Number(readFormFieldValue(form, "tcv")) || undefined,
    exchangeRateKesUsd: Number(readFormFieldValue(form, "exchangeRateKesUsd")) || undefined,
    lsoAttachment: readAttachment("lsoAttachment"),
    bcTemplate: readAttachment("bcTemplate"),
    bcTemplates: readAttachments("bcTemplate"),
    pboqOrSurveyAttachment: readAttachment("pboqOrSurveyAttachment"),
    thirdPartyQuotesAttachment: readAttachment("thirdPartyQuotesAttachment"),
    linkEvidenceAttachments: rows
      .map((_row, index) => readAttachment(`linkEvidence-${index}`))
      .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment)),
    linkSupplierQuoteAttachments: rows
      .map((_row, index) => readAttachment(`linkSupplierQuote-${index}`))
      .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment)),
    links: rows.map((row, index) => ({
      linkName: readFormFieldValue(form, `links[${index}][linkName]`) || row.linkName,
      service: readFormFieldValue(form, `links[${index}][service]`) || row.service,
      technology: readFormFieldValue(form, `links[${index}][technology]`) || row.technology,
      onnetOffnet: row.onnetOffnet ?? "Onnet",
      costSource: readFormFieldValue(form, `links[${index}][costSource]`) as LinkRowState["costSource"],
      onnetCapacity: readFormFieldValue(form, `links[${index}][onnetCapacity]`) || row.onnetCapacity,
      offnetCapacity: readFormFieldValue(form, `links[${index}][offnetCapacity]`) || row.offnetCapacity,
      providerName: readFormFieldValue(form, `links[${index}][providerName]`) || row.providerName,
      newBuildCost: row.newBuildCost,
      provisioningCost: row.provisioningCost,
      materialCost: row.materialCost,
      wayleaveCost: row.wayleaveCost,
      mrc: readFormFieldValue(form, `links[${index}][mrc]`) || row.mrc,
      mrr: readFormFieldValue(form, `links[${index}][mrr]`) || row.mrr,
      nrr: readFormFieldValue(form, `links[${index}][nrr]`) || row.nrr,
    })),
    otherExpenses: readIndexedFormRows<{
      label?: string;
      monthlyCost?: string;
    }>(form, "otherExpenses", ["label", "monthlyCost"]),
  };
}
