import "server-only";

import type {
  BcApprovalCertificateRecord,
  ProjectRecord,
} from "@/lib/project-record-types";
import { createId } from "@/lib/projects/ids";
import { localDocument } from "@/lib/projects/record-factory";

const certificateDistributionRecipients: BcApprovalCertificateRecord["distributedTo"] = [
  "Sales Operations",
  "Account Manager",
  "Designated SDU Officer",
  "Full SDU Team",
];

function generatedCertificateSize(project: ProjectRecord) {
  return Buffer.byteLength(
    [
      `BC Approval Certificate: ${project.id}`,
      `Customer: ${project.customer}`,
      `Opportunity: ${project.id}`,
      `Approved Budget: ${project.approvedBudget}`,
      `Decision: ${project.decision}`,
    ].join("\n"),
    "utf8",
  );
}

export function issueBcApprovalCertificate(
  project: ProjectRecord,
  issuedAt: string,
): ProjectRecord {
  const existingCertificateDocument = project.documents.find(
    (document) => document.type === "BC_APPROVAL_CERTIFICATE",
  );

  if (project.certificateIssued && project.certificate && existingCertificateDocument) {
    return project;
  }

  const document =
    existingCertificateDocument ??
    localDocument(
      {
        type: "BC_APPROVAL_CERTIFICATE",
        name: `BC Approval Certificate - ${project.id}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: generatedCertificateSize(project),
      },
      issuedAt,
    );

  return {
    ...project,
    certificateIssued: true,
    certificate: {
      id: project.certificate?.id ?? createId(),
      documentId: document.id,
      salesforceOpportunityId: project.id,
      salesforceUploadStatus: "uploaded",
      distributedTo: certificateDistributionRecipients,
      issuedAt,
    },
    documents: existingCertificateDocument ? project.documents : [document, ...project.documents],
  };
}

export function revokeBcApprovalCertificate(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    certificateIssued: false,
    certificate: null,
    documents: project.documents.filter(
      (document) => document.type !== "BC_APPROVAL_CERTIFICATE",
    ),
  };
}
