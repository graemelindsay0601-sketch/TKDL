import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronDown, ChevronRight, Compass, Crosshair, LocateFixed, MapPin, Minus,
  MousePointer2, Plus, RotateCcw, SlidersHorizontal, Trophy,
} from "lucide-react";
import "./_group.css";
import "./career-map-premium.css";

type MapView = { x: number; y: number; width: number; height: number };
type RouteFact = {
  type: string;
  met: boolean;
  parts?: RouteFact[];
  inner?: RouteFact;
  list?: string;
  maxPosition?: number;
  position?: number | null;
  placesOutside?: number | null;
  held?: boolean;
  qualifierRoutes?: string[];
  required?: string;
};
type PreviewEvent = {
  id: string;
  name: string;
  status: "SCHEDULED" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  opportunity: { canEnter: boolean; state: string; reasons: string[] };
  venue: { displayName: string; city: string; mapAnchor: { latitude: number; longitude: number } };
  fieldDescriptor: string;
  financialCommitment: {
    entryFeePence: number;
    estimatedTravelPence: number;
    estimatedAccommodationPence: number;
    estimatedPlayerCostPence: number;
    sponsorCoverage: { entryFeePence: number; travelPence: number; accommodationPence: number };
  };
  dates: { startWeek: number };
  content: { circuitId: string };
  route: RouteFact;
};
type Cluster = { key: string; x: number; y: number; events: PreviewEvent[] };
type DragState = { x: number; y: number; view: MapView; inverse: DOMMatrix };

const MAP_VIEWS: Record<string, MapView> = {
  WORLD: { x: 0, y: 0, width: 720, height: 360 },
  EUROPE: { x: 330, y: 35, width: 170, height: 130 },
  UK_IRELAND: { x: 335, y: 52, width: 32, height: 30 },
  SCOTLAND: { x: 346, y: 62, width: 15, height: 10 },
  NORTH_AMERICA: { x: 100, y: 55, width: 160, height: 95 },
  ASIA: { x: 545, y: 85, width: 125, height: 110 },
  OCEANIA: { x: 575, y: 195, width: 150, height: 95 },
};

