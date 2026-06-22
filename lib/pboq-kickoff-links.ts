import { z } from "zod";
import { normalizeCapacityMbpsInput } from "@/lib/capacity";

export const KICKOFF_LINK_NOTES_MARKER = "kickoff:";

export const pboqKickoffLinkInputSchema = z.object({
  linkName: z.string().min(1),
  region: z.string().min(2),
  siteCoordinates: z.string().min(2),
  buildingName: z.string().min(2),
  service: z.enum(["EPL", "DIA", "DFA"]),
  capacity: z.string().min(1),
});

export type PboqKickoffLinkInput = z.infer<typeof pboqKickoffLinkInputSchema>;

export type PboqCostLineRecord = {
  id: string;
  linkName: string;
  siteCoordinates?: string;
  material: number;
  build: number;
  wayleave: number;
  pboqDocumentId?: string | null;
  notes: string | null;
};

export function encodeKickoffLinkNotes(link: {
  region?: string;
  siteCoordinates?: string;
  buildingName?: string;
  service?: string;
  capacity?: string;
}): string | null {
  const payload: Record<string, string> = {};

  if (link.region?.trim()) {
    payload.region = link.region.trim();
  }

  if (link.siteCoordinates?.trim()) {
    payload.siteCoordinates = link.siteCoordinates.trim();
  }

  if (link.buildingName?.trim()) {
    payload.buildingName = link.buildingName.trim();
  }

  if (link.service) {
    payload.service = link.service;
  }

  const capacity = normalizeCapacityMbpsInput(link.capacity);
  if (capacity) {
    payload.capacity = capacity;
  }

  if (Object.keys(payload).length === 0) {
    return null;
  }

  return `${KICKOFF_LINK_NOTES_MARKER}${JSON.stringify(payload)}`;
}

export function parseKickoffLinkNotes(
  notes: string | null | undefined,
): {
  region?: string;
  siteCoordinates?: string;
  buildingName?: string;
  service?: "EPL" | "DIA" | "DFA";
  capacity?: string;
} {
  if (!notes?.startsWith(KICKOFF_LINK_NOTES_MARKER)) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes.slice(KICKOFF_LINK_NOTES_MARKER.length)) as {
      region?: string;
      siteCoordinates?: string;
      buildingName?: string;
      service?: string;
      capacity?: string;
    };

    const service =
      parsed.service === "EPL" || parsed.service === "DIA" || parsed.service === "DFA"
        ? parsed.service
        : undefined;

    return {
      region: typeof parsed.region === "string" ? parsed.region : undefined,
      siteCoordinates:
        typeof parsed.siteCoordinates === "string" ? parsed.siteCoordinates : undefined,
      buildingName: typeof parsed.buildingName === "string" ? parsed.buildingName : undefined,
      service,
      capacity:
        typeof parsed.capacity === "string"
          ? normalizeCapacityMbpsInput(parsed.capacity) ?? undefined
          : undefined,
    };
  } catch {
    return {};
  }
}
