import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronDown, ChevronRight, Compass, Crosshair, LocateFixed, MapPin, Minus,
  MousePointer2, Plus, RotateCcw, SlidersHorizontal, Trophy,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import landMap from "./world-land.svg";
import { useWorldMap } from "../api";
import { CareerError, CareerLoading } from "../components";
import { MAP_VIEWS, clusterLocations, filterMap, mapState, planningCosts } from "../presentation";
import { denialLabel, formatPence, routeLines, titleCase } from "../model";
import type { RouteFact } from "../types";
import type { ShellContext } from "../shell";
import "../career-map-premium.css";

type MapPayload = NonNullable<ReturnType<typeof useWorldMap>["data"]>;
type MapEvent = MapPayload["events"][number];
type MapView = (typeof MAP_VIEWS)[keyof typeof MAP_VIEWS];
type DragState = { x: number; y: number; view: MapView; inverse: DOMMatrix };

const EMPTY_EVENTS: MapEvent[] = [];

function regionName(key: string) {
  return key === "UK_IRELAND" ? "UK & Ireland" : titleCase(key);
}

function EventStatus({ event }: { event: MapEvent }) {
  const entered = ["ENTERED", "CONFIRMED", "PLAYING"].includes(event.opportunity.state);
  return (
    <span
      className={`cma-status ${event.opportunity.canEnter ? "is-open" : entered ? "is-entered" : "is-closed"}`}
      data-testid={`status-map-event-${event.id}`}
    >
      {event.opportunity.canEnter && <i aria-hidden="true" />}
      {mapState(event)}
    </span>
  );
}

