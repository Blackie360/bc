import "server-only";

import { randomUUID } from "node:crypto";
import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { ProjectRecord } from "@/lib/project-record-types";
import { issueBcApprovalCertificate } from "@/lib/projects/certificate";
import { buildReference } from "@/lib/projects/ids";
import { mapLinkInputToRecord } from "@/lib/projects/mappers";
import { localDocument, createLocalProjectRecord } from "@/lib/projects/record-factory";
import { localRouteForPreparedBusinessCase } from "@/lib/projects/routing";
import {
  type BcDraftInput,
  type BcSubmissionInput,
  type PreparedBcInput,
  bcSubmissionInputSchema,
  preparedBcInputSchema,
} from "@/lib/projects/schemas";
import {
  readLocalProjects,
  updateLocalProjects,
  writeLocalProjects,
} from "@/lib/projects/storage";
import { deriveDecision } from "@/lib/workflow";
import { localGetProject } from "@/lib/projects/operations/crud";

function resolveLinkDocumentId(
  documents: ProjectRecord["documents"],
  attachmentIndex: number | undefined,
) {
  if (attachmentIndex == null || attachmentIndex < 0) {
    return null;
  }

  return documents[attachmentIndex]?.id ?? null;
}

export async function localPrepareBusinessCaseFromPboq(id: string, input: PreparedBcInput) {
  const validated = preparedBcInputSchema.parse(input);
  let updatedProject: ProjectRecord | undefined;

  await updateLocalProjects((projects) =>
    projects.map((project) => {
      if (project.id !== id) return project;
      if (!project.pboqRequest) {
        throw new Error("PBOQ attachment or request is required before BC preparation.");
      }

      const now = new Date().toISOString();
      const decision = deriveDecision({
        irr: validated.irr,
        paybackMonths: validated.payback,
        subsidyRequirement: validated.subsidy,
        capex: validated.capex,
      }).decision;
      const route = localRouteForPreparedBusinessCase(validated.subsidy);
      const newDocuments = [
        localDocument(validated.lsoAttachment, now),
        ...validated.bcTemplates.map((attachment) => localDocument(attachment, now)),
        ...(validated.pboqOrSurveyAttachment
          ? [localDocument(validated.pboqOrSurveyAttachment, now)]
          : []),
        ...(validated.thirdPartyQuotesAttachment
          ? [localDocument(validated.thirdPartyQuotesAttachment, now)]
          : []),
        ...validated.linkEvidenceAttachments.map((attachment) => localDocument(attachment, now)),
        ...validated.linkSupplierQuoteAttachments.map((attachment) =>
          localDocument(attachment, now),
        ),
      ];
      const baseDocumentCount =
        1 +
        validated.bcTemplates.length +
        (validated.pboqOrSurveyAttachment ? 1 : 0) +
        (validated.thirdPartyQuotesAttachment ? 1 : 0);
      const links = validated.links.map((link) => {
        const evidenceDocumentId =
          link.evidenceAttachmentIndex != null && link.evidenceAttachmentIndex >= 0
            ? newDocuments[baseDocumentCount + link.evidenceAttachmentIndex]?.id ??
              project.documents.find((document) => document.type === "PBOQ")?.id ??
              null
            : project.documents.find((document) => document.type === "PBOQ")?.id ?? null;
        const supplierQuoteDocumentId =
          link.supplierQuoteAttachmentIndex != null && link.supplierQuoteAttachmentIndex >= 0
            ? newDocuments[
                baseDocumentCount +
                  validated.linkEvidenceAttachments.length +
                  link.supplierQuoteAttachmentIndex
              ]?.id ?? null
            : null;

        return mapLinkInputToRecord(link, {
          evidenceDocumentId,
          supplierQuoteDocumentId,
        });
      });

      const preparedProject = {
        ...project,
        customer: validated.customerName,
        owner: validated.accountManagerName,
        accountNumber: validated.accountNumber,
        solutionArchitectureName: validated.solutionArchitectureName,
        solutionEngineerName: validated.solutionEngineerName,
        projectExecutiveSummary: validated.projectExecutiveSummary,
        contractTermMonths: validated.contractTermMonths,
        type: validated.type,
        irr: validated.irr,
        payback: validated.payback,
        capex: validated.capex,
        subsidy: validated.subsidy,
        approvedBudget: validated.approvedBudget,
        nrv: validated.nrv,
        tcv: validated.tcv,
        exchangeRateKesUsd: validated.exchangeRateKesUsd,
        decision,
        state: route.state,
        roleQueue: route.role,
        certificateIssued: project.certificateIssued,
        links,
        totalMrr: links.reduce((total, link) => total + link.mrr, 0),
        totalMrc: links.reduce((total, link) => total + link.mrc, 0),
        totalNrc: links.reduce((total, link) => total + link.nrc, 0),
        totalNrr: links.reduce((total, link) => total + link.nrr, 0),
        documents: [...newDocuments, ...project.documents],
        revisions: project.revisions + 1,
        pboqRequest: project.pboqRequest
          ? { ...project.pboqRequest, bcPreparationDraft: null }
          : project.pboqRequest,
        updatedAt: now,
      };
      updatedProject = route.autoApproved
        ? issueBcApprovalCertificate(preparedProject, now)
        : preparedProject;

      return updatedProject;
    }),
  );

  if (!updatedProject) {
    throw new Error("Project not found.");
  }

  return updatedProject;
}

