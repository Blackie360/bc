import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createBcSubmissionAction } from "@/app/projects/actions";
import { Button } from "@/components/ui/button";
import { AdminShell, ShellHeading } from "@/components/workflow/admin-shell";
import { BcSubmissionForm } from "@/components/workflow/bc-submission-form";
import { lifecycleStages, roleRoutes } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <AdminShell
      code="BC"
      title="Account Manager"
      subtitle="BC submission"
      badgeLabel="AM"
      primaryActive="projects"
      workflowLinks={[
        ...roleRoutes.map((route) => ({ href: route.href, label: route.role })),
        ...lifecycleStages.slice(0, 5).map((stage) => ({
          href: stage.href,
          label: `${stage.index + 1}. ${stage.state}`,
        })),
      ]}
    >
      <ShellHeading
        title="Account Manager BC Submission"
        subtitle="Capture opportunity details, link items, evidence, and submit to finance."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Projects
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-4 px-6 pb-8 pt-6">
        <BcSubmissionForm action={createBcSubmissionAction} />
      </div>
    </AdminShell>
  );
}
