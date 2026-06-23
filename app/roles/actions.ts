"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedDirectoryEmail, listLdapDirectoryUsers } from "@/lib/auth/ldap";
import { saveRoleAssignment } from "@/lib/role-assignments";
import { roleSlug, roles } from "@/lib/workflow";

const ROLE_ASSIGNMENT_RETURN_COOKIE = "bc_role_assignment_admin_return";

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseRole(value: string) {
  return roles.find((role) => roleSlug(role) === value || role.toLowerCase() === value) ?? null;
}

function fallbackUserForEmail(email: string) {
  const result = z.string().email().safeParse(email);
  if (!result.success || !isAllowedDirectoryEmail(result.data)) {
    return null;
  }

  return {
    email: result.data.toLowerCase(),
    displayName: result.data,
    username: result.data,
  };
}

async function markRoleAssignmentReturn() {
  (await cookies()).set({
    name: ROLE_ASSIGNMENT_RETURN_COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/roles",
    maxAge: 60,
  });
}

async function redirectToRoleAssignmentStatus(path: string): Promise<never> {
  await markRoleAssignmentReturn();
  redirect(path);
}

export async function saveRoleAssignmentAction(formData: FormData) {
  const role = parseRole(textField(formData, "role"));
  if (!role) {
    return await redirectToRoleAssignmentStatus("/roles?roleAssignment=invalid-role");
  }

  const email = textField(formData, "email");
  if (!email) {
    return await redirectToRoleAssignmentStatus("/roles?roleAssignment=invalid");
  }

  const directoryUsers = await listLdapDirectoryUsers().catch((error) => {
    console.error("LDAP directory users unavailable while saving role assignment.", error);

    return [];
  });
  const usersByEmail = new Map(directoryUsers.map((user) => [user.email, user]));
  const user = usersByEmail.get(email) ?? fallbackUserForEmail(email);
  if (!user) {
    return await redirectToRoleAssignmentStatus(`/roles?roleAssignment=invalid&email=${encodeURIComponent(email)}`);
  }

  await saveRoleAssignment(role, {
    email: user.email,
    displayName: user.displayName,
    username: user.username,
  });

  revalidatePath("/roles");
  for (const role of roles) {
    revalidatePath(`/roles/${roleSlug(role)}`);
  }

  return await redirectToRoleAssignmentStatus("/roles?roleAssignment=saved");
}
