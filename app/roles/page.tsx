import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RoleRoutesIndex } from "@/components/workflow/role-routes";
import { listLdapDirectoryUsers } from "@/lib/auth/ldap";
import { AUTH_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";
import { listProjectsForPage } from "@/lib/projects";
import { getAssignedRoleForEmail, listRoleAssignmentsByRole } from "@/lib/role-assignments";
import { roleSlug } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const ROLE_ASSIGNMENT_RETURN_COOKIE = "bc_role_assignment_admin_return";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ roleAssignment?: string; email?: string }>;
}) {
  const [query, cookieStore] = await Promise.all([
    searchParams,
    cookies(),
  ]);
  const session = await verifySessionCookie(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  const assignedRole = await getAssignedRoleForEmail(session?.email);
  const isReturningFromRoleAssignment =
    Boolean(query.roleAssignment) &&
    cookieStore.get(ROLE_ASSIGNMENT_RETURN_COOKIE)?.value === "1";

  if (assignedRole && !isReturningFromRoleAssignment) {
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
      roleAssignmentStatus={query.roleAssignment}
      invalidAssignmentEmail={query.email}
    />
  );
}
