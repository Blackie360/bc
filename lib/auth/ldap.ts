import "server-only";

import { Client, type Entry, type SearchOptions } from "ldapts";
import { getAssignedRoleForEmail } from "@/lib/role-assignments";
import { roleSlug, roles, type Role } from "@/lib/workflow";

export type LdapAuthenticatedUser = {
  username: string;
  displayName: string;
  email?: string;
  role: Role;
};

export type LdapDirectoryUser = {
  username: string;
  displayName: string;
  email: string;
};

const DEFAULT_USER_FILTER =
  "(&(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})(mail={{username}})))";
const DEFAULT_DIRECTORY_USER_FILTER =
  "(&(|(objectClass=user)(objectClass=person))(|(mail=*)(userPrincipalName=*)(proxyAddresses=SMTP:*)))";
const DEFAULT_ROLE: Role = "Account Manager";
const DIRECTORY_EMAIL_DOMAIN = "liquid.tech";

function ldapHosts() {
  const hosts = process.env.LDAP_PRIMARY_HOSTS?.split(/[,\s;]+/)
    .map((host) => host.trim())
    .filter(Boolean);

  if (!hosts || hosts.length === 0) {
    throw new Error("LDAP_PRIMARY_HOSTS is required.");
  }

  return hosts;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function ldapFilterEscape(value: string) {
  return value.replaceAll(/[\0()*\\]/g, (character) => {
    switch (character) {
      case "\0":
        return "\\00";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      case "*":
        return "\\2a";
      case "\\":
        return "\\5c";
      default:
        return character;
    }
  });
}

function userFilter(username: string) {
  return (process.env.LDAP_USER_FILTER?.trim() || DEFAULT_USER_FILTER).replaceAll(
    "{{username}}",
    ldapFilterEscape(username),
  );
}

function stringValues(entry: Entry, attribute: string) {
  const value = entry[attribute];
  const values = Array.isArray(value) ? value : [value];

  return values
    .filter((item): item is Buffer | string => typeof item === "string" || Buffer.isBuffer(item))
    .map((item) => item.toString().trim())
    .filter(Boolean);
}

function firstString(entry: Entry, ...attributes: string[]) {
  for (const attribute of attributes) {
    const [value] = stringValues(entry, attribute);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function emailFromProxyAddresses(entry: Entry) {
  return stringValues(entry, "proxyAddresses")
    .map((value) => value.match(/^SMTP:(.+)$/i)?.[1]?.trim().toLowerCase())
    .find((value): value is string => Boolean(value));
}

export function isAllowedDirectoryEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${DIRECTORY_EMAIL_DOMAIN}`);
}

function parseRole(value: string | undefined) {
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

function defaultRole() {
  return parseRole(process.env.BC_AUTH_DEFAULT_ROLE) ??
    parseRole(process.env.BC_APP_USER_ROLE) ??
    DEFAULT_ROLE;
}

function roleMappings() {
  return (process.env.LDAP_ROLE_GROUP_MAP ?? "")
    .split(/[;\n]+/)
    .map((mapping) => {
      const [rawRole, ...rawNeedle] = mapping.split("=");
      const role = parseRole(rawRole);
      const needle = rawNeedle.join("=").trim().toLowerCase();

      return role && needle ? { role, needle } : null;
    })
    .filter((mapping): mapping is { role: Role; needle: string } => mapping !== null);
}

function roleFromEntry(entry: Entry) {
  const roleAttribute = process.env.LDAP_ROLE_ATTRIBUTE?.trim() || "memberOf";
  const values = stringValues(entry, roleAttribute).map((value) => value.toLowerCase());

  for (const mapping of roleMappings()) {
    if (values.some((value) => value.includes(mapping.needle))) {
      return mapping.role;
    }
  }

  return defaultRole();
}

async function findUser(client: Client, username: string) {
  const options: SearchOptions = {
    scope: "sub",
    sizeLimit: 1,
    filter: userFilter(username),
    attributes: [
      "dn",
      "cn",
      "mail",
      "memberOf",
      "displayName",
      "proxyAddresses",
      "sAMAccountName",
      "userPrincipalName",
      process.env.LDAP_ROLE_ATTRIBUTE?.trim() || "memberOf",
    ],
  };
  const result = await client.search(requiredEnv("LDAP_PRIMARY_BASE_DN"), options);

  return result.searchEntries[0];
}

function directoryUserFilter() {
  return process.env.LDAP_DIRECTORY_USER_FILTER?.trim() || DEFAULT_DIRECTORY_USER_FILTER;
}

function directoryUserSearchLimit() {
  const configuredLimit = Number(process.env.LDAP_DIRECTORY_USER_SIZE_LIMIT ?? 200);

  return Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 200;
}

function directoryUserFromEntry(entry: Entry): LdapDirectoryUser | null {
  const email = firstString(entry, "mail", "userPrincipalName")?.toLowerCase() ??
    emailFromProxyAddresses(entry);
  if (!email || !isAllowedDirectoryEmail(email)) {
    return null;
  }

  return {
    username: firstString(entry, "sAMAccountName", "userPrincipalName") ?? email,
    displayName: firstString(entry, "displayName", "cn") ?? email,
    email,
  };
}

function configuredDirectoryUsers() {
  return (process.env.ROLE_ASSIGNMENT_EMAIL_OPTIONS ?? "")
    .split(/[,\n;]+/)
    .map((rawEmail) => rawEmail.trim().toLowerCase())
    .filter(isAllowedDirectoryEmail)
    .map((email) => ({
      username: email,
      displayName: email,
      email,
    }));
}

function isDirectoryLookupEnabled() {
  return process.env.LDAP_DIRECTORY_LOOKUP_ENABLED?.trim().toLowerCase() !== "false";
}

async function listDirectoryUsersAgainstHost(host: string) {
  const client = new Client({
    url: host,
    timeout: Number(process.env.LDAP_TIMEOUT_MS ?? 8000),
    connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT_MS ?? 5000),
  });

  try {
    await client.bind(
      requiredEnv("LDAP_PRIMARY_USERNAME"),
      requiredEnv("LDAP_PRIMARY_PASSWORD"),
    );

    const options: SearchOptions = {
      scope: "sub",
      sizeLimit: directoryUserSearchLimit(),
      filter: directoryUserFilter(),
      attributes: [
        "cn",
        "mail",
        "displayName",
        "proxyAddresses",
        "sAMAccountName",
        "userPrincipalName",
      ],
    };
    const result = await client.search(requiredEnv("LDAP_PRIMARY_BASE_DN"), options);

    return result.searchEntries
      .map(directoryUserFromEntry)
      .filter((user): user is LdapDirectoryUser => user !== null);
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

export async function listLdapDirectoryUsers(): Promise<LdapDirectoryUser[]> {
  let lastError: unknown;
  const configuredUsers = configuredDirectoryUsers();

  if (!isDirectoryLookupEnabled()) {
    return configuredUsers;
  }

  for (const host of ldapHosts()) {
    try {
      const usersByEmail = new Map<string, LdapDirectoryUser>();

      for (const user of configuredUsers) {
        usersByEmail.set(user.email, user);
      }

      for (const user of await listDirectoryUsersAgainstHost(host)) {
        usersByEmail.set(user.email, user);
      }

      return Array.from(usersByEmail.values()).sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      );
    } catch (error) {
      lastError = error;
    }
  }

  console.error("LDAP directory search failed", lastError);
  if (configuredUsers.length > 0) {
    return configuredUsers;
  }

  throw new Error("Could not read LDAP directory users.");
}

async function authenticateAgainstHost(host: string, username: string, password: string) {
  const client = new Client({
    url: host,
    timeout: Number(process.env.LDAP_TIMEOUT_MS ?? 8000),
    connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT_MS ?? 5000),
  });

  try {
    await client.bind(
      requiredEnv("LDAP_PRIMARY_USERNAME"),
      requiredEnv("LDAP_PRIMARY_PASSWORD"),
    );

    const entry = await findUser(client, username);
    if (!entry?.dn) {
      throw new Error("LDAP user was not found.");
    }

    await client.bind(entry.dn, password);

    const email = firstString(entry, "mail", "userPrincipalName") ??
      emailFromProxyAddresses(entry);

    return {
      username: firstString(entry, "sAMAccountName", "userPrincipalName") ?? username,
      displayName: firstString(entry, "displayName", "cn") ?? username,
      email,
      role: await getAssignedRoleForEmail(email) ?? roleFromEntry(entry),
    };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

export async function authenticateWithLdap(
  username: string,
  password: string,
): Promise<LdapAuthenticatedUser> {
  const normalizedUsername = username.trim();

  if (normalizedUsername.length < 2 || password.length === 0) {
    throw new Error("Username and password are required.");
  }

  let lastError: unknown;
  for (const host of ldapHosts()) {
    try {
      return await authenticateAgainstHost(host, normalizedUsername, password);
    } catch (error) {
      lastError = error;
    }
  }

  console.error("LDAP authentication failed", lastError);
  throw new Error("Invalid username or password.");
}
