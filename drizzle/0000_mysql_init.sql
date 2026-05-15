CREATE TABLE `ActualCostCapture` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`businessCaseId` varchar(36) NOT NULL,
	`contractorName` text,
	`approvedBudget` decimal(14,2) NOT NULL,
	`actualSpend` decimal(14,2) NOT NULL,
	`surveyBudget` decimal(14,2) NOT NULL,
	`surveyActual` decimal(14,2) NOT NULL,
	`varianceAmount` decimal(14,2) NOT NULL,
	`variancePercent` decimal(8,2) NOT NULL,
	`surveyDeviationPct` decimal(8,2) NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ActualCostCapture_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ApprovalCertificate` (
	`id` varchar(36) NOT NULL,
	`businessCaseId` varchar(36) NOT NULL,
	`certificateNo` varchar(128) NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`fileStorageKey` text NOT NULL,
	`checksum` varchar(128) NOT NULL,
	CONSTRAINT `ApprovalCertificate_id` PRIMARY KEY(`id`),
	CONSTRAINT `ApprovalCertificate_businessCaseId_unique` UNIQUE(`businessCaseId`),
	CONSTRAINT `ApprovalCertificate_certificateNo_unique` UNIQUE(`certificateNo`)
);
--> statement-breakpoint
CREATE TABLE `ApprovalHistory` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`businessCaseId` varchar(36),
	`actorId` varchar(36) NOT NULL,
	`role` enum('ACCOUNT_MANAGER','FIBER_PLANNING','SOLUTION_ARCHITECT','SOLUTION_ENGINEER','BC_ANALYST','CFO','SALES_OPERATIONS','SDU','SITE_ACQUISITION_MANAGER','PROJECT_MANAGER','CONTRACTOR') NOT NULL,
	`action` enum('SUBMIT','APPROVE','REJECT','REVERT','ESCALATE','VALIDATE','REQUEST_REVISION','CAPTURE_ACTUALS','GENERATE_CERTIFICATE') NOT NULL,
	`fromStatus` enum('OPPORTUNITY_CREATED','PBOQ_REQUESTED','FIBER_PLANNING_COSTS','BUSINESS_CASE_PREPARED','FINANCIAL_METRICS_COMPUTED','APPROVAL_ROUTING','FINANCE_CFO_APPROVAL','SALES_OPERATIONS_VALIDATION','SDU_VALIDATION','SURVEY_SITE_ACQUISITION','CONTRACTOR_IMPLEMENTATION','ACTUAL_COST_CAPTURE','BUDGET_ACTUAL_ANALYSIS','PROJECT_CLOSURE_REPORTING','REVERTED','CANCELLED'),
	`toStatus` enum('OPPORTUNITY_CREATED','PBOQ_REQUESTED','FIBER_PLANNING_COSTS','BUSINESS_CASE_PREPARED','FINANCIAL_METRICS_COMPUTED','APPROVAL_ROUTING','FINANCE_CFO_APPROVAL','SALES_OPERATIONS_VALIDATION','SDU_VALIDATION','SURVEY_SITE_ACQUISITION','CONTRACTOR_IMPLEMENTATION','ACTUAL_COST_CAPTURE','BUDGET_ACTUAL_ANALYSIS','PROJECT_CLOSURE_REPORTING','REVERTED','CANCELLED'),
	`decision` enum('PROCEED','SEEK_FINANCE_APPROVAL','PROCEED_WITH_SUBSIDY_DISCLOSURE'),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ApprovalHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `AuditLog` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36),
	`actorId` varchar(36),
	`event` varchar(128) NOT NULL,
	`entityType` varchar(128) NOT NULL,
	`entityId` varchar(36) NOT NULL,
	`metadata` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `AuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `BusinessCaseLink` (
	`id` varchar(36) NOT NULL,
	`businessCaseId` varchar(36) NOT NULL,
	`linkName` text NOT NULL,
	`material` decimal(14,2) NOT NULL,
	`labor` decimal(14,2) NOT NULL,
	`wayleave` decimal(14,2) NOT NULL,
	`mrr` decimal(14,2) NOT NULL,
	`mrc` decimal(14,2) NOT NULL,
	`nrc` decimal(14,2) NOT NULL,
	`nrr` decimal(14,2) NOT NULL,
	`evidenceDocumentId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `BusinessCaseLink_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `BusinessCase` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`type` enum('ORDINARY_BC','MARGIN_ANALYSIS_BC') NOT NULL,
	`solutionArchitectureName` text NOT NULL DEFAULT ('Unassigned'),
	`solutionEngineerName` text NOT NULL DEFAULT ('Unassigned'),
	`irr` decimal(8,2) NOT NULL,
	`paybackMonths` int NOT NULL,
	`capex` decimal(14,2) NOT NULL,
	`subsidyRequirement` decimal(14,2) NOT NULL,
	`approvedBudget` decimal(14,2) NOT NULL,
	`grossMarginPercent` decimal(8,2),
	`decisionOutput` enum('PROCEED','SEEK_FINANCE_APPROVAL','PROCEED_WITH_SUBSIDY_DISCLOSURE') NOT NULL,
	`requiresCfo` boolean NOT NULL DEFAULT false,
	`subsidyDisclosed` boolean NOT NULL DEFAULT false,
	`submittedAt` timestamp,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `BusinessCase_id` PRIMARY KEY(`id`),
	CONSTRAINT `BusinessCase_opportunityId_version_unique` UNIQUE(`opportunityId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `Document` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`uploadedById` varchar(36) NOT NULL,
	`type` enum('SOLUTION_DESIGN','PBOQ','PBOQ_SUMMARY_PROOF','PBOQ_BUILD_PROOF','PBOQ_MATERIAL_PROOF','PBOQ_WAYLEAVE_PROOF','BC_TEMPLATE','BUSINESS_CASE','SITE_ACQUISITION','SURVEY_REPORT','CONTRACTOR_QUOTE','ORDER_FORM','ACTUAL_SURVEY_QUOTE','BC_APPROVAL_CERTIFICATE','ACTUAL_COST_EVIDENCE') NOT NULL,
	`name` text NOT NULL,
	`storageKey` text NOT NULL,
	`mimeType` varchar(255) NOT NULL,
	`sizeBytes` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `Document_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Opportunity` (
	`id` varchar(36) NOT NULL,
	`reference` varchar(64) NOT NULL,
	`customerName` text NOT NULL,
	`opportunityName` text NOT NULL,
	`siteName` text,
	`siteCoordinates` text,
	`requiredService` enum('EPL','DIA','DFA'),
	`capacity` text,
	`salesRequestor` text,
	`leadNetworkPlanner` text,
	`region` text NOT NULL,
	`segment` text NOT NULL,
	`mrr` decimal(14,2) NOT NULL DEFAULT '0',
	`nrr` decimal(14,2) NOT NULL DEFAULT '0',
	`contractTermMonths` int NOT NULL DEFAULT 12,
	`accountManagerId` varchar(36) NOT NULL,
	`status` enum('OPPORTUNITY_CREATED','PBOQ_REQUESTED','FIBER_PLANNING_COSTS','BUSINESS_CASE_PREPARED','FINANCIAL_METRICS_COMPUTED','APPROVAL_ROUTING','FINANCE_CFO_APPROVAL','SALES_OPERATIONS_VALIDATION','SDU_VALIDATION','SURVEY_SITE_ACQUISITION','CONTRACTOR_IMPLEMENTATION','ACTUAL_COST_CAPTURE','BUDGET_ACTUAL_ANALYSIS','PROJECT_CLOSURE_REPORTING','REVERTED','CANCELLED') NOT NULL DEFAULT 'OPPORTUNITY_CREATED',
	`priority` varchar(32) NOT NULL DEFAULT 'Normal',
	`requestedDate` timestamp NOT NULL DEFAULT (now()),
	`designPlanDate` timestamp,
	`targetInstallDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `Opportunity_id` PRIMARY KEY(`id`),
	CONSTRAINT `Opportunity_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `PboqCostLine` (
	`id` varchar(36) NOT NULL,
	`pboqRequestId` varchar(36) NOT NULL,
	`linkName` text NOT NULL,
	`material` decimal(14,2) NOT NULL,
	`build` decimal(14,2) NOT NULL,
	`wayleave` decimal(14,2) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `PboqCostLine_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `PboqRequest` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`solutionDesignDocumentId` varchar(36),
	`siteCount` int NOT NULL,
	`routeDistanceKm` decimal(10,2) NOT NULL,
	`surveyBudget` decimal(14,2) NOT NULL,
	`surveyAvailable` boolean NOT NULL DEFAULT false,
	`costSource` enum('ACTUAL_SURVEY','PBOQ_ESTIMATE') NOT NULL DEFAULT 'PBOQ_ESTIMATE',
	`actualSurveyCost` decimal(14,2) NOT NULL DEFAULT '0',
	`notes` text,
	`fiberPlanningNotes` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `PboqRequest_id` PRIMARY KEY(`id`),
	CONSTRAINT `PboqRequest_opportunityId_unique` UNIQUE(`opportunityId`)
);
--> statement-breakpoint
CREATE TABLE `Revision` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`businessCaseId` varchar(36),
	`requestedById` varchar(36) NOT NULL,
	`reason` text NOT NULL,
	`notes` text NOT NULL,
	`revisionNumber` int NOT NULL,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `Revision_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` enum('ACCOUNT_MANAGER','FIBER_PLANNING','SOLUTION_ARCHITECT','SOLUTION_ENGINEER','BC_ANALYST','CFO','SALES_OPERATIONS','SDU','SITE_ACQUISITION_MANAGER','PROJECT_MANAGER','CONTRACTOR') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `User_id` PRIMARY KEY(`id`),
	CONSTRAINT `User_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `WorkflowAssignment` (
	`id` varchar(36) NOT NULL,
	`opportunityId` varchar(36) NOT NULL,
	`role` enum('ACCOUNT_MANAGER','FIBER_PLANNING','SOLUTION_ARCHITECT','SOLUTION_ENGINEER','BC_ANALYST','CFO','SALES_OPERATIONS','SDU','SITE_ACQUISITION_MANAGER','PROJECT_MANAGER','CONTRACTOR') NOT NULL,
	`assigneeId` varchar(36),
	`status` enum('OPPORTUNITY_CREATED','PBOQ_REQUESTED','FIBER_PLANNING_COSTS','BUSINESS_CASE_PREPARED','FINANCIAL_METRICS_COMPUTED','APPROVAL_ROUTING','FINANCE_CFO_APPROVAL','SALES_OPERATIONS_VALIDATION','SDU_VALIDATION','SURVEY_SITE_ACQUISITION','CONTRACTOR_IMPLEMENTATION','ACTUAL_COST_CAPTURE','BUDGET_ACTUAL_ANALYSIS','PROJECT_CLOSURE_REPORTING','REVERTED','CANCELLED') NOT NULL,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `WorkflowAssignment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ActualCostCapture` ADD CONSTRAINT `ActualCostCapture_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ActualCostCapture` ADD CONSTRAINT `ActualCostCapture_businessCaseId_BusinessCase_id_fk` FOREIGN KEY (`businessCaseId`) REFERENCES `BusinessCase`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ApprovalCertificate` ADD CONSTRAINT `ApprovalCertificate_businessCaseId_BusinessCase_id_fk` FOREIGN KEY (`businessCaseId`) REFERENCES `BusinessCase`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ApprovalHistory` ADD CONSTRAINT `ApprovalHistory_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ApprovalHistory` ADD CONSTRAINT `ApprovalHistory_businessCaseId_BusinessCase_id_fk` FOREIGN KEY (`businessCaseId`) REFERENCES `BusinessCase`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ApprovalHistory` ADD CONSTRAINT `ApprovalHistory_actorId_User_id_fk` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_User_id_fk` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `BusinessCaseLink` ADD CONSTRAINT `BusinessCaseLink_businessCaseId_BusinessCase_id_fk` FOREIGN KEY (`businessCaseId`) REFERENCES `BusinessCase`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `BusinessCaseLink` ADD CONSTRAINT `BusinessCaseLink_evidenceDocumentId_Document_id_fk` FOREIGN KEY (`evidenceDocumentId`) REFERENCES `Document`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `BusinessCase` ADD CONSTRAINT `BusinessCase_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Document` ADD CONSTRAINT `Document_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Document` ADD CONSTRAINT `Document_uploadedById_User_id_fk` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Opportunity` ADD CONSTRAINT `Opportunity_accountManagerId_User_id_fk` FOREIGN KEY (`accountManagerId`) REFERENCES `User`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `PboqCostLine` ADD CONSTRAINT `PboqCostLine_pboqRequestId_PboqRequest_id_fk` FOREIGN KEY (`pboqRequestId`) REFERENCES `PboqRequest`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `PboqRequest` ADD CONSTRAINT `PboqRequest_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Revision` ADD CONSTRAINT `Revision_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Revision` ADD CONSTRAINT `Revision_businessCaseId_BusinessCase_id_fk` FOREIGN KEY (`businessCaseId`) REFERENCES `BusinessCase`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Revision` ADD CONSTRAINT `Revision_requestedById_User_id_fk` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowAssignment` ADD CONSTRAINT `WorkflowAssignment_opportunityId_Opportunity_id_fk` FOREIGN KEY (`opportunityId`) REFERENCES `Opportunity`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `WorkflowAssignment` ADD CONSTRAINT `WorkflowAssignment_assigneeId_User_id_fk` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE no action ON UPDATE no action;