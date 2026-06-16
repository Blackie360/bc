import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { roles, type Role } from "@/lib/workflow";

export type RoleAssignment = {
  role: Role;
  email: string;
  displayName: string;
  username: string;
  updatedAt: string;
};

const roleAssignmentSchema = z.object({
  role: z.enum(roles),
  email: z.string().email(),
  displayName: z.string().min(1),
  username: z.string().min(1),
  updatedAt: z.string().min(1),
});

function roleAssignmentsStoragePath() {
  return (
    process.env.ROLE_ASSIGNMENTS_STORAGE_FILE ??
    path.join(process.cwd(), ".data", "role-assignments.json")
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function readRoleAssignments(): Promise<RoleAssignment[]> {
  try {
    const contents = await readFile(roleAssignmentsStoragePath(), "utf8");
    if (!contents.trim()) {
      return [];
    }

    const parsed = JSON.parse(contents);
    const result = z.array(roleAssignmentSchema).safeParse(parsed);

    return result.success ? result.data : [];
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

async function writeRoleAssignments(assignments: RoleAssignment[]) {
  const filePath = roleAssignmentsStoragePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      assignments.sort((left, right) => left.role.localeCompare(right.role)),
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function listRoleAssignments() {
  return readRoleAssignments();
}

export async function listRoleAssignmentsByRole() {
  const assignments = await listRoleAssignments();

  return Object.fromEntries(
    assignments.map((assignment) => [assignment.role, assignment]),
  ) as Partial<Record<Role, RoleAssignment>>;
}

export async function getAssignedRoleForEmail(email: string | undefined) {
  if (!email) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const assignments = await listRoleAssignments();

  return assignments.find((assignment) => assignment.email === normalizedEmail)?.role ?? null;
}

export async function saveRoleAssignments(
  assignmentsByRole: Partial<Record<Role, Omit<RoleAssignment, "role" | "updatedAt"> | null>>,
) {
  const now = new Date().toISOString();
  const existing = new Map(
    (await listRoleAssignments()).map((assignment) => [assignment.role, assignment]),
  );

  for (const role of roles) {
    if (!(role in assignmentsByRole)) {
      continue;
    }

    const assignment = assignmentsByRole[role];
    if (!assignment) {
      existing.delete(role);
      continue;
    }

    const normalizedEmail = normalizeEmail(assignment.email);
    for (const [existingRole, existingAssignment] of existing.entries()) {
      if (existingRole !== role && existingAssignment.email === normalizedEmail) {
        existing.delete(existingRole);
      }
    }

    existing.set(role, {
      role,
      email: normalizedEmail,
      displayName: assignment.displayName.trim(),
      username: assignment.username.trim(),
      updatedAt: now,
    });
  }

  const nextAssignments = roles
    .map((role) => existing.get(role))
    .filter((assignment): assignment is RoleAssignment => Boolean(assignment));

  await writeRoleAssignments(nextAssignments);

  return nextAssignments;
}

export async function saveRoleAssignment(
  role: Role,
  assignment: Omit<RoleAssignment, "role" | "updatedAt">,
) {
  return saveRoleAssignments({ [role]: assignment });
}
