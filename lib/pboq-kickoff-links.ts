import { z } from "zod";

export const KICKOFF_LINK_NOTES_MARKER = "kickoff:";

export const pboqKickoffLinkInputSchema = z.object({
  linkName: z.string().min(1),
  region: z.string().min(2),
  service: z.enum(["EPL", "DIA", "DFA"]),
  capacity: z.string().min(1),
});

export type PboqKickoffLinkInput = z.infer<typeof pboqKickoffLinkInputSchema>;

export type PboqCostLineRecord = {
  id: string;
  linkName: string;
  material: number;
  build: number;
  wayleave: number;
  notes: string | null;
};

export function encodeKickoffLinkNotes(link: {
  region?: string;
  service?: string;
  capacity?: string;
}): string | null {
  const payload: Record<string, string> = {};

  if (link.region?.trim()) {
    payload.region = link.region.trim();
  }

  if (link.service) {
    payload.service = link.service;
  }

  if (link.capacity?.trim()) {
    payload.capacity = link.capacity.trim();
  }

  if (Object.keys(payload).length === 0) {
    return null;
  }

  return `${KICKOFF_LINK_NOTES_MARKER}${JSON.stringify(payload)}`;
}

export function parseKickoffLinkNotes(
  notes: string | null | undefined,
): { region?: string; service?: "EPL" | "DIA" | "DFA"; capacity?: string } {
  if (!notes?.startsWith(KICKOFF_LINK_NOTES_MARKER)) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes.slice(KICKOFF_LINK_NOTES_MARKER.length)) as {
      region?: string;
      service?: string;
      capacity?: string;
    };

    const service =
      parsed.service === "EPL" || parsed.service === "DIA" || parsed.service === "DFA"
        ? parsed.service
        : undefined;

    return {
      region: typeof parsed.region === "string" ? parsed.region : undefined,
      service,
      capacity: typeof parsed.capacity === "string" ? parsed.capacity : undefined,
    };
  } catch {
    return {};
  }
}
