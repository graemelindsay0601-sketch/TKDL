import type { CareerKitDesign } from "../kit-catalog";

export type ApparelSlot =
  | "EQUIPMENT_PARTNER"
  | "APPAREL_PARTNER"
  | "PRIMARY_COMMERCIAL"
  | "SECONDARY_COMMERCIAL"
  | "LOCAL_REGIONAL_PARTNER";

export type GarmentPrintZone = {
  slot: ApparelSlot;
  x: number;
  y: number;
  width: number;
  height: number;
  maxAspect: number;
  treatment: "crest" | "wide";
};

/**
 * Front-view garment coordinates on the 100×100 source artwork. The two
 * commercial slots follow the right-chest stack used on real player shirts;
 * secondary/local marks use upper sleeve areas. The source alpha mask clips
 * each print to the actual fabric silhouette.
 */
const chest: Record<ApparelSlot, Omit<GarmentPrintZone, "slot">> = {
  EQUIPMENT_PARTNER: { x: 38, y: 28, width: 14, height: 7, maxAspect: 2, treatment: "crest" },
  APPAREL_PARTNER: { x: 65, y: 28, width: 14, height: 7, maxAspect: 2, treatment: "crest" },
  PRIMARY_COMMERCIAL: { x: 65, y: 38, width: 20, height: 7, maxAspect: 2.85, treatment: "wide" },
  SECONDARY_COMMERCIAL: { x: 15, y: 36, width: 13, height: 7, maxAspect: 1.85, treatment: "crest" },
  LOCAL_REGIONAL_PARTNER: { x: 85, y: 36, width: 13, height: 7, maxAspect: 1.85, treatment: "crest" },
};

const lowerPrintCuts = /crew|jersey|collarless/i;
const upperPrintCuts = /high-collar|stand collar|mock neck/i;

export function garmentPrintZones(kit: Pick<CareerKitDesign, "cut">): GarmentPrintZone[] {
  const zones = Object.entries(chest) as [ApparelSlot, Omit<GarmentPrintZone, "slot">][];
  const isLowerPrint = lowerPrintCuts.test(kit.cut);
  const isUpperPrint = upperPrintCuts.test(kit.cut);
  return zones.map(([slot, zone]) => ({
    slot,
    ...zone,
    y: slot === "PRIMARY_COMMERCIAL"
      ? zone.y + (isUpperPrint ? 5 : isLowerPrint ? -2 : 0)
      : zone.y + (isUpperPrint && zone.y < 35 ? 5 : 0),
  }));
}

export function printZonesAreSafe(zones: readonly GarmentPrintZone[]): boolean {
  const bounds = (a: GarmentPrintZone, b: GarmentPrintZone) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  return zones.every(zone => zone.x >= 0 && zone.y >= 0 &&
    zone.x + zone.width <= 100 && zone.y + zone.height <= 100 &&
    zones.every(other => other === zone || !bounds(zone, other)));
}
