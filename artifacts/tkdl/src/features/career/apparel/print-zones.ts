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
 * Normalised 100×100 garment coordinates. Zones are intentionally compact,
 * avoid the collar/placket and are clipped again against the source garment's
 * alpha mask by PremiumCareerShirt.
 */
const chest: Record<ApparelSlot, Omit<GarmentPrintZone, "slot">> = {
  EQUIPMENT_PARTNER: { x: 38, y: 28, width: 19, height: 9, maxAspect: 2.1, treatment: "crest" },
  APPAREL_PARTNER: { x: 62, y: 21, width: 13, height: 8, maxAspect: 1.55, treatment: "crest" },
  PRIMARY_COMMERCIAL: { x: 39, y: 43, width: 22, height: 9, maxAspect: 2.45, treatment: "wide" },
  SECONDARY_COMMERCIAL: { x: 20, y: 37, width: 13, height: 8, maxAspect: 1.55, treatment: "crest" },
  LOCAL_REGIONAL_PARTNER: { x: 65, y: 62, width: 17, height: 8, maxAspect: 2, treatment: "wide" },
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
