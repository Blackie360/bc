import { redirect } from "next/navigation";
import { RoleRoutesIndex } from "@/components/workflow/role-routes";
import { listLdapDirectoryUsers } from "@/lib/auth/ldap";
import { getCurrentUserEmail } from "@/lib/current-user";
import { listProjectsForPage } from "@/lib/projects";
import { getAssignedRoleForEmail, listRoleAssignmentsByRole } from "@/lib/role-assignments";
import { roleSlug } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentEmail = await getCurrentUserEmail();
  const assignedRole = await getAssignedRoleForEmail(currentEmail ?? undefined);

  if (assignedRole) {
    redirect(`/roles/${roleSlug(assignedRole)}`);
  }

  const [projectResult, roleAssignments, directoryResult] = await Promise.all([
    listProjectsForPage(),
    listRoleAssignmentsByRole(),
    listLdapDirectoryUsers()
      .then((users) => ({ users, dataUnavailable: false }))
      .catch((error) => {
        console.error("Failed to load LDAP directory users.", error);

        return { users: [], dataUnavailable: true };
      }),
  ]);

  return (
    <RoleRoutesIndex
      projects={projectResult.projects}
      dataUnavailable={projectResult.dataUnavailable}
      directoryUsers={directoryResult.users}
      directoryUnavailable={directoryResult.dataUnavailable}
      roleAssignments={roleAssignments}
    />
  );
}
