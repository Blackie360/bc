CREATE TABLE `bc_approval_certificates` (
	`id` varchar(191) NOT NULL,
	`opportunity_id` varchar(191) NOT NULL,
	`document_id` varchar(191) NOT NULL,
	`salesforce_opportunity_id` varchar(191) NOT NULL,
	`salesforce_upload_status` varchar(80) NOT NULL,
	`distributed_to` json NOT NULL,
	`issued_at` timestamp NOT NULL,
	`raw_record` json,
	CONSTRAINT `bc_approval_certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_decisions` (
	`id` varchar(191) NOT NULL,
	`opportunity_id` varchar(191) NOT NULL,
	`decision` enum('approve','reject','escalate-cfo','escallate-ceo','question-architect','sales-ops-discrepancy','sdu-alignment-mismatch','sdu-survey-variance') NOT NULL,
	`notes` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`raw_record` json,
	CONSTRAINT `finance_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` varchar(191) NOT NULL,
	`customer` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`site_name` varchar(255) NOT NULL,
	`site_coordinates` varchar(255) NOT NULL,
	`region` varchar(120) NOT NULL,
	`owner` varchar(255) NOT NULL,
	`state` enum('Opportunity Created','PBOQ Request Submitted','Fiber Planning Generates Costs','Wireless Planning Generates Costs','Business Case Prepared','System Computes Financial Metrics','Approval Routing Engine','Finance / CFO Approval','Sales Operations Validation','SDU Validation','Survey & Site Acquisition','Contractor Implementation','Actual Cost Capture','Budget vs Actual Analysis','Project Closure & Reporting') NOT NULL,
	`role_queue` enum('Account Manager','Fiber Planning Team','Wireless Planning Team','Solutions Architect','Solutions Engineer','BC Analyst / Finance','CFO','Sales Operations','SDU','Site Acquisition Manager','Project Manager','Contractor') NOT NULL,
	`type` enum('Ordinary BC','Margin Analysis BC') NOT NULL,
	`required_service` varchar(80) NOT NULL,
	`capacity` varchar(255) NOT NULL,
	`sales_requestor` varchar(255) NOT NULL,
	`lead_network_planner` varchar(255) NOT NULL,
	`account_manager_name` varchar(255) NOT NULL,
	`date_requested` timestamp NOT NULL,
	`design_plan_date` datetime,
	`account_number` varchar(191) NOT NULL DEFAULT '',
	`solution_architecture_name` varchar(255) NOT NULL DEFAULT '',
	`solution_engineer_name` varchar(255) NOT NULL DEFAULT '',
	`project_executive_summary` text NOT NULL,
	`opportunity_mrr` decimal(15,2) NOT NULL DEFAULT '0',
	`opportunity_nrr` decimal(15,2) NOT NULL DEFAULT '0',
	`total_mrr` decimal(15,2) NOT NULL DEFAULT '0',
	`total_mrc` decimal(15,2) NOT NULL DEFAULT '0',
	`total_nrc` decimal(15,2) NOT NULL DEFAULT '0',
	`total_nrr` decimal(15,2) NOT NULL DEFAULT '0',
	`irr` decimal(8,2) NOT NULL DEFAULT '0',
	`payback` int NOT NULL DEFAULT 36,
	`capex` decimal(15,2) NOT NULL DEFAULT '0',
	`subsidy` decimal(15,2) NOT NULL DEFAULT '0',
	`approved_budget` decimal(15,2) NOT NULL DEFAULT '0',
	`actual_spend` decimal(15,2) NOT NULL DEFAULT '0',
	`survey_deviation` decimal(8,2) NOT NULL DEFAULT '0',
	`nrv` decimal(15,2) NOT NULL DEFAULT '0',
	`tcv` decimal(15,2) NOT NULL DEFAULT '0',
	`exchange_rate_kes_usd` decimal(15,2) NOT NULL DEFAULT '130',
	`contract_term_months` int NOT NULL DEFAULT 12,
	`due` varchar(120) NOT NULL,
	`decision` enum('PENDING','PROCEED','SEEK FINANCE APPROVAL','PROCEED WITH SUBSIDY DISCLOSURE') NOT NULL DEFAULT 'PENDING',
	`certificate_issued` boolean NOT NULL DEFAULT false,
	`variance` decimal(8,2) NOT NULL DEFAULT '0',
	`revisions` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pboq_cost_lines` (
	`id` varchar(191) NOT NULL,
	`pboq_request_id` varchar(191) NOT NULL,
	`link_name` varchar(255) NOT NULL,
	`site_coordinates` varchar(255),
	`material` decimal(15,2) NOT NULL DEFAULT '0',
	`build` decimal(15,2) NOT NULL DEFAULT '0',
	`wayleave` decimal(15,2) NOT NULL DEFAULT '0',
	`pboq_document_id` varchar(191),
	`notes` text,
	`raw_record` json,
	CONSTRAINT `pboq_cost_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pboq_requests` (
	`id` varchar(191) NOT NULL,
	`opportunity_id` varchar(191) NOT NULL,
	`technology` enum('Fibre Ready','Fibre Entry','Wireless'),
	`site_count` int NOT NULL DEFAULT 0,
	`route_distance_km` decimal(10,2) NOT NULL DEFAULT '0',
	`survey_budget` decimal(15,2) NOT NULL DEFAULT '0',
	`survey_available` boolean NOT NULL DEFAULT false,
	`cost_source` enum('ACTUAL_SURVEY','PBOQ_ESTIMATE','FIBRE_READY') NOT NULL,
	`actual_survey_cost` decimal(15,2) NOT NULL DEFAULT '0',
	`notes` text,
	`fiber_planning_notes` text,
	`completed_at` datetime,
	`bc_preparation_draft` json,
	CONSTRAINT `pboq_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_documents` (
	`id` varchar(191) NOT NULL,
	`opportunity_id` varchar(191) NOT NULL,
	`type` enum('LSO','BC_TEMPLATE','PBOQ','ACTUAL_SURVEY_QUOTE','CONTRACTOR_QUOTE','ORDER_FORM','BC_APPROVAL_CERTIFICATE') NOT NULL,
	`name` varchar(255) NOT NULL,
	`mime_type` varchar(255) NOT NULL,
	`size_bytes` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_links` (
	`id` varchar(191) NOT NULL,
	`opportunity_id` varchar(191) NOT NULL,
	`link_name` varchar(255) NOT NULL,
	`service` varchar(80) NOT NULL,
	`technology` varchar(120) NOT NULL,
	`onnet_offnet` enum('Onnet','Offnet'),
	`cost_source` enum('PBOQ','Fibre Ready','Actual Survey','3rd Party Quote'),
	`new_build_cost` decimal(15,2) NOT NULL DEFAULT '0',
	`provisioning_cost` decimal(15,2) NOT NULL DEFAULT '0',
	`material_cost` decimal(15,2) NOT NULL DEFAULT '0',
	`wayleave_cost` decimal(15,2) NOT NULL DEFAULT '0',
	`mrr` decimal(15,2) NOT NULL DEFAULT '0',
	`mrc` decimal(15,2) NOT NULL DEFAULT '0',
	`nrc` decimal(15,2) NOT NULL DEFAULT '0',
	`nrr` decimal(15,2) NOT NULL DEFAULT '0',
	`nrv` decimal(15,2) NOT NULL DEFAULT '0',
	`tcv` decimal(15,2) NOT NULL DEFAULT '0',
	`onnet_capacity` varchar(120),
	`offnet_capacity` varchar(120),
	`evidence_document_id` varchar(191),
	CONSTRAINT `project_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bc_approval_certificates` ADD CONSTRAINT `bc_approval_certificates_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_decisions` ADD CONSTRAINT `finance_decisions_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pboq_cost_lines` ADD CONSTRAINT `pboq_cost_lines_pboq_request_id_pboq_requests_id_fk` FOREIGN KEY (`pboq_request_id`) REFERENCES `pboq_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pboq_requests` ADD CONSTRAINT `pboq_requests_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_documents` ADD CONSTRAINT `project_documents_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_links` ADD CONSTRAINT `project_links_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bc_approval_certificates_opportunity_idx` ON `bc_approval_certificates` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `finance_decisions_opportunity_idx` ON `finance_decisions` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `opportunities_role_queue_idx` ON `opportunities` (`role_queue`);--> statement-breakpoint
CREATE INDEX `opportunities_state_idx` ON `opportunities` (`state`);--> statement-breakpoint
CREATE INDEX `opportunities_updated_at_idx` ON `opportunities` (`updated_at`);--> statement-breakpoint
CREATE INDEX `pboq_cost_lines_request_idx` ON `pboq_cost_lines` (`pboq_request_id`);--> statement-breakpoint
CREATE INDEX `pboq_requests_opportunity_idx` ON `pboq_requests` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `project_documents_opportunity_idx` ON `project_documents` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `project_documents_type_idx` ON `project_documents` (`type`);--> statement-breakpoint
CREATE INDEX `project_links_opportunity_idx` ON `project_links` (`opportunity_id`);