import type { Role } from "@/lib/workflow";
import { roles } from "@/lib/workflow";

export const AUTH_COOKIE_NAME = "bc_auth_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type AuthSession = {
  username: string;
  displayName: string;
  email?: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
};

const textEncoder = new TextEncoder();

function sessionSecret() {
  const secret = process.env.BC_AUTH_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("Set BC_AUTH_SECRET or JWT_SECRET before using login sessions.");
  }

  return secret;
}

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string"
      ? textEncoder.encode(value)
      : new Uint8Array(value);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signatureFor(payload: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    textEncoder.encode(payload),
  );

  return base64UrlEncode(signature);
}

function signaturesMatch(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function parseSessionRole(value: unknown): Role | null {
  if (typeof value !== "string") {
    return null;
  }

  return roles.find((role) => role === value) ?? null;
}

function parseSessionPayload(value: unknown): AuthSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<AuthSession>;
  const role = parseSessionRole(payload.role);

  if (
    typeof payload.username !== "string" ||
    typeof payload.displayName !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number" ||
    !role
  ) {
    return null;
  }

  return {
    username: payload.username,
    displayName: payload.displayName,
    email: typeof payload.email === "string" ? payload.email : undefined,
    role,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export async function createSessionCookieValue(input: {
  username: string;
  displayName: string;
  email?: string;
  role: Role;
}) {
  const now = Date.now();
  const payload = base64UrlEncode(JSON.stringify({
    ...input,
    issuedAt: now,
    expiresAt: now + AUTH_SESSION_MAX_AGE_SECONDS * 1000,
  }));

  return `${payload}.${await signatureFor(payload)}`;
}

export async function verifySessionCookie(value: string | undefined): Promise<AuthSession | null> {
  if (!value) {
    return null;
  }

  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) {
    return null;
  }

  if (!signaturesMatch(signature, await signatureFor(payload))) {
    return null;
  }

  try {
    const session = parseSessionPayload(JSON.parse(base64UrlDecode(payload)));
    if (!session || session.expiresAt <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
