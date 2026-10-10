import { useMemo, useState } from "react";
import { useSponsorMarket } from "../api";
import { CareerSection, OSWALD } from "../components";

const humanize = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

type SponsorRelationship = {
  id: string;
  npcId: string;
  npcName: string;
  sponsorKey: string;
  sponsorName: string;
  category: string;
  tier: string;
  status: string;
  startSeason: number;
  startWeek: number;
  endSeason: number | null;
  endWeek: number | null;
};

export function SponsorMarket({ saveId }: { saveId: string }) {
  const query = useSponsorMarket(saveId);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [view, setView] = useState<"roster" | "profile">("roster");

  const relationships = query.data?.relationships ?? [];
  const selectedRelationship = useMemo(
    () => relationships.find((relationship: SponsorRelationship) => relationship.id === selectedRelationshipId) ?? relationships[0] ?? null,
    [relationships, selectedRelationshipId],
  );
  const selectedNpcEvents = useMemo(
    () => selectedRelationship ? (query.data?.events ?? []).filter((event) => event.npcId === selectedRelationship.npcId) : [],
    [query.data?.events, selectedRelationship],
  );

  if (query.isLoading) {
    return (
      <CareerSection title="SP-F sponsorship market">
        <div className="grid gap-3 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" aria-label="Loading sponsorship market">
          <div className="space-y-2">
            {[0, 1, 2].map((item) => <div key={item} className="h-[82px] animate-pulse rounded-lg border border-white/[.07] bg-white/[.035]" />)}
          </div>
          <div className="min-h-56 animate-pulse rounded-lg border border-white/[.07] bg-white/[.035]" />
        </div>
      </CareerSection>
    );
  }

  if (query.error || !query.data) {
    return (
      <CareerSection title="SP-F sponsorship market">
        <div className="rounded-lg border border-rose-200/20 bg-rose-950/20 p-5">
          <p className="text-[10px] uppercase tracking-[.2em] text-rose-200/75">Market feed unavailable</p>
          <p className="mt-2 text-sm text-white/70">The recorded sponsor market could not be loaded.</p>
          <button type="button" className="career-button-secondary mt-4" onClick={() => void query.refetch()} data-testid="button-retry-sponsor-market">
            Retry market feed
          </button>
        </div>
      </CareerSection>
    );
  }

  const period = query.data.period;
  const events = query.data.events ?? [];

  return (
    <CareerSection title="SP-F sponsorship market">
      <div className="overflow-hidden rounded-xl border border-amber-200/15 bg-[#07111b]">
        <header className="relative border-b border-white/[.08] px-4 py-4 sm:px-5">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60" aria-hidden="true"
            style={{ background: "linear-gradient(110deg, transparent, rgba(199,154,76,.07))" }} />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-amber-200/75">SP-F · Commercial intelligence</p>
              <h2 className="mt-1 text-2xl leading-tight text-white sm:text-[28px]" style={OSWALD}>Sponsorship market</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/55">Recorded sponsor relationships and commercial activity across the field.</p>
            </div>
            <div className="rounded-md border border-amber-200/15 bg-amber-100/[.04] px-3 py-2">
              <p className="text-[9px] uppercase tracking-[.17em] text-white/45">Market period</p>
              <p className="mt-0.5 font-mono text-sm text-amber-100" data-testid="text-market-period">S{period.season} · W{period.week}</p>
            </div>
          </div>
          <div className="relative mt-4 flex gap-1 border-b border-white/[.08]" role="tablist" aria-label="Sponsorship market views">
            <button type="button" role="tab" aria-selected={view === "roster"} onClick={() => setView("roster")}
              className={`border-b-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.16em] transition-colors ${view === "roster" ? "border-amber-200 text-amber-100" : "border-transparent text-white/45 hover:text-white/75"}`}
              data-testid="tab-sponsor-roster">Relationship roster <span className="ml-1 font-mono text-white/40">{relationships.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={view === "profile"} onClick={() => setView("profile")}
              className={`border-b-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.16em] transition-colors ${view === "profile" ? "border-amber-200 text-amber-100" : "border-transparent text-white/45 hover:text-white/75"}`}
              data-testid="tab-rival-profile">Rival profile</button>
          </div>
        </header>

        <section className="border-b border-white/[.08] px-3 py-3 sm:px-5" aria-label="Active sponsor brand rosters">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-white/45">Active brand rosters</p>
            <span className="font-mono text-[10px] text-white/35">
              {query.data.brandRosters.filter((brand) => brand.players.length > 0).length.toString().padStart(2, "0")} brands
            </span>
          </div>
          {query.data.brandRosters.filter((brand) => brand.players.length > 0).length === 0 ? (
            <p className="text-xs text-white/45">No active NPC brand representatives are recorded yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {query.data.brandRosters.filter((brand) => brand.players.length > 0).map((brand) => (
                <article key={brand.sponsorKey} className="rounded-lg border border-amber-100/10 bg-white/[.025] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-white/85">{brand.sponsorName}</h3>
                    <span className="shrink-0 text-[9px] uppercase tracking-wider text-amber-100/70">{humanize(brand.category)}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                    {brand.players.map((player) => player.npcName).join(" · ")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {relationships.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-8">
            <div className="mx-auto mb-4 h-px w-12 bg-amber-200/40" />
            <h3 className="text-xl text-white" style={OSWALD}>No recorded relationships</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/50">Sponsor relationships will appear here once they are recorded in this Career save.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-[minmax(230px,0.72fr)_minmax(0,1.28fr)]">
            <section className={`${view === "profile" ? "hidden md:block" : ""} border-b border-white/[.08] md:border-b-0 md:border-r`} aria-label="Sponsor relationship roster">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[9px] uppercase tracking-[.2em] text-white/40">Field relationships</p>
                <span className="font-mono text-[10px] text-white/35">{relationships.length.toString().padStart(2, "0")}</span>
              </div>
              <div className="max-h-[440px] space-y-1 overflow-y-auto px-2 pb-2">
                {relationships.map((relationship: SponsorRelationship, index: number) => {
                  const active = (selectedRelationship?.id ?? relationships[0]?.id) === relationship.id;
                  return (
                    <button type="button" key={relationship.id} onClick={() => setSelectedRelationshipId(relationship.id)}
                      aria-pressed={active}
                      className={`group w-full rounded-md border px-3 py-3 text-left transition-colors ${active ? "border-amber-200/25 bg-amber-100/[.07]" : "border-transparent hover:border-white/[.08] hover:bg-white/[.025]"}`}
                      data-testid={`button-market-relationship-${relationship.id}`}>
                      <div className="flex items-start gap-3">
                        <span className={`pt-0.5 font-mono text-[10px] ${active ? "text-amber-200" : "text-white/30"}`}>{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">{relationship.npcName}</span>
                          <span className="mt-1 block truncate text-[11px] text-white/50">{relationship.sponsorName}</span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/55">{humanize(relationship.tier)}</span>
                            <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${relationship.status === "ACTIVE" ? "border-emerald-200/20 text-emerald-100/75" : "border-white/10 text-white/45"}`}>{humanize(relationship.status)}</span>
                          </span>
                        </span>
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200/60 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={`${view === "roster" ? "" : ""} min-w-0`} aria-label="Selected rival sponsor profile">
              {view === "profile" && (
                <div className="border-b border-white/[.08] px-4 py-3 md:hidden">
                  <label htmlFor="market-profile-select" className="mb-1.5 block text-[9px] uppercase tracking-[.18em] text-white/45">Choose a rival profile</label>
                  <select id="market-profile-select" value={selectedRelationship?.id ?? ""} onChange={(event) => setSelectedRelationshipId(event.target.value)}
                    className="w-full rounded-md border border-white/15 bg-[#0b1823] px-3 py-2.5 text-sm text-white" data-testid="select-rival-profile">
                    {relationships.map((relationship: SponsorRelationship) => <option key={relationship.id} value={relationship.id}>{relationship.npcName} · {relationship.sponsorName}</option>)}
                  </select>
                </div>
              )}
              {selectedRelationship && (
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-[.21em] text-cyan-100/60">Rival sponsor profile</p>
                      <h3 className="mt-1 truncate text-3xl leading-tight text-white sm:text-[34px]" style={OSWALD} data-testid={`text-rival-name-${selectedRelationship.id}`}>{selectedRelationship.npcName}</h3>
                      <p className="mt-1 text-sm text-white/55">{selectedRelationship.sponsorName}</p>
                    </div>
                    <button type="button" className="career-button-secondary md:hidden" onClick={() => setView("roster")} data-testid="button-back-to-market-roster">Back to roster</button>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/[.08] bg-white/[.08] sm:grid-cols-4">
                    {[
                      ["Sponsor", selectedRelationship.sponsorName],
                      ["Category", humanize(selectedRelationship.category)],
                      ["Tier", humanize(selectedRelationship.tier)],
                      ["Status", humanize(selectedRelationship.status)],
                    ].map(([name, value]) => <div key={name} className="min-w-0 bg-[#0a1620] px-3 py-3">
                      <p className="text-[9px] uppercase tracking-[.16em] text-white/40">{name}</p>
                      <p className="mt-1 truncate text-xs font-medium text-white/85" title={value}>{value}</p>
                    </div>)}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-white/[.07] py-3">
                    <p className="text-[9px] uppercase tracking-[.17em] text-white/40">Relationship term</p>
                    <p className="font-mono text-xs text-white/75">
                      S{selectedRelationship.startSeason} W{selectedRelationship.startWeek}
                      <span className="mx-2 text-white/25">→</span>
                      {selectedRelationship.endSeason === null || selectedRelationship.endWeek === null
                        ? "Ongoing"
                        : `S${selectedRelationship.endSeason} W${selectedRelationship.endWeek}`}
                    </p>
                  </div>
                  <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-[.2em] text-amber-100/60">Commercial record</p>
                        <h4 className="mt-1 text-lg text-white" style={OSWALD}>Recorded activity</h4>
                      </div>
                      <span className="font-mono text-[10px] text-white/40">{selectedNpcEvents.length.toString().padStart(2, "0")} ENTRIES</span>
                    </div>
                    {selectedNpcEvents.length === 0 ? (
                      <p className="rounded-md border border-dashed border-white/10 px-3 py-4 text-sm text-white/45">No commercial events are recorded for this profile.</p>
                    ) : (
                      <ol className="space-y-2">
                        {selectedNpcEvents.map((event) => (
                          <li key={event.id} className="relative rounded-md border border-white/[.08] bg-white/[.025] p-3 sm:p-3.5" data-testid={`market-event-${event.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                              <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-cyan-100/65">{humanize(event.eventType)}</p>
                              <p className="font-mono text-[10px] text-white/40">S{event.season} · W{event.week}</p>
                            </div>
                            <h5 className="mt-1.5 text-sm font-medium text-white">{event.title}</h5>
                            <p className="mt-1 text-xs leading-relaxed text-white/55">{event.summary}</p>
                            <p className="mt-2 text-[9px] uppercase tracking-wider text-white/35">{event.sponsorName}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </CareerSection>
  );
}
