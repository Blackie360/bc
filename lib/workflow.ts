import { z } from "zod";

export const roles = [
  "Account Manager",
  "Fiber Planning Team",
  "Wireless Planning Team",
  "Solutions Architect",
  "Solutions Engineer",
  "BC Analyst / Finance",
  "CFO",
  "Sales Operations",
  "SDU",
  "Site Acquisition Manager",
  "Project Manager",
  "Contractor",
] as const;

export const workflowStates = [
  "Opportunity Created",
  "PBOQ Request Submitted",
  "Fiber Planning Generates Costs",
  "Wireless Planning Generates Costs",
  "Business Case Prepared",
  "System Computes Financial Metrics",
  "Approval Routing Engine",
  "Finance / CFO Approval",
  "Sales Operations Validation",
  "SDU Validation",
  "Survey & Site Acquisition",
  "Contractor Implementation",
  "Actual Cost Capture",
  "Budget vs Actual Analysis",
  "Project Closure & Reporting",
] as const;

export type Role = (typeof roles)[number];
export type WorkflowState = (typeof workflowStates)[number];
export type BusinessCaseType = "Ordinary BC" | "Margin Analysis BC";
export type DecisionOutput =
  | "PROCEED"
  | "SEEK FINANCE APPROVAL"
  | "PROCEED WITH SUBSIDY DISCLOSURE";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll("/", "")
    .replaceAll("&", "and")
    .replaceAll(/\s+/g, "-");
}

export function roleSlug(role: Role) {
  return slugify(role);
}

export const opportunitySchema = z.object({
  customerName: z.string().min(2),
  opportunityName: z.string().min(3),
  region: z.string().min(2),
  segment: z.string().min(2),
  targetInstallDate: z.string().optional(),
});

export const pboqSchema = z.object({
  routeDistanceKm: z.coerce.number().positive(),
  siteCount: z.coerce.number().int().positive(),
  surveyBudget: z.coerce.number().nonnegative(),
  solutionDesignUpload: z.string().min(1, "Solution Design upload is mandatory"),
});

export const businessCaseSchema = z.object({
  type: z.enum(["Ordinary BC", "Margin Analysis BC"]),
  irr: z.coerce.number(),
  paybackMonths: z.coerce.number().int().positive(),
  capex: z.coerce.number().nonnegative(),
  subsidyRequirement: z.coerce.number().nonnegative(),
  approvedBudget: z.coerce.number().nonnegative(),
});

export function deriveDecision(input: {
  irr: number;
  paybackMonths: number;
  subsidyRequirement: number;
  capex: number;
}): { decision: DecisionOutput; requiresCfo: boolean; reason: string } {
  if (input.subsidyRequirement > 0) {
    return {
      decision: "PROCEED WITH SUBSIDY DISCLOSURE",
      requiresCfo: input.subsidyRequirement >= 100000 || input.capex >= 750000,
      reason: "Subsidy disclosure is mandatory before approval certificate issue.",
    };
  }

  if (input.irr < 18 || input.paybackMonths > 36) {
    return {
      decision: "SEEK FINANCE APPROVAL",
      requiresCfo: input.irr < 12 || input.capex >= 750000,
      reason: "Finance approval is required because return thresholds are below policy.",
    };
  }

  return {
    decision: "PROCEED",
    requiresCfo: input.capex >= 750000,
    reason: "Financial metrics meet ordinary approval thresholds.",
  };
}

