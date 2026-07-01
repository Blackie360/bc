"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/workflow/form-field";
import { FileUploadField } from "@/components/workflow/file-upload-field";
import { bcTemplateFileNames } from "@/lib/bc/prepared-bc-rows";
import type { PreparedBcDraft } from "@/lib/project-lifecycle-storage";
import type { ProjectRecord } from "@/lib/project-record-types";

type PreparedBcDetailsTabProps = {
  project: ProjectRecord;
  savedDraft?: PreparedBcDraft | null;
  isFibreReady: boolean;
  hasExistingPboq: boolean;
  contractTermMonths: number;
  onContractTermMonthsChange: (months: number) => void;
};

export function PreparedBcDetailsTab({
  project,
  savedDraft,
  isFibreReady,
  hasExistingPboq,
  contractTermMonths,
  onContractTermMonthsChange,
}: PreparedBcDetailsTabProps) {
  return (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Client Name" required>
                  <Input
                    name="customerName"
                    defaultValue={project.customer}
                    readOnly
                    required
                  />
                </Field>
                <Field label="Account Number" required>
                  <Input
                    name="accountNumber"
                    defaultValue={savedDraft?.accountNumber ?? project.accountNumber}
                    required
                  />
                  
                </Field>
                <Field label="Opportunity Number" required>
                  <Input name="opportunityNumber" defaultValue={project.id} readOnly required />
                  {isFibreReady ? (
                    <p className="text-xs font-normal text-[color:var(--color-muted)]">
                      Fibre-ready opportunity. No PBOQ is required for BC preparation.
                    </p>
                  ) : !hasExistingPboq ? (
                    <>
                      <p className="text-xs font-normal text-[color:var(--color-muted)]">
                        PBOQ or survey type
                      </p>
                      <Select
                        name="pboqOrSurveyType"
                        defaultValue={savedDraft?.pboqOrSurveyType ?? "PBOQ"}
                        required
                      >
                        <option value="PBOQ">PBOQ</option>
                        <option value="ACTUAL_SURVEY">Actual survey per site</option>
                      </Select>
                      <p className="text-xs font-normal text-[color:var(--color-muted)]">
                        PBOQ / survey attachment
                      </p>
                      <FileUploadField
                        id="pboqOrSurveyAttachment"
                        name="pboqOrSurveyAttachment"
                        required
                        defaultFileName={savedDraft?.pboqOrSurveyAttachment?.name}
                      />
                    </>
                  ) : (
                    <p className="text-xs font-normal text-[color:var(--color-muted)]">
                      PBOQ already attached from Planning.
                    </p>
                  )}
                </Field>
                
                <Field label="Solution Architecture" required>
                  <Input
                    name="solutionArchitectureName"
                    defaultValue={
                      savedDraft?.solutionArchitectureName ?? project.solutionArchitectureName
                    }
                    required
                  />
                </Field>
                <Field label="Engineering" required>
                  <Input
                    name="solutionEngineerName"
                    defaultValue={savedDraft?.solutionEngineerName ?? project.solutionEngineerName}
                    required
                  />
                </Field>
                <Field label="Contract Term">
                  <Select
                    name="contractTermMonths"
                    value={String(contractTermMonths)}
                    onChange={(event) => onContractTermMonthsChange(Number(event.currentTarget.value))}
                  >
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </Select>
                </Field>
                <Field label="Attachments" required>
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">LSO</p>
                  <FileUploadField
                    id="lsoAttachment"
                    name="lsoAttachment"
                    required
                    defaultFileName={savedDraft?.lsoAttachment?.name}
                  />
                  
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">
                    Prepared BC Excel sheet(s)
                  </p>
                  <FileUploadField
                    id="bcTemplate"
                    name="bcTemplate"
                    accept=".xlsx,.xls,.csv"
                    required
                    multiple
                    defaultFileName={bcTemplateFileNames(savedDraft)}
                  />
                  
                </Field>
                <Field label="Account Manager" required>
                  <Input name="accountManagerName" defaultValue={project.owner} readOnly required />
                  <p className="text-xs font-normal text-[color:var(--color-muted)]">
                    Optional bundled 3rd Party quotes
                  </p>
                  <FileUploadField
                    id="thirdPartyQuotesAttachment"
                    name="thirdPartyQuotesAttachment"
                    defaultFileName={savedDraft?.thirdPartyQuotesAttachment?.name}
                  />
                  
                </Field>
                <Field label="Project Executive Summary" required>
                  <Textarea
                    name="projectExecutiveSummary"
                    rows={4}
                    required
                    className="md:col-span-2"
                    defaultValue={savedDraft?.projectExecutiveSummary ?? project.projectExecutiveSummary}
                  />
                </Field>
              </div>
  );
}
