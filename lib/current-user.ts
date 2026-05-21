import "server-only";

import { headers } from "next/headers";
import { roleSlug, roles, type Role } from "@/lib/workflow";

/** Set by auth middleware or a reverse proxy once sign-in exists. */
const DISPLAY_NAME_HEADER = "x-bc-user-display-name";
const ROLE_HEADER = "x-bc-user-role";
const LOCAL_DEV_DEFAULT_ROLE: Role = "Account Manager";

function parseRole(value: string | null | undefined): Role | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    roles.find(
      (role) => role.toLowerCase() === normalized || roleSlug(role) === normalized,
    ) ?? null
  );
}

/**
 * Display name for the current submitter. Until auth is wired up, set
 * `BC_APP_USER_DISPLAY_NAME` in the environment (see `.env`).
 */
export async function getCurrentUserDisplayName(): Promise<string> {
  const headerName = (await headers()).get(DISPLAY_NAME_HEADER)?.trim();
  if (headerName && headerName.length >= 2) {
    return headerName;
  }

  const fromEnv = process.env.BC_APP_USER_DISPLAY_NAME?.trim();
  if (fromEnv && fromEnv.length >= 2) {
    return fromEnv;
  }

  return "Current User";
}

/**
 * Role for the current submitter. This must be supplied by auth middleware,
 * a trusted reverse proxy, or `BC_APP_USER_ROLE` during local development.
 */
export async function getCurrentUserRole(): Promise<Role | null> {
  const headerRole = parseRole((await headers()).get(ROLE_HEADER));
  if (headerRole) {
    return headerRole;
  }

  const envRole = parseRole(process.env.BC_APP_USER_ROLE);
  if (envRole) {
    return envRole;
  }

  if (process.env.NODE_ENV === "development") {
    return LOCAL_DEV_DEFAULT_ROLE;
  }

  return null;
}