export async function localCreateBcSubmission(input: BcSubmissionInput) {
  const validated = bcSubmissionInputSchema.parse(input);
  const projects = await readLocalProjects();

  if (projects.some((project) => project.id === validated.opportunityNumber)) {
    throw new Error("Opportunity number already exists.");
  }

  const now = new Date().toISOString();
  const decision = deriveDecision({
    irr: validated.irr,
    paybackMonths: validated.payback,
    subsidyRequirement: validated.subsidy,
    capex: validated.capex,
  }).decision;
  const route = localRouteForPreparedBusinessCase(validated.subsidy);
  const documents = validated.attachments.map((attachment) => localDocument(attachment, now));
  const links = validated.links.map((link) =>
    mapLinkInputToRecord(link, {
      evidenceDocumentId: resolveLinkDocumentId(documents, link.evidenceAttachmentIndex),
      supplierQuoteDocumentId: resolveLinkDocumentId(
        documents,
        link.supplierQuoteAttachmentIndex,
      ),
    }),
  );
  const project = createLocalProjectRecord(
    {
      customer: validated.customerName,
      title: `${validated.customerName} BC submission`,
      region: validated.region,
      owner: validated.accountManagerName,
      state: route.state,
      roleQueue: route.role,
      type: validated.type,
      irr: validated.irr,
      payback: validated.payback,
      capex: validated.capex,
      subsidy: validated.subsidy,
      approvedBudget: validated.approvedBudget,
      actualSpend: 0,
      surveyDeviation: 0,
      due: "Unscheduled",
    },
    {
      id: validated.opportunityNumber,
      accountNumber: validated.accountNumber,
      solutionArchitectureName: validated.solutionArchitectureName,
      solutionEngineerName: validated.solutionEngineerName,
      projectExecutiveSummary: validated.projectExecutiveSummary,
      contractTermMonths: validated.contractTermMonths,
      exchangeRateKesUsd: validated.exchangeRateKesUsd,
      opportunityMrr: links.reduce((total, link) => total + link.mrr, 0),
      opportunityNrr: links.reduce((total, link) => total + link.nrr, 0),
      links,
      documents,
      totalMrr: links.reduce((total, link) => total + link.mrr, 0),
      totalMrc: links.reduce((total, link) => total + link.mrc, 0),
      totalNrc: links.reduce((total, link) => total + link.nrc, 0),
      totalNrr: links.reduce((total, link) => total + link.nrr, 0),
      nrv: validated.nrv,
      tcv: validated.tcv,
      decision,
    },
  );
  const projectWithCertificate = route.autoApproved
    ? issueBcApprovalCertificate(project, now)
    : project;

  await writeLocalProjects([projectWithCertificate, ...projects]);
  return projectWithCertificate;
}

export async function localCreateBcDraft(input: BcDraftInput) {
  const referenceBase = input.opportunityNumber.trim() || buildReference();
  const projects = await readLocalProjects();
  const id = projects.some((project) => project.id === referenceBase)
    ? `${referenceBase}-DRAFT-${randomUUID().slice(0, 4).toUpperCase()}`
    : referenceBase;
  const documents = input.attachments.map((attachment) => localDocument(attachment));
  const links = input.links.map((link) =>
    mapLinkInputToRecord(link, {
      evidenceDocumentId: resolveLinkDocumentId(documents, link.evidenceAttachmentIndex),
      supplierQuoteDocumentId: resolveLinkDocumentId(
        documents,
        link.supplierQuoteAttachmentIndex,
      ),
    }),
  );
  const project = createLocalProjectRecord(
    {
      customer: input.customerName.trim() || "Draft Customer",
      title: `${input.customerName.trim() || "Draft Customer"} draft`,
      region: input.region.trim() || "Unassigned",
      owner: input.accountManagerName.trim() || "Current User",
      state: "Opportunity Created",
      roleQueue: "Account Manager",
      type: input.type || "Ordinary BC",
      irr: Number.isFinite(input.irr) ? input.irr : 0,
      payback: Number.isFinite(input.payback) && input.payback > 0 ? input.payback : 1,
      capex: Number.isFinite(input.capex) ? input.capex : 0,
      subsidy: Number.isFinite(input.subsidy) ? input.subsidy : 0,
      approvedBudget: Number.isFinite(input.approvedBudget) ? input.approvedBudget : 0,
      actualSpend: 0,
      surveyDeviation: 0,
      due: "Unscheduled",
    },
    {
      id,
      accountNumber: input.accountNumber.trim(),
      solutionArchitectureName: input.solutionArchitectureName.trim() || "Unassigned",
      solutionEngineerName: input.solutionEngineerName.trim() || "Unassigned",
      projectExecutiveSummary: input.projectExecutiveSummary.trim(),
      contractTermMonths: input.contractTermMonths,
      exchangeRateKesUsd: input.exchangeRateKesUsd,
      links,
      documents,
      totalMrr: links.reduce((total, link) => total + link.mrr, 0),
      totalMrc: links.reduce((total, link) => total + link.mrc, 0),
      totalNrc: links.reduce((total, link) => total + link.nrc, 0),
      totalNrr: links.reduce((total, link) => total + link.nrr, 0),
      nrv: input.nrv,
      tcv: input.tcv,
    },
  );

  await writeLocalProjects([project, ...projects]);
  return project;
}

/** BC preparation drafts are stored in the browser (localStorage) for now. */
export async function savePreparedBcDraft(id: string, _draft: PreparedBcDraft) {
  void _draft;

  const project = await localGetProject(id);

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}
