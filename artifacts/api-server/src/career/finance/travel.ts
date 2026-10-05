import { COUNTY_CATCHMENTS, LOCALITIES, VENUES } from "../calendar/geography.ts";
import { NEARBY_VENUES, TRAVEL_PROFILE, TRIP_MAX_GAP_DAYS, type TravelBand } from "./config.ts";

/**
 * Deterministic travel abstraction over A3 geography. Inputs are the player's
 * home (locality/country/zone from the A3 sporting-status provider) and the
 * event's venue/locality/country/zone. Nationality is never an input.
 */
export type Home = { locality: string; country: string; zone: string; travelVersion?:number };
export type EventPlace = { id: string; start_day: number; end_day: number; locality_key: string | null; venue_key: string; country: string; zone: string; city: string; circuit: string; series_key: string | null };

export function travelBand(home: Home, event: Pick<EventPlace, "locality_key" | "venue_key" | "country" | "zone">): TravelBand {
  // County sporting catchments are NOT travel catchments: old Ayrshire/Highlands
  // and country-wide Australian/Canadian fields must not imply free travel.
  if(home.travelVersion===2) {
    const locality=LOCALITIES.find(l=>l.key===home.locality);
    const venue=VENUES.find(v=>v.key===event.venue_key);
    if(event.country===home.country && (event.locality_key===home.locality ||
      (venue && locality && venue.region===locality.region) ||
      (NEARBY_VENUES_V2[home.locality]??[]).includes(event.venue_key)))return "LOCAL";
  } else {
    const catchment = COUNTY_CATCHMENTS[home.locality] ?? [home.locality];
    if ((event.locality_key && catchment.includes(event.locality_key)) || (NEARBY_VENUES[home.locality] ?? []).includes(event.venue_key)) return "LOCAL";
  }
  if (event.country === home.country) return "DOMESTIC";
  if (event.zone === "UK_IRELAND" && home.zone === "UK_IRELAND") return "UK_IRELAND";
  if (event.zone === "EUROPE" || (home.zone === "EUROPE" && event.zone === "UK_IRELAND")) return "EUROPE";
  return "LONG_HAUL";
}
/** Canonical exceptions only; same-region authored and generated venues are automatic. */
export const NEARBY_VENUES_V2:Record<string,readonly string[]> = {
  ayrshire:["glasgow-hall","foundry-glasgow","clyde-arena","kelvin-assembly"],
  "glasgow-clyde":["glasgow-hall","ayr-pavilion","burns-hall"],
  "edinburgh-lothians":["castle-exchange-edinburgh"],
  "central-scotland":["stirling-civic"],
  "north-east":["northern-forum-newcastle"], midlands:["midlands-oche"],
  "south-wales":["riverside-hall-cardiff"], leinster:["harbour-rooms-dublin"],
};

export const destinationOf = (band: TravelBand, event: Pick<EventPlace, "country" | "city">) => band === "LOCAL" ? "HOME" : band === "DOMESTIC" ? `${event.country}:${event.city}` : event.country;

/** Trip cost for a span of consecutive competition days (one outbound + one return). */
export function tripCost(band: TravelBand, spanDays: number) {
  const p = TRAVEL_PROFILE[band];
  const nights = spanDays >= p.overnightFromDays ? spanDays + p.extraNights : 0;
  return { band, travelPence: p.roundTripPence, nights, accommodationPence: nights * p.nightlyPence };
}

/**
 * Trip grouping: entered events sorted by start day chain into one trip while the
 * next event starts within TRIP_MAX_GAP_DAYS of the chain's end at the same
 * destination (series days always chain). LOCAL events never form trips.
 */
export function groupTrips(home: Home, events: readonly EventPlace[]) {
  const sorted = [...events].sort((a, b) => a.start_day - b.start_day || (a.id < b.id ? -1 : 1));
  const trips: { band: TravelBand; destination: string; start: number; end: number; events: EventPlace[] }[] = [];
  for (const event of sorted) {
    const band = travelBand(home, event);
    if (band === "LOCAL") continue;
    const destination = destinationOf(band, event);
    const last = trips[trips.length - 1];
    if (last && last.destination === destination && event.start_day - last.end <= TRIP_MAX_GAP_DAYS) {
      last.end = Math.max(last.end, event.end_day); last.events.push(event);
    } else trips.push({ band, destination, start: event.start_day, end: event.end_day, events: [event] });
  }
  return trips.map(t => ({ ...t, ...tripCost(t.band, t.end - t.start + 1) }));
}
