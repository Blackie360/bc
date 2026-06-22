import { notFound } from "next/navigation";
import {
  certificateFileName,
  renderBcApprovalCertificatePdf,
} from "@/lib/bc-approval-certificate";
import { getProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project?.certificate) {
    notFound();
  }

  const fileName = certificateFileName(project);
  const disposition = new URL(request.url).searchParams.has("download")
    ? "attachment"
    : "inline";

  return new Response(renderBcApprovalCertificatePdf(project), {
    headers: {
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
