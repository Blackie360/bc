import type { z } from "zod";
import {
  encodeKickoffLinkNotes,
  type PboqCostLineRecord,
  type PboqKickoffLinkInput,
} from "@/lib/pboq-kickoff-links";
import type { ProjectLinkRecord } from "@/lib/project-record-types";
import { createId } from "@/lib/projects/ids";
import { type bcLinkInputSchema } from "@/lib/projects/schemas";
import { normalizeProjectServiceType } from "@/lib/projects-types";

function linkNrcTotal(link: {
  newBuildCost: number;
  provisioningCost: number;
  materialCost: number;
  wayleaveCost: number;
}) {
  return link.newBuildCost + link.provisioningCost + link.materialCost + link.wayleaveCost;
}

type MapLinkInputOptions = {
  evidenceDocumentId?: string | null;
  supplierQuoteDocumentId?: string | null;
  id?: string;
};

export function mapLinkInputToRecord(
  link: z.infer<typeof bcLinkInputSchema>,
  options: MapLinkInputOptions = {},
): ProjectLinkRecord {
  const newBuildCost = link.newBuildCost;
  const provisioningCost = link.provisioningCost;
  const materialCost = link.materialCost;
  const wayleaveCost = link.wayleaveCost;
  const computedNrc = linkNrcTotal({
    newBuildCost,
    provisioningCost,
    materialCost,
    wayleaveCost,
  });

  const normalizedService = normalizeProjectServiceType(link.service) ?? link.service;

  return {
    id: options.id ?? createId(),
    linkName: link.linkName,
    service: normalizedService,
    technology: link.technology,
    onnetOffnet: link.onnetOffnet,
    costSource: link.costSource,
    newBuildCost,
    provisioningCost,
    materialCost,
    wayleaveCost,
    mrr: link.mrr,
    mrc: link.mrc,
    nrc: link.nrc > 0 ? link.nrc : computedNrc,
    nrr: link.nrr,
    nrv: link.nrv,
    tcv: link.tcv,
    onnetCapacity: link.onnetCapacity ?? null,
    offnetCapacity: link.offnetCapacity ?? null,
    providerName: link.providerName?.trim() || null,
    evidenceDocumentId: options.evidenceDocumentId ?? null,
    supplierQuoteDocumentId: options.supplierQuoteDocumentId ?? null,
  };
}

export function mapKickoffLinksToCostLineRecords(
  links: PboqKickoffLinkInput[],
): PboqCostLineRecord[] {
  return links.map((link) => ({
    id: createId(),
    linkName: link.linkName.trim(),
    siteCoordinates: link.siteCoordinates.trim(),
    material: 0,
    build: 0,
    wayleave: 0,
    pboqDocumentId: null,
    notes: encodeKickoffLinkNotes({
      region: link.region,
      siteCoordinates: link.siteCoordinates,
      buildingName: link.buildingName,
      service: link.service,
      capacity: link.capacity,
    }),
  }));
}
