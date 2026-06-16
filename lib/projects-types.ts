export const linkOnnetOffnetValues = ["Onnet", "Offnet"] as const;
export type LinkOnnetOffnet = (typeof linkOnnetOffnetValues)[number];

export const linkCostSourceValues = ["PBOQ", "Fibre Ready", "Actual Survey", "3rd Party Quote"] as const;
export type LinkCostSource = (typeof linkCostSourceValues)[number];
