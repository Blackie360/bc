import {
  KICKOFF_LINK_NOTES_MARKER,
  parseKickoffLinkNotes,
  type PboqCostLineRecord,
} from "@/lib/pboq-kickoff-links";
import type { FiberPlanningLineDraft } from "@/lib/project-lifecycle-storage";
import { importedFiberPlanningCell } from "@/lib/workflow/excel-import";

export type FiberPlanningRow = { id: number } & FiberPlanningLineDraft;

export function buildFiberPlanningRowsFromCostLines(
  costLines: PboqCostLineRecord[],
): FiberPlanningRow[] {
  if (costLines.length === 0) {
    return [{ id: 1 }];
  }

  return costLines.map((line, index) => {
    const isKickoffNotes = line.notes?.startsWith(KICKOFF_LINK_NOTES_MARKER) ?? false;
    const kickoff = parseKickoffLinkNotes(line.notes);
    const siteCoordinates = line.siteCoordinates?.trim() || kickoff.siteCoordinates;

    return {
      id: index + 1,
      linkName: line.linkName,
      siteCoordinates,
      material: line.material > 0 ? String(line.material) : "",
      build: line.build > 0 ? String(line.build) : "",
      wayleave: line.wayleave > 0 ? String(line.wayleave) : "",
      notes: isKickoffNotes ? "" : (line.notes ?? ""),
    };
  });
}

export function buildFiberPlanningRowsFromWorksheet(
  worksheetRows: Array<Record<string, unknown>>,
): FiberPlanningRow[] {
  return worksheetRows
    .map((row, index) => ({
      id: Date.now() + index,
      linkName: importedFiberPlanningCell(row, "linkName"),
      siteCoordinates: importedFiberPlanningCell(row, "siteCoordinates"),
      build: importedFiberPlanningCell(row, "build"),
      material: importedFiberPlanningCell(row, "material"),
      wayleave: importedFiberPlanningCell(row, "wayleave"),
      notes: importedFiberPlanningCell(row, "notes"),
    }))
    .filter((row) =>
      Boolean(
        row.linkName ||
          row.siteCoordinates ||
          row.build ||
          row.material ||
          row.wayleave ||
          row.notes,
      ),
    );
}

export function buildFiberPlanningRowsFromDraft(
  lines?: FiberPlanningLineDraft[],
): FiberPlanningRow[] {
  if (!lines || lines.length === 0) {
    return [{ id: 1 }];
  }

  return lines.map((line, index) => ({
    id: index + 1,
    ...line,
  }));
}
