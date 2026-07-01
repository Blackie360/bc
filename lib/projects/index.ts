import "server-only";

export {
  encodeKickoffLinkNotes,
  KICKOFF_LINK_NOTES_MARKER,
  parseKickoffLinkNotes,
  pboqKickoffLinkInputSchema,
  type PboqCostLineRecord,
  type PboqKickoffLinkInput,
} from "@/lib/pboq-kickoff-links";

export {
  preparedBcDraftSchema,
  type PreparedBcDraft,
  type PreparedBcDraftLink,
} from "@/lib/project-lifecycle-storage";

export {
  linkCostSourceValues,
  linkOnnetOffnetValues,
  projectServiceTypeValues,
  isThirdPartyLink,
  normalizeLinkOnnetOffnet,
  normalizeProjectServiceType,
  type LinkCostSource,
  type LinkOnnetOffnet,
  type ProjectServiceType,
  type ProjectRecordRequiredService,
} from "@/lib/projects-types";

export {
  bcLinkInputSchema,
  bcSubmissionInputSchema,
  fiberPlanningInputSchema,
  fiberPlanningLineInputSchema,
  pboqCostLineInputSchema,
  pboqRequestInputSchema,
  preparedBcInputSchema,
  projectInputSchema,
  type BcDraftInput,
  type BcSubmissionInput,
  type FiberPlanningInput,
  type PreparedBcInput,
  type ProjectInput,
  type PboqRequestInput,
  type WirelessPlanningInput,
} from "@/lib/projects/schemas";

export type {
  FinanceDecisionRecord,
  PboqRequestRecord,
  ProjectDocumentRecord,
  ProjectLinkRecord,
  ProjectRecord,
} from "@/lib/projects/types";

export {
  SURVEY_COST_DEVIATION_THRESHOLD_PERCENT,
  type FinanceDecision,
  type FinanceDecisionInput,
  type SalesOperationsDiscrepancyInput,
  type SduAlignmentMismatchInput,
  type SduSurveyCostInput,
} from "@/lib/projects/types";

export { mapKickoffLinksToCostLineRecords } from "@/lib/projects/mappers";

export {
  canEditProject,
  hasPboqDocumentAttachment,
  isAccountManagerBcPreparationStage,
  isFibreReadyOpportunity,
  planningRoleForProject,
  projectBelongsToRole,
  projectDecisionStatus,
} from "@/lib/projects/helpers";

export {
  advanceProjectToNextStage,
  completeFiberPlanning,
  completeWirelessPlanning,
  confirmSalesOperationsOrder,
  confirmSduAlignment,
  createBcDraft,
  createBcSubmission,
  createPboqRequest,
  createProject,
  decideFinanceWorkflow,
  deleteProject,
  getProject,
  listProjects,
  listProjectsForPage,
  prepareBusinessCaseFromPboq,
  reportSalesOperationsDiscrepancy,
  reportSduAlignmentMismatch,
  savePreparedBcDraft,
  submitSduSurveyCost,
  updateProject,
} from "@/lib/projects/service";
