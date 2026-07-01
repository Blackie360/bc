import { normalizeCapacityMbpsInput } from "@/lib/capacity";
import type { ProjectServiceType } from "@/lib/projects-types";
import type { PboqRequestInput } from "@/lib/projects/schemas";
import type { Role } from "@/lib/workflow";

export function deriveProjectRequiredService(
  links: Array<{ service?: ProjectServiceType }>,
): ProjectServiceType {
  const services = links.map((link) => link.service);

  if (services.some((service) => !service)) {
    throw new Error("Each service link requires a service.");
  }

  return services[0]!;
}

export function deriveProjectCapacity(links: Array<{ capacity?: string }>) {
  const values = links
    .map((link) => normalizeCapacityMbpsInput(link.capacity))
    .filter((value): value is string => Boolean(value));

  if (values.length !== links.length) {
    throw new Error("Each service link requires a valid Mbps capacity.");
  }

  return [...new Set(values)].join(", ");
}

export function planningRoleForTechnology(technology: PboqRequestInput["technology"]): Role {
  switch (technology) {
    case "Fibre Entry":
      return "Fiber Planning Team";
    case "Wireless":
      return "Wireless Planning Team";
    case "Fibre Ready":
      return "Account Manager";
    default: {
      const exhaustive: never = technology;
      return exhaustive;
    }
  }
}

export function assertFiberPlanningLineCount(
  kickoffLinkCount: number | undefined,
  submittedLineCount: number,
) {
  if (kickoffLinkCount == null || kickoffLinkCount <= 1) {
    return;
  }

  if (submittedLineCount !== kickoffLinkCount) {
    throw new Error(
      `This project has ${kickoffLinkCount} links. Enter costs and upload a PBOQ for each link.`,
    );
  }
}