export const workflowTransitions = [
  {
    from: "Opportunity Created",
    to: "PBOQ Request Submitted",
    owner: "Account Manager",
    rule: "Customer, scope, region, and segment are captured before PBOQ submission.",
  },
  {
    from: "PBOQ Request Submitted",
    to: "Fiber Planning Generates Costs",
    owner: "Fiber Planning Team",
    rule: "Fibre projects are routed to Fiber Planning for cost generation.",
  },
  {
    from: "PBOQ Request Submitted",
    to: "Wireless Planning Generates Costs",
    owner: "Wireless Planning Team",
    rule: "Wireless projects are routed to Wireless Planning for cost generation.",
  },
  {
    from: "Fiber Planning Generates Costs",
    to: "Business Case Prepared",
    owner: "BC Analyst / Finance",
    rule: "PBOQ cost pack, survey budget, and planning assumptions are returned.",
  },
  {
    from: "Wireless Planning Generates Costs",
    to: "Business Case Prepared",
    owner: "BC Analyst / Finance",
    rule: "PBOQ cost pack, survey budget, and planning assumptions are returned.",
  },
  {
    from: "Business Case Prepared",
    to: "System Computes Financial Metrics",
    owner: "BC Analyst / Finance",
    rule: "Ordinary BC or Margin Analysis BC is prepared with required commercial inputs.",
  },
  {
    from: "System Computes Financial Metrics",
    to: "Approval Routing Engine",
    owner: "BC Analyst / Finance",
    rule: "IRR, payback, capex, subsidy, and approved budget metrics are computed.",
  },
  {
    from: "Approval Routing Engine",
    to: "Finance / CFO Approval",
    owner: "CFO",
    rule: "Route subsidy cases of USD 3,000 or more to Finance or CFO when approval thresholds require review.",
  },
  {
    from: "Approval Routing Engine",
    to: "Sales Operations Validation",
    owner: "Sales Operations",
    rule: "Route subsidy cases below USD 3,000 directly to Sales Operations for certificate and approval trail validation.",
  },
  {
    from: "Finance / CFO Approval",
    to: "Sales Operations Validation",
    owner: "Sales Operations",
    rule: "Approved finance cases move to Sales Operations for certificate and approval trail validation.",
  },
  {
    from: "Finance / CFO Approval",
    to: "Finance / CFO Approval",
    owner: "BC Analyst / Finance",
    rule: "Rejected finance cases remain in the Finance queue for follow-up with documented rejection reasons.",
  },
  {
    from: "Finance / CFO Approval",
    to: "Business Case Prepared",
    owner: "Solutions Architect",
    rule: "Finance cases with design questions are redirected to the Solutions Architect for clarification.",
  },
  {
    from: "Finance / CFO Approval",
    to: "Finance / CFO Approval",
    owner: "CFO",
    rule: "Finance cases needing executive judgement are escalated to the CFO with documented escalation reasons.",
  },
  {
    from: "Sales Operations Validation",
    to: "SDU Validation",
    owner: "SDU",
    rule: "Validate BC, Order, and technical details before implementation initiation.",
  },
  {
    from: "SDU Validation",
    to: "Survey & Site Acquisition",
    owner: "Site Acquisition Manager",
    rule: "Alignment is confirmed and survey cost is within threshold.",
  },
  {
    from: "SDU Validation",
    to: "Finance / CFO Approval",
    owner: "SDU",
    rule: "Mismatch or oversight is returned to Finance with SDU justification.",
  },
  {
    from: "SDU Validation",
    to: "Business Case Prepared",
    owner: "SDU",
    rule: "Survey cost deviation exceeds threshold and requires a revised BC from the Account Manager.",
  },
  {
    from: "Survey & Site Acquisition",
    to: "Contractor Implementation",
    owner: "Project Manager",
    rule: "Release the validated delivery pack to implementation and coordinate contractor readiness.",
  },
  {
    from: "Contractor Implementation",
    to: "Actual Cost Capture",
    owner: "Contractor",
    rule: "Complete implementation and submit actual cost evidence.",
  },
  {
    from: "Actual Cost Capture",
    to: "Budget vs Actual Analysis",
    owner: "BC Analyst / Finance",
    rule: "Variance and survey deviation checks are complete.",
  },
  {
    from: "Budget vs Actual Analysis",
    to: "Project Closure & Reporting",
    owner: "BC Analyst / Finance",
    rule: "Final reporting closes the project with budget, actuals, variance, and audit trail.",
  },
] satisfies {
  from: WorkflowState;
  to: WorkflowState;
  owner: Role;
  rule: string;
}[];

export const roleRoutes = roles.map((role) => {
  const transitions = workflowTransitions.filter(
    (transition) => transition.owner === role,
  );

  return {
    role,
    slug: roleSlug(role),
    href: `/roles/${roleSlug(role)}`,
    transitions,
  };
});

export function getRoleRoute(slug: string) {
  return roleRoutes.find((route) => route.slug === slug);
}

export const lifecycleStages = workflowStates.map((state, index) => {
  const incoming = workflowTransitions.find((transition) => transition.to === state);
  const outgoing = workflowTransitions.find((transition) => transition.from === state);

  return {
    state,
    slug: slugify(state),
    index,
    owner: incoming?.owner ?? outgoing?.owner ?? "BC Analyst / Finance",
    incoming,
    outgoing,
  };
});

export function getLifecycleStage(slug: string) {
  return lifecycleStages.find((stage) => stage.slug === slug);
}

export function getLifecycleStagesForRole(role: Role) {
  return lifecycleStages.filter(
    (stage) => stage.owner === role || stage.incoming?.owner === role || stage.outgoing?.owner === role,
  );
}
