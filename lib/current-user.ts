import "server-only";

import { headers } from "next/headers";

/** Set by auth middleware or a reverse proxy once sign-in exists. */
const DISPLAY_NAME_HEADER = "x-bc-user-display-name";

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
