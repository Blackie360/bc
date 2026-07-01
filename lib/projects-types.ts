export const projectServiceTypeValues = ["EPL", "DIA", "DF", "Other Services"] as const;
export type ProjectServiceType = (typeof projectServiceTypeValues)[number];

export const linkOnnetOffnetValues = ["Onnet", "3rd Party"] as const;
export type LinkOnnetOffnet = (typeof linkOnnetOffnetValues)[number];

export const linkCostSourceValues = ["PBOQ", "Fibre Ready", "Actual Survey", "3rd Party Quote"] as const;
export type LinkCostSource = (typeof linkCostSourceValues)[number];

export type ProjectRecordRequiredService = ProjectServiceType | "Unspecified";

export function normalizeLinkOnnetOffnet(value: string | null | undefined): LinkOnnetOffnet {
  if (value === "Offnet" || value === "3rd Party") {
    return "3rd Party";
  }

  return "Onnet";
}

export function isThirdPartyLink(onnetOffnet: string | null | undefined) {
  return normalizeLinkOnnetOffnet(onnetOffnet) === "3rd Party";
}

export function normalizeProjectServiceType(
  value: string | null | undefined,
): ProjectServiceType | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "DFA") {
    return "DF";
  }

  switch (value) {
    case "EPL":
    case "DIA":
    case "DF":
    case "Other Services":
      return value;
    default:
      return undefined;
  }
}

export function normalizeRequiredService(
  value: string | null | undefined,
): ProjectRecordRequiredService {
  const normalized = normalizeProjectServiceType(value);

  if (normalized) {
    return normalized;
  }

  if (value === "Unspecified") {
    return "Unspecified";
  }

  return "Unspecified";
}
