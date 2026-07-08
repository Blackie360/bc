export const projectServiceTypeValues = ["EPL", "DIA", "DF", "Other Services"] as const;
export type ProjectServiceType = (typeof projectServiceTypeValues)[number];

export const linkOnnetOffnetValues = ["Onnet", "3rd Party"] as const;
export type LinkOnnetOffnet = (typeof linkOnnetOffnetValues)[number];

export const linkCostSourceValues = ["PBOQ", "Fibre Ready", "Actual Survey", "3rd Party Quote"] as const;
export type LinkCostSource = (typeof linkCostSourceValues)[number];

export type ProjectRecordRequiredService = ProjectServiceType | "Unspecified";

export function normalizeLinkOnnetOffnet(value: string | null | undefined): LinkOnnetOffnet {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "offnet" || normalized === "3rd party") {
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

  const normalized = value.trim().toUpperCase();

  if (normalized === "DFA") {
    return "DF";
  }

  if (
    normalized === "OTHER SERVICES" ||
    normalized === "OTHERSERVICES" ||
    normalized === "OTHER SERVICE" ||
    normalized === "OTHER"
  ) {
    return "Other Services";
  }

  switch (normalized) {
    case "EPL":
    case "DIA":
    case "DF":
      return normalized;
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
