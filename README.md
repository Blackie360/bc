# Business Case Workflow OS

A Next.js workflow console for routing Business Case projects through role-specific approval, validation, implementation, cost capture, and reporting stages.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Drizzle/Postgres tooling
- Zod validation
- Lucide icons

## Project Lifecycle

The workflow is modeled in `lib/workflow.ts`:

1. Opportunity Created
2. PBOQ Request Submitted
3. Fiber Planning Generates Costs
4. Business Case Prepared
5. System Computes Financial Metrics
6. Approval Routing Engine
7. Finance / CFO Approval
8. Sales Operations Validation
9. SDU Validation
10. Survey & Site Acquisition
11. Contractor Implementation
12. Actual Cost Capture
13. Budget vs Actual Analysis
14. Project Closure & Reporting

## Roles

The system currently supports 9 roles:

- Account Manager
- Fiber Planning Team
- BC Analyst / Finance
- CFO
- Sales Operations
- SDU
- Site Acquisition Manager
- Project Manager
- Contractor

Each role has a dedicated browser route under `/roles`.

## Browser Routes

Start from:

```text
http://localhost:3000/
http://localhost:3000/roles
http://localhost:3000/lifecycle
http://localhost:3000/projects
```

Project CRUD routes:

```text
http://localhost:3000/projects
http://localhost:3000/projects/new
http://localhost:3000/projects/{id}
http://localhost:3000/projects/{id}/edit
http://localhost:3000/projects/{id}/delete
```

Role-specific routes:

```text
http://localhost:3000/roles/account-manager
http://localhost:3000/roles/fiber-planning-team
http://localhost:3000/roles/bc-analyst-finance
http://localhost:3000/roles/cfo
http://localhost:3000/roles/sales-operations
http://localhost:3000/roles/sdu
http://localhost:3000/roles/site-acquisition-manager
http://localhost:3000/roles/project-manager
http://localhost:3000/roles/contractor
```

Lifecycle stage routes:

```text
http://localhost:3000/lifecycle/opportunity-created
http://localhost:3000/lifecycle/pboq-request-submitted
http://localhost:3000/lifecycle/fiber-planning-generates-costs
http://localhost:3000/lifecycle/business-case-prepared
http://localhost:3000/lifecycle/system-computes-financial-metrics
http://localhost:3000/lifecycle/approval-routing-engine
http://localhost:3000/lifecycle/finance-cfo-approval
http://localhost:3000/lifecycle/sales-operations-validation
http://localhost:3000/lifecycle/sdu-validation
http://localhost:3000/lifecycle/survey-and-site-acquisition
http://localhost:3000/lifecycle/contractor-implementation
http://localhost:3000/lifecycle/actual-cost-capture
http://localhost:3000/lifecycle/budget-vs-actual-analysis
http://localhost:3000/lifecycle/project-closure-and-reporting
```

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already in use, Next.js will print the alternate local URL.

## Validation

Run lint:

```bash
pnpm lint
```

Run a production build:

```bash
pnpm build
```

Capture screenshots for the homepage, role routes, lifecycle dashboard, and all lifecycle stages:

```bash
pnpm screenshots
```

By default screenshots are captured from `http://localhost:3000`. To use another server:

```bash
BASE_URL=http://localhost:3002 pnpm screenshots
```

## Database Commands

The app is set up for MySQL through Drizzle ORM. Copy `.env.example` to `.env`
and set `DATABASE_URL` to a MySQL connection string, for example:

```bash
DATABASE_URL="mysql://bc_user:bc_password@localhost:3306/bc"
```

The package scripts include Drizzle commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

Configure the required database environment variables before running migrations or studio.
The current schema is defined in `db/schema.ts` and the server-only connection helper is in `db/index.ts`.
Project CRUD still uses the existing local persistence layer until the migration step is wired in.

## LDAP Configuration

LDAP-backed login and role allocation use these environment variables:

```bash
LDAP_PRIMARY_HOSTS="ldap://ad.example.com:389"
LDAP_PRIMARY_BASE_DN="DC=example,DC=com"
LDAP_PRIMARY_USERNAME="CN=ldap-reader,OU=Service Accounts,DC=example,DC=com"
LDAP_PRIMARY_PASSWORD="change-me"
```

Use `ldaps://host:636` if your directory requires LDAPS. Multiple hosts can be separated with commas.

The role allocation page also reads directory users for the AD email dropdown. In local development, if the LDAP server is only reachable on the corporate network or VPN, disable that directory lookup and provide fallback email suggestions:

```bash
LDAP_DIRECTORY_LOOKUP_ENABLED="false"
ROLE_ASSIGNMENT_EMAIL_OPTIONS="user@liquid.tech;another.user@liquid.tech"
```

By default only `@liquid.tech` email addresses are available for role allocation. You can tune slow directory connections with `LDAP_CONNECT_TIMEOUT_MS`, `LDAP_TIMEOUT_MS`, and `LDAP_DIRECTORY_USER_SIZE_LIMIT`.
If your AD emails use multiple domains, set `LDAP_DIRECTORY_EMAIL_DOMAINS` (comma, space, or semicolon separated), for example: `LDAP_DIRECTORY_EMAIL_DOMAINS="liquid.tech;liquidtelecom.co.ke"`.

The MySQL schema includes:

- `Opportunity` for project identity, customer, stage, region, and owner
- `PboqRequest` and `PboqCostLine` for planning handoff and cost capture
- `ProjectLink` for prepared BC link pricing and capacity
- `ProjectDocument` for uploaded document metadata
- `FinanceDecision` and `BcApprovalCertificate` for approval history
- dependent records cascade when an opportunity is removed

## Important Files

- `lib/workflow.ts` - roles, lifecycle states, routing rules, and route slugs
- `app/page.tsx` - root route rendering the role route dashboard
- `app/roles/page.tsx` - all role routes
- `app/roles/[role]/page.tsx` - dynamic role-specific route
- `app/lifecycle/page.tsx` - lifecycle dashboard
- `app/lifecycle/[stage]/page.tsx` - dynamic lifecycle stage route
- `app/projects/page.tsx` - project register and CRUD entry point
- `app/projects/new/page.tsx` - create form
- `app/projects/[id]/page.tsx` - project detail
- `app/projects/[id]/edit/page.tsx` - update form
- `app/projects/[id]/delete/page.tsx` - delete confirmation
- `components/workflow/role-routes.tsx` - themed role route UI
- `components/workflow/lifecycle-routes.tsx` - themed lifecycle stage UI
- `components/workflow/project-form.tsx` - shared create/update form
- `lib/projects.ts` - Drizzle-backed project data access and validation
- `components/ui/*` - shared UI primitives
- `scripts/capture-lifecycle-screenshots.mjs` - Playwright screenshot capture script
