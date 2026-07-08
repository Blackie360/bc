import { defaultKickoffRegion } from "@/lib/geo/kenya-counties";
import {
  normalizeProjectServiceType,
  type ProjectServiceType,
} from "@/lib/projects-types";

export type KickoffLinkRow = {
  id: number;
  linkName?: string;
  region?: string;
  siteCoordinates?: string;
  buildingName?: string;
  service?: ProjectServiceType;
  capacity?: string;
};

export const kickoffLinkImportColumns = {
  linkName: ["linkname", "link", "linkid", "linknumber", "linkno", "sitename"],
  region: ["region", "county"],
  siteCoordinates: ["sitecoordinates", "coordinates", "gps", "gpscoordinates", "latlong"],
  buildingName: ["buildingname", "building", "location", "address"],
  service: ["service", "servicetype", "product"],
  capacity: ["capacity", "bandwidth", "speed"],
} as const;

export const fiberPlanningImportColumns = {
  linkName: ["linkname", "link", "linkid", "linknumber", "linkno", "sitename"],
  siteCoordinates: ["sitecoordinates", "coordinates", "gps", "gpscoordinates", "latlong"],
  build: ["build", "buildcost", "newbuild", "newbuildcost", "civilcost"],
  material: ["material", "materialcost", "materials"],
  wayleave: ["wayleave", "wayleavecost", "permit", "permitcost"],
  notes: ["notes", "remarks", "comments"],
} as const;

export function normalizeImportHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cellText(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

export function importedService(value: string): KickoffLinkRow["service"] {
  const normalized = normalizeProjectServiceType(value.trim().toUpperCase());

  if (normalized) {
    return normalized;
  }

  const compact = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (compact === "OTHERSERVICES" || compact === "OTHER") {
    return "Other Services";
  }

  return "EPL";
}

export function importedCellFromColumns<TColumns extends Record<string, readonly string[]>>(
  row: Record<string, unknown>,
  columns: TColumns,
  field: keyof TColumns,
) {
  const entry = Object.entries(row).find(([header]) =>
    columns[field].some(
      (column) => column === normalizeImportHeader(header),
    ),
  );

  return entry ? cellText(entry[1]) : "";
}

export function importedCell(
  row: Record<string, unknown>,
  field: keyof typeof kickoffLinkImportColumns,
) {
  return importedCellFromColumns(row, kickoffLinkImportColumns, field);
}

export function importedFiberPlanningCell(
  row: Record<string, unknown>,
  field: keyof typeof fiberPlanningImportColumns,
) {
  return importedCellFromColumns(row, fiberPlanningImportColumns, field);
}

export function rowsFromImportedWorksheet(rows: Array<Record<string, unknown>>): KickoffLinkRow[] {
  return rows
    .map((row, index) => ({
      id: Date.now() + index,
      linkName: importedCell(row, "linkName"),
      region: importedCell(row, "region") || defaultKickoffRegion,
      siteCoordinates: importedCell(row, "siteCoordinates"),
      buildingName: importedCell(row, "buildingName"),
      service: importedService(importedCell(row, "service")),
      capacity: importedCell(row, "capacity"),
    }))
    .filter((row) =>
      Boolean(
        row.linkName ||
          row.siteCoordinates ||
          row.buildingName ||
          row.capacity ||
          row.region !== defaultKickoffRegion,
      ),
    );
}
