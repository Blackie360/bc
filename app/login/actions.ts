"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateWithLdap } from "@/lib/auth/ldap";
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_SECONDS,
  createSessionCookieValue,
} from "@/lib/auth/session";
import { getAssignedRoleForEmail } from "@/lib/role-assignments";
import { roleSlug, type Role } from "@/lib/workflow";

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function safeRedirect(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/roles";
  }

  if (value.startsWith("/login")) {
    return "/roles";
  }

  return value;
}

function roleDashboardHref(role: Role) {
  return `/roles/${roleSlug(role)}`;
}

function isGenericLandingPath(value: string) {
  return value === "/" || value === "/roles" || value === "/projects";
}

export async function loginAction(formData: FormData) {
  const username = textField(formData, "username");
  const password = textField(formData, "password");
  let next = safeRedirect(textField(formData, "next"));

  try {
    const user = await authenticateWithLdap(username, password);
    const cookieStore = await cookies();
    const assignedRole = await getAssignedRoleForEmail(user.email);
    const sessionUser = {
      ...user,
      role: assignedRole ?? user.role,
    };

    if (assignedRole && isGenericLandingPath(next)) {
      next = roleDashboardHref(assignedRole);
    }

    cookieStore.set({
      name: AUTH_COOKIE_NAME,
      value: await createSessionCookieValue(sessionUser),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Login failed", error);
    }

    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect("/login");
}
