"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject,
  deleteProject,
  projectInputSchema,
  updateProject,
} from "@/lib/projects";

function parseProjectForm(formData: FormData) {
  return projectInputSchema.parse(Object.fromEntries(formData));
}

function revalidateProjectViews() {
  revalidatePath("/projects");
  revalidatePath("/roles");
  revalidatePath("/lifecycle");
}

export async function createProjectAction(formData: FormData) {
  const project = await createProject(parseProjectForm(formData));
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(id: string, formData: FormData) {
  const project = await updateProject(id, parseProjectForm(formData));
  revalidatePath(`/projects/${project.id}`);
  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const id = zString(formData.get("id"));
  await deleteProject(id);
  revalidateProjectViews();
  redirect("/projects");
}

function zString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Project id is required.");
  }

  return value;
}
