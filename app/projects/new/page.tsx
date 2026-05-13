import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createPboqRequestAction } from "@/app/projects/actions";
import { Button } from "@/components/ui/button";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { PboqRequestForm } from "@/components/workflow/pboq-workflow-forms";
import { getCurrentUserDisplayName } from "@/lib/current-user";
import { roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const accountManagerDisplayName = await getCurrentUserDisplayName();
  const accountManagerRoute = roleRoutes.find((route) => route.role === "Account Manager");
  const accountManagerDashboardHref = accountManagerRoute?.href ?? "/roles/account-manager";
  const accountManagerProjectsHref = `/projects?role=${accountManagerRoute?.slug ?? "account-manager"}`;

  return (
    <AdminShell
      code="AM"
      title="Account Manager"
      subtitle="BC submission"
      badgeLabel="Account Manager"
      primaryActive="projects"
      workflowLinks={[]}
      showWorkflowLinks={false}
      dashboardHref={accountManagerDashboardHref}
      projectsHref={accountManagerProjectsHref}
    >
      <ShellHeading
        title="Account Manager PBOQ Request"
        subtitle="Create the opportunity, attach Solution Design, and send the request to Fiber Planning."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={accountManagerProjectsHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Projects
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-4 px-6 pb-8 pt-6">
        <PboqRequestForm
          action={createPboqRequestAction}
          accountManagerDisplayName={accountManagerDisplayName}
        />
      </div>
    </AdminShell>
  );
}