// Entirely local preview examples. These are illustrative event/opportunity/finance
// values, not production data and not claims about a real player's eligibility.
const PREVIEW_EVENTS: PreviewEvent[] = [
  { id: "atlas-001", name: "Ayrshire Open Series", status: "REGISTRATION_OPEN", opportunity: { canEnter: true, state: "AVAILABLE", reasons: [] }, venue: { displayName: "Coastal Sports Hall", city: "Ayr", mapAnchor: { latitude: 55.46, longitude: -4.63 } }, fieldDescriptor: "Regional open · 64-player field", financialCommitment: { entryFeePence: 1200, estimatedTravelPence: 1800, estimatedAccommodationPence: 0, estimatedPlayerCostPence: 2400, sponsorCoverage: { entryFeePence: 600, travelPence: 0, accommodationPence: 0 } }, dates: { startWeek: 3 }, content: { circuitId: "REGIONAL" }, route: { type: "OPEN", met: true } },
  { id: "atlas-002", name: "Dublin Winter Classic", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "North Quay Arena", city: "Dublin", mapAnchor: { latitude: 53.35, longitude: -6.26 } }, fieldDescriptor: "National amateur · 96-player field", financialCommitment: { entryFeePence: 2500, estimatedTravelPence: 5400, estimatedAccommodationPence: 8200, estimatedPlayerCostPence: 11600, sponsorCoverage: { entryFeePence: 0, travelPence: 2000, accommodationPence: 2500 } }, dates: { startWeek: 5 }, content: { circuitId: "NATIONAL_AMATEUR" }, route: { type: "PRO_STATUS", required: "AMATEUR", met: true } },
  { id: "atlas-003", name: "Rotterdam Masters", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_TOUR_CARD"] }, venue: { displayName: "Harbour Exhibition Centre", city: "Rotterdam", mapAnchor: { latitude: 51.92, longitude: 4.48 } }, fieldDescriptor: "Pro tour · 128-player field", financialCommitment: { entryFeePence: 5000, estimatedTravelPence: 7800, estimatedAccommodationPence: 11500, estimatedPlayerCostPence: 15800, sponsorCoverage: { entryFeePence: 1500, travelPence: 3000, accommodationPence: 4000 } }, dates: { startWeek: 7 }, content: { circuitId: "PRO_CIRCUIT" }, route: { type: "TOUR_CARD", met: false } },
  { id: "atlas-004", name: "Copenhagen Open", status: "COMPLETED", opportunity: { canEnter: false, state: "COMPLETED", reasons: [] }, venue: { displayName: "Nordic Sports Forum", city: "Copenhagen", mapAnchor: { latitude: 55.68, longitude: 12.57 } }, fieldDescriptor: "European series · 80-player field", financialCommitment: { entryFeePence: 1800, estimatedTravelPence: 4900, estimatedAccommodationPence: 7400, estimatedPlayerCostPence: 11000, sponsorCoverage: { entryFeePence: 900, travelPence: 0, accommodationPence: 2200 } }, dates: { startWeek: 8 }, content: { circuitId: "EUROPEAN_SERIES" }, route: { type: "OPEN", met: true } },
  { id: "atlas-005", name: "Berlin Challenger", status: "REGISTRATION_OPEN", opportunity: { canEnter: true, state: "QUALIFIED", reasons: [] }, venue: { displayName: "Spree Convention Hall", city: "Berlin", mapAnchor: { latitude: 52.52, longitude: 13.4 } }, fieldDescriptor: "Challenger tour · 96-player field", financialCommitment: { entryFeePence: 3200, estimatedTravelPence: 7600, estimatedAccommodationPence: 9500, estimatedPlayerCostPence: 13700, sponsorCoverage: { entryFeePence: 1600, travelPence: 2500, accommodationPence: 2500 } }, dates: { startWeek: 10 }, content: { circuitId: "CHALLENGER" }, route: { type: "QUALIFICATION", met: true, held: true } },
  { id: "atlas-006", name: "Paris Open Weekend", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "Seine Sports Pavilion", city: "Paris", mapAnchor: { latitude: 48.86, longitude: 2.35 } }, fieldDescriptor: "European series · 64-player field", financialCommitment: { entryFeePence: 2000, estimatedTravelPence: 6900, estimatedAccommodationPence: 10500, estimatedPlayerCostPence: 14000, sponsorCoverage: { entryFeePence: 0, travelPence: 2400, accommodationPence: 3000 } }, dates: { startWeek: 12 }, content: { circuitId: "EUROPEAN_SERIES" }, route: { type: "OPEN", met: true } },
  { id: "atlas-007", name: "Madrid City Trophy", status: "CANCELLED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["EVENT_FINISHED"] }, venue: { displayName: "Central Exhibition Hall", city: "Madrid", mapAnchor: { latitude: 40.42, longitude: -3.7 } }, fieldDescriptor: "Open event · 48-player field", financialCommitment: { entryFeePence: 1500, estimatedTravelPence: 8500, estimatedAccommodationPence: 7200, estimatedPlayerCostPence: 17200, sponsorCoverage: { entryFeePence: 0, travelPence: 0, accommodationPence: 0 } }, dates: { startWeek: 14 }, content: { circuitId: "OPEN" }, route: { type: "OPEN", met: true } },
  { id: "atlas-008", name: "Stockholm Nordic Cup", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_RANKING"] }, venue: { displayName: "Lakefront Arena", city: "Stockholm", mapAnchor: { latitude: 59.33, longitude: 18.07 } }, fieldDescriptor: "Nordic tour · 72-player field", financialCommitment: { entryFeePence: 2700, estimatedTravelPence: 5700, estimatedAccommodationPence: 9400, estimatedPlayerCostPence: 12500, sponsorCoverage: { entryFeePence: 1000, travelPence: 1800, accommodationPence: 2500 } }, dates: { startWeek: 16 }, content: { circuitId: "NORDIC_BALTIC" }, route: { type: "RANKING", met: false, list: "European Series", maxPosition: 64, position: 82, placesOutside: 18 } },
  { id: "atlas-009", name: "Toronto Maple Invitational", status: "REGISTRATION_OPEN", opportunity: { canEnter: true, state: "AVAILABLE", reasons: [] }, venue: { displayName: "Lakeshore Events Centre", city: "Toronto", mapAnchor: { latitude: 43.65, longitude: -79.38 } }, fieldDescriptor: "International open · 64-player field", financialCommitment: { entryFeePence: 2200, estimatedTravelPence: 21800, estimatedAccommodationPence: 16600, estimatedPlayerCostPence: 26000, sponsorCoverage: { entryFeePence: 1100, travelPence: 8000, accommodationPence: 5500 } }, dates: { startWeek: 18 }, content: { circuitId: "WORLD_SERIES" }, route: { type: "OPEN", met: true } },
  { id: "atlas-010", name: "Chicago Lakeside Open", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "Midtown Sports Hall", city: "Chicago", mapAnchor: { latitude: 41.88, longitude: -87.63 } }, fieldDescriptor: "Regional open · 80-player field", financialCommitment: { entryFeePence: 1800, estimatedTravelPence: 24100, estimatedAccommodationPence: 13900, estimatedPlayerCostPence: 27300, sponsorCoverage: { entryFeePence: 0, travelPence: 8500, accommodationPence: 4000 } }, dates: { startWeek: 20 }, content: { circuitId: "REGIONAL" }, route: { type: "OPEN", met: true } },
  { id: "atlas-011", name: "Vancouver Pacific Series", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_INVITATION"] }, venue: { displayName: "Pacific Exhibition Centre", city: "Vancouver", mapAnchor: { latitude: 49.28, longitude: -123.12 } }, fieldDescriptor: "Invitational · 32-player field", financialCommitment: { entryFeePence: 0, estimatedTravelPence: 26500, estimatedAccommodationPence: 15400, estimatedPlayerCostPence: 27200, sponsorCoverage: { entryFeePence: 0, travelPence: 9500, accommodationPence: 5200 } }, dates: { startWeek: 22 }, content: { circuitId: "INVITATIONAL" }, route: { type: "INVITATION", met: false } },
  { id: "atlas-012", name: "New York Empire Open", status: "IN_PROGRESS", opportunity: { canEnter: false, state: "ENTERED", reasons: [] }, venue: { displayName: "Hudson Hall", city: "New York", mapAnchor: { latitude: 40.71, longitude: -74.01 } }, fieldDescriptor: "Major open · 128-player field", financialCommitment: { entryFeePence: 3500, estimatedTravelPence: 23100, estimatedAccommodationPence: 17700, estimatedPlayerCostPence: 26300, sponsorCoverage: { entryFeePence: 2000, travelPence: 10000, accommodationPence: 6000 } }, dates: { startWeek: 24 }, content: { circuitId: "MAJOR" }, route: { type: "OPEN", met: true } },
  { id: "atlas-013", name: "Tokyo Metropolitan Cup", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_QUALIFICATION"] }, venue: { displayName: "Bayfront Sports Arena", city: "Tokyo", mapAnchor: { latitude: 35.68, longitude: 139.69 } }, fieldDescriptor: "Asian tour · 96-player field", financialCommitment: { entryFeePence: 2800, estimatedTravelPence: 65500, estimatedAccommodationPence: 21400, estimatedPlayerCostPence: 61300, sponsorCoverage: { entryFeePence: 1400, travelPence: 20000, accommodationPence: 7000 } }, dates: { startWeek: 27 }, content: { circuitId: "ASIAN_TOUR" }, route: { type: "QUALIFICATION", met: false, qualifierRoutes: ["Regional qualifier"] } },
  { id: "atlas-014", name: "Singapore International", status: "REGISTRATION_OPEN", opportunity: { canEnter: true, state: "AVAILABLE", reasons: [] }, venue: { displayName: "Marina Exhibition Hall", city: "Singapore", mapAnchor: { latitude: 1.35, longitude: 103.82 } }, fieldDescriptor: "International open · 64-player field", financialCommitment: { entryFeePence: 2400, estimatedTravelPence: 59800, estimatedAccommodationPence: 19600, estimatedPlayerCostPence: 56200, sponsorCoverage: { entryFeePence: 1200, travelPence: 18000, accommodationPence: 6400 } }, dates: { startWeek: 29 }, content: { circuitId: "WORLD_SERIES" }, route: { type: "OPEN", met: true } },
  { id: "atlas-015", name: "Melbourne Southern Classic", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "Yarra Convention Centre", city: "Melbourne", mapAnchor: { latitude: -37.81, longitude: 144.96 } }, fieldDescriptor: "Oceanic tour · 80-player field", financialCommitment: { entryFeePence: 2500, estimatedTravelPence: 73400, estimatedAccommodationPence: 24800, estimatedPlayerCostPence: 68800, sponsorCoverage: { entryFeePence: 1200, travelPence: 22500, accommodationPence: 8200 } }, dates: { startWeek: 31 }, content: { circuitId: "OCEANIC" }, route: { type: "PRO_STATUS", required: "PROFESSIONAL", met: false } },
  { id: "atlas-016", name: "Auckland Harbour Open", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["OUTSIDE_REGION"] }, venue: { displayName: "Waitematā Pavilion", city: "Auckland", mapAnchor: { latitude: -36.85, longitude: 174.76 } }, fieldDescriptor: "Oceanic open · 48-player field", financialCommitment: { entryFeePence: 1400, estimatedTravelPence: 76200, estimatedAccommodationPence: 23800, estimatedPlayerCostPence: 76400, sponsorCoverage: { entryFeePence: 0, travelPence: 18000, accommodationPence: 7000 } }, dates: { startWeek: 33 }, content: { circuitId: "OCEANIC" }, route: { type: "ZONE", met: false } },
  { id: "atlas-017", name: "Johannesburg Invitational", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_INVITATION"] }, venue: { displayName: "Highveld Events Hall", city: "Johannesburg", mapAnchor: { latitude: -26.2, longitude: 28.04 } }, fieldDescriptor: "Invitational · 24-player field", financialCommitment: { entryFeePence: 0, estimatedTravelPence: 54800, estimatedAccommodationPence: 22700, estimatedPlayerCostPence: 56000, sponsorCoverage: { entryFeePence: 0, travelPence: 14000, accommodationPence: 7500 } }, dates: { startWeek: 35 }, content: { circuitId: "INVITATIONAL" }, route: { type: "INVITATION", met: false } },
  { id: "atlas-018", name: "Helsinki North Star Open", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "Harbourfront Hall", city: "Helsinki", mapAnchor: { latitude: 60.17, longitude: 24.94 } }, fieldDescriptor: "Nordic tour · 64-player field", financialCommitment: { entryFeePence: 2100, estimatedTravelPence: 6200, estimatedAccommodationPence: 8800, estimatedPlayerCostPence: 11200, sponsorCoverage: { entryFeePence: 1000, travelPence: 2100, accommodationPence: 2800 } }, dates: { startWeek: 37 }, content: { circuitId: "NORDIC_BALTIC" }, route: { type: "OPEN", met: true } },
  { id: "atlas-019", name: "Prague Bohemian Trophy", status: "REGISTRATION_OPEN", opportunity: { canEnter: true, state: "AVAILABLE", reasons: [] }, venue: { displayName: "Old Town Congress Hall", city: "Prague", mapAnchor: { latitude: 50.08, longitude: 14.44 } }, fieldDescriptor: "European development · 64-player field", financialCommitment: { entryFeePence: 1600, estimatedTravelPence: 5600, estimatedAccommodationPence: 6300, estimatedPlayerCostPence: 8800, sponsorCoverage: { entryFeePence: 800, travelPence: 1800, accommodationPence: 2100 } }, dates: { startWeek: 39 }, content: { circuitId: "EUROPEAN_DEVELOPMENT" }, route: { type: "ALL", met: true, parts: [{ type: "OPEN", met: true }, { type: "ZONE", met: true }] } },
  { id: "atlas-020", name: "Warsaw Season Finale", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_RANKING"] }, venue: { displayName: "Vistula Arena", city: "Warsaw", mapAnchor: { latitude: 52.23, longitude: 21.01 } }, fieldDescriptor: "European series · 32-player field", financialCommitment: { entryFeePence: 3200, estimatedTravelPence: 5900, estimatedAccommodationPence: 7100, estimatedPlayerCostPence: 10300, sponsorCoverage: { entryFeePence: 1600, travelPence: 1900, accommodationPence: 2400 } }, dates: { startWeek: 41 }, content: { circuitId: "EUROPEAN_SERIES" }, route: { type: "RANKING", met: false, list: "European Series", maxPosition: 32, position: 82, placesOutside: 50 } },
  { id: "atlas-021", name: "Osaka Autumn Trophy", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "Naniwa Convention Centre", city: "Osaka", mapAnchor: { latitude: 34.69, longitude: 135.5 } }, fieldDescriptor: "Asian tour · 64-player field", financialCommitment: { entryFeePence: 1900, estimatedTravelPence: 63400, estimatedAccommodationPence: 18100, estimatedPlayerCostPence: 57500, sponsorCoverage: { entryFeePence: 900, travelPence: 19000, accommodationPence: 6000 } }, dates: { startWeek: 43 }, content: { circuitId: "ASIAN_TOUR" }, route: { type: "OPEN", met: true } },
  { id: "atlas-022", name: "Brisbane River Open", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_TOUR_CARD"] }, venue: { displayName: "River City Sports Hall", city: "Brisbane", mapAnchor: { latitude: -27.47, longitude: 153.03 } }, fieldDescriptor: "Oceanic tour · 72-player field", financialCommitment: { entryFeePence: 2200, estimatedTravelPence: 74900, estimatedAccommodationPence: 20300, estimatedPlayerCostPence: 67500, sponsorCoverage: { entryFeePence: 1100, travelPence: 22000, accommodationPence: 6800 } }, dates: { startWeek: 45 }, content: { circuitId: "OCEANIC" }, route: { type: "TOUR_CARD", met: false } },
  { id: "atlas-023", name: "Edinburgh Winter Open", status: "SCHEDULED", opportunity: { canEnter: false, state: "AVAILABLE", reasons: ["REGISTRATION_NOT_OPEN"] }, venue: { displayName: "Caledonian Hall", city: "Edinburgh", mapAnchor: { latitude: 55.95, longitude: -3.19 } }, fieldDescriptor: "Regional open · 80-player field", financialCommitment: { entryFeePence: 1800, estimatedTravelPence: 2200, estimatedAccommodationPence: 0, estimatedPlayerCostPence: 2400, sponsorCoverage: { entryFeePence: 900, travelPence: 700, accommodationPence: 0 } }, dates: { startWeek: 47 }, content: { circuitId: "REGIONAL" }, route: { type: "OPEN", met: true } },
  { id: "atlas-024", name: "Lisbon Atlantic Cup", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REGISTRATION_CLOSED"] }, venue: { displayName: "Tagus Exhibition Hall", city: "Lisbon", mapAnchor: { latitude: 38.72, longitude: -9.14 } }, fieldDescriptor: "European series · 48-player field", financialCommitment: { entryFeePence: 1700, estimatedTravelPence: 9100, estimatedAccommodationPence: 8000, estimatedPlayerCostPence: 12400, sponsorCoverage: { entryFeePence: 800, travelPence: 3000, accommodationPence: 2600 } }, dates: { startWeek: 49 }, content: { circuitId: "EUROPEAN_SERIES" }, route: { type: "OPEN", met: true } },
  { id: "atlas-025", name: "World Championship", status: "SCHEDULED", opportunity: { canEnter: false, state: "NOT_ELIGIBLE", reasons: ["REQUIRES_QUALIFICATION"] }, venue: { displayName: "Alexandra Palace", city: "London", mapAnchor: { latitude: 51.59, longitude: -0.13 } }, fieldDescriptor: "World championship · 96-player field", financialCommitment: { entryFeePence: 0, estimatedTravelPence: 1800, estimatedAccommodationPence: 0, estimatedPlayerCostPence: 1800, sponsorCoverage: { entryFeePence: 0, travelPence: 0, accommodationPence: 0 } }, dates: { startWeek: 52 }, content: { circuitId: "WORLD_CHAMPIONSHIP" }, route: { type: "ANY", met: false, parts: [{ type: "RANKING", met: false, list: "World Ranking", maxPosition: 64, position: null }, { type: "QUALIFICATION", met: false, qualifierRoutes: ["Qualifier event"] }] } },
];

const titleCase = (value: string) => value.toLowerCase().split(/[_\s-]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const regionName = (key: string) => key === "UK_IRELAND" ? "UK & Ireland" : key === "ASIA" ? "Asia" : titleCase(key);
function projectCoordinate(latitude: number, longitude: number) {
  return { x: (Math.max(-180, Math.min(180, longitude)) + 180) * 2, y: (90 - Math.max(-90, Math.min(90, latitude))) * 2 };
}
function clusterLocations(events: PreviewEvent[], view: MapView): Cluster[] {
  const groups = new Map<string, Cluster>();
  for (const event of events) {
    const point = projectCoordinate(event.venue.mapAnchor.latitude, event.venue.mapAnchor.longitude);
    if (point.x < view.x || point.x > view.x + view.width || point.y < view.y || point.y > view.y + view.height) continue;
    const key = `${Math.floor((point.x - view.x) / view.width * 720 / 32)}:${Math.floor((point.y - view.y) / view.height * 360 / 32)}`;
    const group = groups.get(key);
    if (group) {
      group.x = (group.x * group.events.length + point.x) / (group.events.length + 1);
      group.y = (group.y * group.events.length + point.y) / (group.events.length + 1);
      group.events.push(event);
    } else groups.set(key, { key, ...point, events: [event] });
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
function filterMap(events: PreviewEvent[], filter: string, completed: boolean) {
  return events.filter((event) => (completed || !["COMPLETED", "CANCELLED"].includes(event.status)) &&
    (filter === "ALL" || filter === "OPPORTUNITIES" && (event.opportunity.canEnter || ["ENTERED", "CONFIRMED", "PLAYING", "QUALIFIED"].includes(event.opportunity.state)) ||
      filter === "ENTERED" && ["ENTERED", "CONFIRMED", "PLAYING"].includes(event.opportunity.state) || event.content.circuitId === filter));
}
function mapState(event: PreviewEvent) {
  if (event.status === "IN_PROGRESS") return "In Progress";
  if (event.status === "COMPLETED") return "Completed";
  return event.opportunity.state.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}
function planningCosts(value: PreviewEvent["financialCommitment"] | undefined) {
  if (!value) return null;
  const sponsor = value.sponsorCoverage;
  return {
    commitment: value.entryFeePence + value.estimatedTravelPence + value.estimatedAccommodationPence,
    coverage: sponsor.entryFeePence + sponsor.travelPence + sponsor.accommodationPence,
    playerCost: value.estimatedPlayerCostPence,
  };
}
function formatPence(pence: number) {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function denialLabel(reason: string) {
  const labels: Record<string, string> = {
    NOT_ELIGIBLE: "Not eligible", OUTSIDE_REGION: "Outside region", REQUIRES_AMATEUR_STATUS: "Amateurs only",
    REQUIRES_PROFESSIONAL_STATUS: "Professionals only", REQUIRES_TOUR_CARD: "Tour Card required",
    TOUR_CARD_HOLDER_EXCLUDED: "Not open to Tour Card holders", REQUIRES_QUALIFICATION: "Qualification required",
    REQUIRES_INVITATION: "Invitation only", REQUIRES_RANKING: "Ranking position required",
    REQUIRES_EVENT_RESULT: "Earlier result required", REQUIRES_DEFENDING_CHAMPION: "Defending champion only",
    REGISTRATION_NOT_OPEN: "Registration not open", REGISTRATION_CLOSED: "Registration closed",
    SCHEDULE_CONFLICT: "Clashes with your schedule", ALREADY_ENTERED: "Already entered",
    NOT_ENTERED: "Not entered", UNSUPPORTED_FORMAT: "Format not yet playable",
    CAREER_NOT_ACTIVE: "Career retired", PARTICIPANT_RETIRED: "Retired", FIELD_LOCKED: "Field locked",
    EVENT_FINISHED: "Event finished", INSUFFICIENT_FUNDS: "Cannot afford",
  };
  return labels[reason] ?? titleCase(reason);
}
function ordinal(value: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod = value % 100;
  return `${value}${suffixes[(mod - 20) % 10] || suffixes[mod] || suffixes[0]}`;
}
function routeLines(route: RouteFact): { text: string; met: boolean }[] {
  if (route.type === "ALL" || route.type === "ANY") {
    const parts = (route.parts ?? []).flatMap(routeLines);
    return route.type === "ANY" && parts.length > 1 ? parts.map((part, index) => ({ ...part, text: index === 0 ? part.text : `or ${part.text}` })) : parts;
  }
  if (route.type === "NOT") return (route.inner ? routeLines(route.inner) : []).map((part) => ({ text: `Not: ${part.text}`, met: route.met }));
  switch (route.type) {
    case "TOUR_CARD": return [{ text: "Tour Card required", met: route.met }];
    case "NON_TOUR_CARD": return [{ text: "Not open to Tour Card holders", met: route.met }];
    case "RANKING": {
      const where = route.position ? `you are ${ordinal(route.position)}` : "you are unranked";
      const gap = !route.met && route.placesOutside ? ` (${route.placesOutside} place${route.placesOutside === 1 ? "" : "s"} outside)` : "";
      return [{ text: `Top ${route.maxPosition} on ${titleCase(route.list ?? "ranking")} — ${where}${gap}`, met: route.met }];
    }
    case "QUALIFICATION": return [{ text: route.held ? "Qualified" : route.qualifierRoutes?.length ? "Qualifier route available" : "Qualification required", met: route.met }];
    case "INVITATION": return [{ text: "Invitation", met: route.met }];
    case "PRO_STATUS": return [{ text: route.required === "AMATEUR" ? "Amateurs only" : "Professionals only", met: route.met }];
    case "OPEN": return [{ text: "Open entry", met: true }];
    case "ZONE": case "COUNTRY": case "LOCALITY": return [{ text: "Region restricted", met: route.met }];
    case "EVENT_RESULT": return [{ text: "Earlier result required", met: route.met }];
    case "DEFENDING_CHAMPION": return [{ text: "Defending champion", met: route.met }];
    case "COMPUTER_PLAYER": return [];
    default: return [{ text: titleCase(route.type), met: route.met }];
  }
}

function EventStatus({ event }: { event: PreviewEvent }) {
  const entered = ["ENTERED", "CONFIRMED", "PLAYING"].includes(event.opportunity.state);
  return <span className={`cma-status ${event.opportunity.canEnter ? "is-open" : entered ? "is-entered" : "is-closed"}`}>
    {event.opportunity.canEnter && <i aria-hidden="true" />}{mapState(event)}
  </span>;
}

function EventInspector({ event, selection, onInspect, onPreviewAction }: {
  event: PreviewEvent | undefined;
  selection: PreviewEvent[];
  onInspect: (id: string) => void;
  onPreviewAction: (message: string) => void;
}) {
  const costs = planningCosts(event?.financialCommitment);
  const entered = !!event && ["ENTERED", "CONFIRMED", "PLAYING"].includes(event.opportunity.state);
  return (
    <aside className="cma-inspector" aria-label="Selected event details">
      <div className="cma-inspector-heading"><span className="cma-label">EVENT INTELLIGENCE</span><Crosshair size={15} aria-hidden="true" /></div>
      {selection.length > 1 && event && <label className="cma-select-event">
        <span>Events at this location</span><span className="cma-select-wrap">
          <select value={event.id} onChange={(change) => onInspect(change.target.value)} aria-label="Choose event at this location">
            {selection.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select><ChevronDown size={14} aria-hidden="true" />
        </span>
      </label>}
      {event ? <>
        <div className="cma-event-kicker"><span>SEASON 4 <i /> WEEK {event.dates.startWeek}</span><EventStatus event={event} /></div>
        <h2 className="cma-event-title">{event.name}</h2>
        <p className="cma-event-place"><MapPin size={14} aria-hidden="true" />{event.venue.displayName}, {event.venue.city}</p>
        <div className="cma-field-fact"><Trophy size={15} aria-hidden="true" /><span>{event.fieldDescriptor}</span></div>
        <div className="cma-cost-block" aria-label="Estimated event costs">
          <div className="cma-cost-heading"><span>TRAVEL PLAN</span><small>ESTIMATES</small></div>
          {costs && <dl>
            <div><dt>Commitment (estimated)</dt><dd>{formatPence(costs.commitment)}</dd></div>
            <div><dt>Sponsor coverage</dt><dd className="is-covered">{formatPence(costs.coverage)}</dd></div>
            <div className="cma-cost-total"><dt>Your cost (estimated)</dt><dd>{formatPence(costs.playerCost)}</dd></div>
          </dl>}
          <p>Estimated figures · subject to change</p>
        </div>
        {!event.opportunity.canEnter && !entered && <div className="cma-eligibility">
          <span className="cma-label">ENTRY ELIGIBILITY · PREVIEW EXAMPLE</span>
          <strong>Not currently eligible</strong>
          <p>{event.opportunity.reasons.length ? event.opportunity.reasons.map(denialLabel).join(" · ") : "Check registration dates and the event’s sporting routes."}</p>
        </div>}
        {entered && <div className="cma-entered-note"><Check size={15} aria-hidden="true" /><span>Already on this preview schedule</span></div>}
        <div className="cma-route-facts" aria-label="Illustrative sporting routes">
          <span className="cma-label">SPORTING ROUTES · PREVIEW EXAMPLE</span>
          {routeLines(event.route).map((route, index) => <p key={`${route.text}-${index}`}>{route.text} <b>{route.met ? "Met" : "Not currently met"}</b></p>)}
        </div>
        <button className="cma-inspect-action" type="button" onClick={() => onPreviewAction("Preview only — event navigation is not connected.")}>
          Inspect event <ChevronRight size={16} aria-hidden="true" />
        </button>
      </> : <div className="cma-empty-inspector">
        <span className="cma-empty-mark"><MapPin size={23} aria-hidden="true" /></span><span className="cma-label">YOUR NEXT DESTINATION</span>
        <h2>Choose a tour stop</h2><p>Select a map marker or a location in the accessible list to inspect its event, eligibility and estimated travel plan.</p>
      </div>}
    </aside>
  );
}

export function Current() {
  const [filter, setFilter] = useState("ALL");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [region, setRegion] = useState("WORLD");
  const [view, setView] = useState<MapView>(MAP_VIEWS.WORLD);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState({ width: 720, height: 360 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const mapRef = useRef<SVGSVGElement>(null);
  const events = useMemo(() => filterMap(PREVIEW_EVENTS, filter, includeCompleted).sort((a, b) => a.id.localeCompare(b.id)), [filter, includeCompleted]);
  const clusters = useMemo(() => clusterLocations(events, view), [events, view]);
  const selection = events.filter((event) => selectedIds.includes(event.id));
  const event = events.find((item) => item.id === inspectedId) ?? selection[0];
  const pageCount = Math.max(1, Math.ceil(events.length / 20));
  const pageEvents = events.slice(page * 20, (page + 1) * 20);
  const scale = Math.min(size.width / view.width, size.height / view.height);
  const seasonProgress = Math.min(100, Math.max(0, (18 / 52) * 100));

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setSize({ width: bounds.width || 720, height: bounds.height || 360 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chooseCluster = (items: PreviewEvent[]) => {
    setSelectedIds(items.map((item) => item.id));
    setInspectedId(items[0]?.id ?? null);
  };
  const chooseEvent = (id: string) => { setSelectedIds([id]); setInspectedId(id); };
  const zoom = (factor: number) => setView((current) => {
    const width = Math.max(8, Math.min(720, current.width * factor));
    const height = width * current.height / current.width;
    return { ...current, x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height };
  });
  const changeRegion = (next: string) => {
    setRegion(next); setView(MAP_VIEWS[next]); setSelectedIds([]); setInspectedId(null); setPage(0);
  };
  const resetFilters = () => {
    setFilter("ALL"); setIncludeCompleted(false); setPage(0); changeRegion("WORLD");
  };

  return <div className="cma-root">
    <div className="cma-preview-note" role="note"><strong>LOCAL PREVIEW DATA</strong><span>Illustrative events, eligibility, routes and estimated costs only — not production data or player facts.</span></div>
    <header className="cma-header">
      <div className="cma-header-copy">
        <div className="cma-overline"><span>TKDL TOUR / SEASON 4</span><i aria-hidden="true" /> GEOGRAPHY &amp; OPPORTUNITY</div>
        <h1>Career <em>Map</em></h1><p>Every stop is a chance to move your season forward.</p>
      </div>
      <div className="cma-header-stamp" aria-label={`${events.length} matching events in ${clusters.length} locations`}>
        <span className="cma-stamp-icon"><Compass size={19} aria-hidden="true" /></span>
        <div><strong>{events.length.toString().padStart(2, "0")}</strong><small>EVENTS IN VIEW</small></div><div className="cma-stamp-divider" />
        <div><strong>{clusters.length.toString().padStart(2, "0")}</strong><small>LOCATIONS</small></div>
      </div>
    </header>
    <section className="cma-map-shell" aria-label="Tour event atlas">
      <div className="cma-map-topline">
        <div className="cma-map-title"><span className="cma-live-mark" aria-hidden="true" /><span className="cma-label">TOUR GEOGRAPHY</span><i aria-hidden="true" /><strong>{regionName(region)}</strong></div>
        <div className="cma-map-key" aria-label="Map legend"><span><i className="cma-key-eligible" />Eligible opportunity</span><span><i className="cma-key-other" />Other event</span></div>
      </div>
      <div className="cma-workspace">
        <section className="cma-filter-rail" aria-label="Map filters">
          <div className="cma-filter-heading"><span className="cma-label">YOUR ATLAS</span><SlidersHorizontal size={15} aria-hidden="true" /></div>
          <label className="cma-field"><span>Region</span><span className="cma-select-wrap">
            <select value={region} onChange={(change) => changeRegion(change.target.value)} aria-label="Map region">
              {Object.keys(MAP_VIEWS).map((item) => <option value={item} key={item}>{regionName(item)}</option>)}
            </select><ChevronDown size={14} aria-hidden="true" />
          </span></label>
          <label className="cma-field"><span>Activity</span><span className="cma-select-wrap">
            <select value={filter} onChange={(change) => { setFilter(change.target.value); setSelectedIds([]); setInspectedId(null); setPage(0); }} aria-label="Filter events by activity">
              <option value="OPPORTUNITIES">My Opportunities</option><option value="ENTERED">Entered</option><option value="ALL">All events</option>
              {[...new Set(PREVIEW_EVENTS.map((item) => item.content.circuitId))].sort().map((circuit) => <option value={circuit} key={circuit}>{titleCase(circuit)}</option>)}
            </select><ChevronDown size={14} aria-hidden="true" />
          </span></label>
          <label className="cma-completed"><input type="checkbox" checked={includeCompleted} onChange={(change) => setIncludeCompleted(change.target.checked)} />
            <span className="cma-check-ui"><Check size={11} aria-hidden="true" /></span><span>Include completed</span>
          </label>
          <div className="cma-filter-rule" />
          <div className="cma-filter-summary"><span className="cma-label">CURRENT SEASON</span><strong>4<small> / 52 WEEKS</small></strong>
            <span className="cma-season-progress"><i style={{ width: `${seasonProgress}%` }} /></span><small>Week 18 · Spring swing · preview</small>
          </div>
          <button className="cma-reset-filter" type="button" onClick={resetFilters}><RotateCcw size={13} aria-hidden="true" /> Reset filters</button>
          <p className="cma-approximation"><MapPin size={13} aria-hidden="true" /> Locations are city-level approximations, not road distances or travel bookings.</p>
        </section>
        <section className="cma-map-panel" aria-label="Interactive event map">
          <div className="cma-map-toolbar"><span className="cma-map-toolbar-region"><MapPin size={14} aria-hidden="true" />{regionName(region)}</span>
            <div className="cma-zoom-controls" role="group" aria-label="Map controls">
              <button type="button" aria-label="Zoom in" onClick={() => zoom(0.65)}><Plus size={16} aria-hidden="true" /></button>
              <button type="button" aria-label="Zoom out" onClick={() => zoom(1.5)}><Minus size={16} aria-hidden="true" /></button>
              <button type="button" aria-label="Reset map view" onClick={() => setView(MAP_VIEWS[region])}><LocateFixed size={15} aria-hidden="true" /></button>
            </div>
          </div>
          <div className={`cma-map-viewport ${drag ? "is-dragging" : ""}`}>
            <svg ref={mapRef} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" tabIndex={0}
              aria-label={`${regionName(region)} Career map; ${clusters.length} event locations. Use arrow keys to pan or use the accessible location list.`}
              onKeyDown={(keyboard) => {
                const directions: Record<string, [number, number]> = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
                const direction = directions[keyboard.key];
                if (keyboard.target === keyboard.currentTarget && direction) {
                  keyboard.preventDefault(); setView((current) => ({ ...current, x: current.x + direction[0] * current.width, y: current.y + direction[1] * current.height }));
                }
              }}
              onPointerDown={(pointer) => {
                if ((pointer.target as Element).closest("[data-map-marker]")) return;
                const matrix = pointer.currentTarget.getScreenCTM();
                if (!matrix) return;
                pointer.currentTarget.setPointerCapture(pointer.pointerId);
                const inverse = matrix.inverse();
                const point = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(inverse);
                setDrag({ x: point.x, y: point.y, view, inverse });
              }}
              onPointerMove={(pointer) => {
                if (!drag) return;
                const point = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(drag.inverse);
                setView({ ...drag.view, x: drag.view.x - (point.x - drag.x), y: drag.view.y - (point.y - drag.y) });
              }}
              onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
              <g pointerEvents="none" className="cma-map-geography">
                {Array.from({ length: 13 }, (_, index) => <line key={`longitude-${index}`} x1={index * 60} x2={index * 60} y1={0} y2={360} />)}
                {Array.from({ length: 7 }, (_, index) => <line key={`latitude-${index}`} x1={0} x2={720} y1={index * 60} y2={index * 60} />)}
                <image href="/__mockup/images/world-land.svg" x={0} y={0} width={720} height={360} />
                {view.width > 200 && [["NORTH AMERICA", 150, 95], ["SOUTH AMERICA", 240, 245], ["EUROPE", 386, 73], ["AFRICA", 395, 190], ["ASIA", 530, 110], ["OCEANIA", 635, 250]].map(([label, x, y]) =>
                  <text key={label} x={x} y={y} fontSize={9 / scale} textAnchor="middle" letterSpacing={1.2 / scale}>{label}</text>)}
              </g>
              {clusters.map((cluster) => {
                const eligible = cluster.events.some((item) => item.opportunity.canEnter);
                const active = cluster.events.some((item) => selectedIds.includes(item.id));
                return <g key={cluster.key} data-map-marker data-selected={active} className={`cma-map-marker ${eligible ? "is-eligible" : "is-other"} ${active ? "is-selected" : ""}`}
                  role="button" tabIndex={0} aria-label={`${cluster.events[0].venue.city}: ${cluster.events.length} ${cluster.events.length === 1 ? "event" : "events"}`}
                  onClick={() => chooseCluster(cluster.events)}
                  onKeyDown={(keyboard) => { if (keyboard.key === "Enter" || keyboard.key === " ") { keyboard.preventDefault(); chooseCluster(cluster.events); } }}>
                  <title>{cluster.events[0].venue.city} · {cluster.events.length} events</title>
                  <circle className="cma-marker-hit" cx={cluster.x} cy={cluster.y} r={30 / scale} />
                  <circle className="cma-marker-ring" cx={cluster.x} cy={cluster.y} r={21 / scale} />
                  <circle className="cma-marker-core" cx={cluster.x} cy={cluster.y} r={13 / scale} />
                  <text className="cma-marker-count" x={cluster.x} y={cluster.y + 3.7 / scale} textAnchor="middle" fontSize={10 / scale}>{cluster.events.length}</text>
                </g>;
              })}
            </svg>
            {!clusters.length && <div className="cma-no-locations" role="status"><Compass size={22} aria-hidden="true" /><strong>No matching activity here</strong><span>Change the activity filter or zoom out to explore.</span></div>}
            <div className="cma-map-coordinate" aria-hidden="true"><span>TKDL / FIELD GUIDE</span><b>{regionName(region).toUpperCase()}</b></div>
          </div>
          <div className="cma-map-footer"><span><MousePointer2 size={13} aria-hidden="true" />Drag to explore <i /> arrow keys to pan</span>
            <span>{clusters.length} {clusters.length === 1 ? "location" : "locations"} in view</span></div>
          <details className="cma-location-list"><summary><span><MapPin size={14} aria-hidden="true" />Accessible location list</span>
            <span>{clusters.length} LOCATIONS <ChevronDown size={14} aria-hidden="true" /></span></summary>
            <div className="cma-location-items">
              {clusters.map((cluster) => <button type="button" key={cluster.key} onClick={() => chooseCluster(cluster.events)}>
                <span className="cma-location-dot" /><span>{cluster.events[0].venue.city}<small>{cluster.events.length} {cluster.events.length === 1 ? "event" : "events"}</small></span><ChevronRight size={15} aria-hidden="true" />
              </button>)}
              {!clusters.length && <p>No locations match these filters.</p>}
            </div>
          </details>
        </section>
        <EventInspector event={event} selection={selection} onInspect={setInspectedId} onPreviewAction={setActionMessage} />
      </div>
    </section>
    <details className="cma-event-index"><summary><span><span className="cma-label">SEASON INDEX</span><strong>All matching events</strong></span>
      <span className="cma-index-summary">{events.length} EVENTS <ChevronDown size={15} aria-hidden="true" /></span></summary>
      <div className="cma-index-body">
        {pageEvents.length ? pageEvents.map((item, index) => <button type="button" key={item.id} className={`cma-index-row ${item.id === event?.id ? "is-current" : ""}`} onClick={() => chooseEvent(item.id)}>
          <span className="cma-index-number">{String(page * 20 + index + 1).padStart(2, "0")}</span><span className="cma-index-week">W{item.dates.startWeek}</span>
          <span className="cma-index-event"><strong>{item.name}</strong><small>{item.venue.city} · {titleCase(item.content.circuitId)}</small></span>
          <EventStatus event={item} /><ChevronRight size={15} aria-hidden="true" />
        </button>) : <p className="cma-index-empty">No events match the current filters.</p>}
        <div className="cma-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><span>PAGE {page + 1} / {pageCount}</span>
          <button type="button" disabled={(page + 1) * 20 >= events.length} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button>
        </div>
      </div>
    </details>
    <footer className="cma-footer"><span><span className="cma-footer-mark">T</span> TKDL TOUR ATLAS</span><span><MapPin size={13} aria-hidden="true" /> City-level approximations · no travel routing</span></footer>
    {actionMessage && <div className="cma-action-message" role="status"><span>{actionMessage}</span><button type="button" onClick={() => setActionMessage("")} aria-label="Dismiss preview message">Dismiss</button></div>}
  </div>;
}