function EventInspector({
  event,
  selection,
  saveId,
  season,
  onInspect,
}: {
  event: MapEvent | undefined;
  selection: MapEvent[];
  saveId: string;
  season: number;
  onInspect: (id: string) => void;
}) {
  const costs = planningCosts(event?.financialCommitment);
  const routes = event?.qualification?.routes;
  const entered = !!event && ["ENTERED", "CONFIRMED", "PLAYING"].includes(event.opportunity.state);
  const eventPath = event
    ? event.status === "IN_PROGRESS" && event.opportunity.state === "ENTERED"
      ? `/career/${saveId}/tournaments/${event.id}`
      : `/career/${saveId}/events/${event.id}`
    : "";

  return (
    <aside className="cma-inspector" aria-label="Selected event details" data-testid="panel-selected-event">
      <div className="cma-inspector-heading">
        <span className="cma-label">EVENT INTELLIGENCE</span>
        <Crosshair size={15} aria-hidden="true" />
      </div>
      {selection.length > 1 && event && (
        <label className="cma-select-event">
          <span>Events at this location</span>
          <span className="cma-select-wrap">
            <select
              value={event.id}
              onChange={(change) => onInspect(change.target.value)}
              aria-label="Choose event at this location"
              data-testid="select-map-event-at-location"
            >
              {selection.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </label>
      )}
      {event ? (
        <>
          <div className="cma-event-kicker">
            <span>SEASON {season} <i /> WEEK {event.dates.startWeek}</span>
            <EventStatus event={event} />
          </div>
          <h2 className="cma-event-title" data-testid={`text-map-event-name-${event.id}`}>{event.name}</h2>
          <p className="cma-event-place"><MapPin size={14} aria-hidden="true" />{event.venue.displayName}, {event.venue.city}</p>
          <div className="cma-field-fact">
            <Trophy size={15} aria-hidden="true" />
            <span>{event.fieldDescriptor}</span>
          </div>

          <div className="cma-cost-block" aria-label="Estimated event costs" data-testid={`panel-map-costs-${event.id}`}>
            <div className="cma-cost-heading"><span>TRAVEL PLAN</span><small>ESTIMATES</small></div>
            {costs && (
              <dl>
                <div><dt>Commitment</dt><dd>{formatPence(costs.commitment)}</dd></div>
                <div><dt>Sponsor coverage</dt><dd className="is-covered">{formatPence(costs.coverage)}</dd></div>
                <div className="cma-cost-total"><dt>Your cost</dt><dd>{formatPence(costs.playerCost)}</dd></div>
              </dl>
            )}
            <p>Estimated figures · subject to change</p>
          </div>

          {!event.opportunity.canEnter && !entered && (
            <div className="cma-eligibility">
              <span className="cma-label">ENTRY ELIGIBILITY</span>
              <strong>Not currently eligible</strong>
              <p>{event.opportunity.reasons.length
                ? event.opportunity.reasons.map(denialLabel).join(" · ")
                : "Check registration dates and the event’s sporting routes."}</p>
            </div>
          )}
          {entered && (
            <div className="cma-entered-note"><Check size={15} aria-hidden="true" /><span>Already on your season schedule</span></div>
          )}
          {routes && (
            <div className="cma-route-facts" aria-label="Actual sporting routes">
              <span className="cma-label">SPORTING ROUTES</span>
              {routeLines(routes as RouteFact).map((route, index) => (
                <p key={`${route.text}-${index}`}>{route.text} <b>{route.met ? "Met" : "Not currently met"}</b></p>
              ))}
            </div>
          )}
          <Link className="cma-inspect-action" href={eventPath} data-testid={`link-review-map-event-${event.id}`}>
            {event.status === "IN_PROGRESS" && event.opportunity.state === "ENTERED" ? "Return to tournament" : "Inspect event"}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <div className="cma-empty-inspector">
          <span className="cma-empty-mark"><MapPin size={23} aria-hidden="true" /></span>
          <span className="cma-label">YOUR NEXT DESTINATION</span>
          <h2>Choose a tour stop</h2>
          <p>Select a map marker or a location in the accessible list to inspect its event, eligibility and estimated travel plan.</p>
        </div>
      )}
    </aside>
  );
}

export function CareerMapPage({ ctx }: { ctx: ShellContext }) {
  const params = new URLSearchParams(useSearch());
  const requestedRegion = params.get("region") ?? "WORLD";
  const initialRegion = MAP_VIEWS[requestedRegion] ? requestedRegion : "WORLD";
  const initialEvent = params.get("event");
  const q = useWorldMap(ctx.save.id);
  const [filter, setFilter] = useState(params.get("filter") ?? "OPPORTUNITIES");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [region, setRegion] = useState(initialRegion);
  const [view, setView] = useState<MapView>(MAP_VIEWS[initialRegion]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialEvent ? [initialEvent] : []);
  const [inspectedId, setInspectedId] = useState<string | null>(initialEvent);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState({ width: 720, height: 360 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const mapRef = useRef<SVGSVGElement>(null);

  const allEvents = q.data?.events ?? EMPTY_EVENTS;
  const events = useMemo(
    () => filterMap(allEvents, filter, includeCompleted).sort((a, b) => a.id.localeCompare(b.id)),
    [allEvents, filter, includeCompleted],
  );
  const clusters = useMemo(() => clusterLocations(events, view), [events, view]);
  const selection = events.filter((event) => selectedIds.includes(event.id));
  const event = events.find((item) => item.id === inspectedId) ?? selection[0];
  const pageCount = Math.max(1, Math.ceil(events.length / 20));
  const pageEvents = events.slice(page * 20, (page + 1) * 20);
  const scale = Math.min(size.width / view.width, size.height / view.height);
  const seasonProgress = Math.min(100, Math.max(0, (ctx.save.currentWeek / 52) * 100));

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
  }, [q.data]);

  const chooseCluster = (items: MapEvent[]) => {
    setSelectedIds(items.map((item) => item.id));
    setInspectedId(items[0]?.id ?? null);
  };
  const chooseEvent = (id: string) => {
    setSelectedIds([id]);
    setInspectedId(id);
  };
  const zoom = (factor: number) => setView((current) => {
    const width = Math.max(8, Math.min(720, current.width * factor));
    const height = width * current.height / current.width;
    return {
      ...current,
      x: current.x + (current.width - width) / 2,
      y: current.y + (current.height - height) / 2,
      width,
      height,
    };
  });
  const changeRegion = (next: string) => {
    setRegion(next);
    setView(MAP_VIEWS[next]);
    setSelectedIds([]);
    setInspectedId(null);
    setPage(0);
  };
  const resetFilters = () => {
    setFilter("OPPORTUNITIES");
    setIncludeCompleted(false);
    setPage(0);
    changeRegion("WORLD");
  };

  if (q.isLoading) return <CareerLoading label="Loading Career geography" />;
  if (q.error || !q.data) return <CareerError error={q.error ?? new Error("Career geography is unavailable")} onRetry={() => q.refetch()} />;

  return (
    <div className="cma-root">
      <header className="cma-header">
        <div className="cma-header-copy">
          <div className="cma-overline">
            <span>TKDL TOUR / SEASON {ctx.save.currentSeason}</span><i aria-hidden="true" /> GEOGRAPHY &amp; OPPORTUNITY
          </div>
          <h1>Career <em>Map</em></h1>
          <p>Every stop is a chance to move your season forward.</p>
        </div>
        <div className="cma-header-stamp" aria-label={`${events.length} matching events in ${clusters.length} locations`}>
          <span className="cma-stamp-icon"><Compass size={19} aria-hidden="true" /></span>
          <div><strong>{events.length.toString().padStart(2, "0")}</strong><small>EVENTS IN VIEW</small></div>
          <div className="cma-stamp-divider" />
          <div><strong>{clusters.length.toString().padStart(2, "0")}</strong><small>LOCATIONS</small></div>
        </div>
      </header>

      <section className="cma-map-shell" aria-label="Tour event atlas" data-testid="career-map-atlas">
        <div className="cma-map-topline">
          <div className="cma-map-title">
            <span className="cma-live-mark" aria-hidden="true" />
            <span className="cma-label">TOUR GEOGRAPHY</span>
            <i aria-hidden="true" />
            <strong>{regionName(region)}</strong>
          </div>
          <div className="cma-map-key" aria-label="Map legend">
            <span><i className="cma-key-eligible" />Eligible opportunity</span>
            <span><i className="cma-key-other" />Other event</span>
          </div>
        </div>

        <div className="cma-workspace">
          <section className="cma-filter-rail" aria-label="Map filters">
            <div className="cma-filter-heading">
              <span className="cma-label">YOUR ATLAS</span>
              <SlidersHorizontal size={15} aria-hidden="true" />
            </div>
            <label className="cma-field">
              <span>Region</span>
              <span className="cma-select-wrap">
                <select value={region} onChange={(change) => changeRegion(change.target.value)} aria-label="Map region" data-testid="select-map-region">
                  {Object.keys(MAP_VIEWS).map((item) => <option value={item} key={item}>{regionName(item)}</option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
            <label className="cma-field">
              <span>Activity</span>
              <span className="cma-select-wrap">
                <select
                  value={filter}
                  onChange={(change) => {
                    setFilter(change.target.value);
                    setSelectedIds([]);
                    setInspectedId(null);
                    setPage(0);
                  }}
                  aria-label="Filter events by activity"
                  data-testid="select-map-activity"
                >
                  <option value="OPPORTUNITIES">My Opportunities</option>
                  <option value="ENTERED">Entered</option>
                  <option value="ALL">All events · including inaccessible</option>
                  {[...new Set(allEvents.map((item) => item.content.circuitId))].sort().map((circuit) => (
                    <option value={circuit} key={circuit}>{titleCase(circuit)}</option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
            <label className="cma-completed">
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={(change) => setIncludeCompleted(change.target.checked)}
                data-testid="checkbox-map-completed"
              />
              <span className="cma-check-ui"><Check size={11} aria-hidden="true" /></span>
              <span>Include completed</span>
            </label>
            <div className="cma-filter-rule" />
            <div className="cma-filter-summary" data-testid="status-map-season">
              <span className="cma-label">CURRENT SEASON</span>
              <strong>{ctx.save.currentSeason}<small> / 52 WEEKS</small></strong>
              <span className="cma-season-progress"><i style={{ width: `${seasonProgress}%` }} /></span>
              <small>Week {ctx.save.currentWeek} · {ctx.overview?.grouping.name ?? "Season schedule"}</small>
            </div>
            <button className="cma-reset-filter" type="button" onClick={resetFilters} data-testid="button-reset-map-filters">
              <RotateCcw size={13} aria-hidden="true" /> Reset filters
            </button>
            <p className="cma-approximation"><MapPin size={13} aria-hidden="true" /> Locations are city-level approximations, not road distances or travel bookings.</p>
          </section>

          <section className="cma-map-panel" aria-label="Interactive event map">
            <div className="cma-map-toolbar">
              <span className="cma-map-toolbar-region"><MapPin size={14} aria-hidden="true" />{regionName(region)}</span>
              <div className="cma-zoom-controls" role="group" aria-label="Map controls">
                <button type="button" aria-label="Zoom in" onClick={() => zoom(0.65)} data-testid="button-map-zoom-in"><Plus size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Zoom out" onClick={() => zoom(1.5)} data-testid="button-map-zoom-out"><Minus size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Reset map view" onClick={() => setView(MAP_VIEWS[region])} data-testid="button-map-reset-view"><LocateFixed size={15} aria-hidden="true" /></button>
              </div>
            </div>
            <div className={`cma-map-viewport ${drag ? "is-dragging" : ""}`}>
              <svg
                ref={mapRef}
                viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
                role="group"
                tabIndex={0}
                aria-label={`${regionName(region)} Career map; ${clusters.length} event locations. Use arrow keys to pan or use the accessible location list.`}
                data-testid="map-interactive-canvas"
                onKeyDown={(keyboard) => {
                  const directions: Record<string, [number, number]> = {
                    ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1],
                  };
                  const direction = directions[keyboard.key];
                  if (keyboard.target === keyboard.currentTarget && direction) {
                    keyboard.preventDefault();
                    setView((current) => ({
                      ...current,
                      x: current.x + direction[0] * current.width,
                      y: current.y + direction[1] * current.height,
                    }));
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
                onPointerUp={() => setDrag(null)}
                onPointerCancel={() => setDrag(null)}
              >
                <g pointerEvents="none" className="cma-map-geography">
                  {Array.from({ length: 13 }, (_, index) => (
                    <line key={`longitude-${index}`} x1={index * 60} x2={index * 60} y1={0} y2={360} />
                  ))}
                  {Array.from({ length: 7 }, (_, index) => (
                    <line key={`latitude-${index}`} x1={0} x2={720} y1={index * 60} y2={index * 60} />
                  ))}
                  <image href={landMap} x={0} y={0} width={720} height={360} />
                  {view.width > 200 && [
                    ["NORTH AMERICA", 150, 95], ["SOUTH AMERICA", 240, 245], ["EUROPE", 386, 73],
                    ["AFRICA", 395, 190], ["ASIA", 530, 110], ["OCEANIA", 635, 250],
                  ].map(([label, x, y]) => (
                    <text key={label} x={x} y={y} fontSize={9 / scale} textAnchor="middle" letterSpacing={1.2 / scale}>{label}</text>
                  ))}
                </g>
                {clusters.map((cluster) => {
                  const eligible = cluster.events.some((item) => item.opportunity.canEnter);
                  const active = cluster.events.some((item) => selectedIds.includes(item.id));
                  return (
                    <g
                      key={cluster.key}
                      data-map-marker
                      data-selected={active}
                      className={`cma-map-marker ${eligible ? "is-eligible" : "is-other"} ${active ? "is-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${cluster.events[0].venue.city}: ${cluster.events.length} ${cluster.events.length === 1 ? "event" : "events"}`}
                      data-testid={`button-map-marker-${cluster.key}`}
                      onClick={() => chooseCluster(cluster.events)}
                      onKeyDown={(keyboard) => {
                        if (keyboard.key === "Enter" || keyboard.key === " ") {
                          keyboard.preventDefault();
                          chooseCluster(cluster.events);
                        }
                      }}
                    >
                      <title>{cluster.events[0].venue.city} · {cluster.events.length} events</title>
                      <circle className="cma-marker-hit" cx={cluster.x} cy={cluster.y} r={30 / scale} />
                      <circle className="cma-marker-ring" cx={cluster.x} cy={cluster.y} r={21 / scale} />
                      <circle className="cma-marker-core" cx={cluster.x} cy={cluster.y} r={13 / scale} />
                      <text className="cma-marker-count" x={cluster.x} y={cluster.y + 3.7 / scale} textAnchor="middle" fontSize={10 / scale}>{cluster.events.length}</text>
                    </g>
                  );
                })}
              </svg>
              {!clusters.length && (
                <div className="cma-no-locations" role="status" data-testid="status-map-empty">
                  <Compass size={22} aria-hidden="true" />
                  <strong>No matching activity here</strong>
                  <span>Change the activity filter or zoom out to explore.</span>
                </div>
              )}
              <div className="cma-map-coordinate" aria-hidden="true"><span>TKDL / FIELD GUIDE</span><b>{regionName(region).toUpperCase()}</b></div>
            </div>
            <div className="cma-map-footer">
              <span><MousePointer2 size={13} aria-hidden="true" />Drag to explore <i /> arrow keys to pan</span>
              <span data-testid="text-map-locations-in-view">{clusters.length} {clusters.length === 1 ? "location" : "locations"} in view</span>
            </div>
            <details className="cma-location-list">
              <summary>
                <span><MapPin size={14} aria-hidden="true" />Accessible location list</span>
                <span>{clusters.length} LOCATIONS <ChevronDown size={14} aria-hidden="true" /></span>
              </summary>
              <div className="cma-location-items">
                {clusters.map((cluster) => (
                  <button type="button" key={cluster.key} onClick={() => chooseCluster(cluster.events)} data-testid={`button-map-location-${cluster.key}`}>
                    <span className="cma-location-dot" />
                    <span>{cluster.events[0].venue.city}<small>{cluster.events.length} {cluster.events.length === 1 ? "event" : "events"}</small></span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                ))}
                {!clusters.length && <p>No locations match these filters.</p>}
              </div>
            </details>
          </section>

          <EventInspector event={event} selection={selection} saveId={ctx.save.id} season={ctx.save.currentSeason} onInspect={setInspectedId} />
        </div>
      </section>

      <details className="cma-event-index">
        <summary>
          <span><span className="cma-label">SEASON INDEX</span><strong>All matching events</strong></span>
          <span className="cma-index-summary">{events.length} EVENTS <ChevronDown size={15} aria-hidden="true" /></span>
        </summary>
        <div className="cma-index-body">
          {pageEvents.length ? pageEvents.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`cma-index-row ${item.id === event?.id ? "is-current" : ""}`}
              onClick={() => chooseEvent(item.id)}
              data-testid={`button-map-event-${item.id}`}
            >
              <span className="cma-index-number">{String(page * 20 + index + 1).padStart(2, "0")}</span>
              <span className="cma-index-week">W{item.dates.startWeek}</span>
              <span className="cma-index-event"><strong>{item.name}</strong><small>{item.venue.city} · {titleCase(item.content.circuitId)}</small></span>
              <EventStatus event={item} />
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          )) : <p className="cma-index-empty">No events match the current filters.</p>}
          <div className="cma-pagination">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} data-testid="button-map-previous-page">Previous</button>
            <span>PAGE {page + 1} / {pageCount}</span>
            <button type="button" disabled={(page + 1) * 20 >= events.length} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} data-testid="button-map-next-page">Next</button>
          </div>
        </div>
      </details>
      <footer className="cma-footer">
        <span><span className="cma-footer-mark">T</span> TKDL TOUR ATLAS</span>
        <span><MapPin size={13} aria-hidden="true" /> City-level approximations · no travel routing</span>
      </footer>
    </div>
  );
}
