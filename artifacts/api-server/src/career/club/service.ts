import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { COUNTRIES, LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { dartsNation, selectionRank } from "../calendar/pairs.ts";
import { CLUB, NATION_NAMES, clubName, countyTeam, interCounty, leagueSeason, memberPoints, type ClubResult, type ClubSeason } from "./model.ts";

type Row = Record<string, unknown>;
const seasonFrom = (r: Row): ClubSeason => ({ season: Number(r.season), country: String(r.country), localityKey: String(r.locality_key), division: Number(r.division),
  points: Number(r.points), position: Number(r.position), captainKey: r.captain_key ? String(r.captain_key) : null });

export type ClubView = {
  club: { localityKey: string; name: string; city: string; region: string; country: string } | null;
  season: number;
  members: { key: string; name: string; you: boolean; active: boolean; professional: boolean; seasonPoints: number; lastSeasonPoints: number; titles: number }[];
  captain: { key: string; name: string; you: boolean } | null;
  /** Your division this season (live), with every club's points. */
  table: { division: number; rows: { localityKey: string; name: string; points: number; position: number; you: boolean }[] } | null;
  history: { season: number; division: number; position: number; points: number; champions: boolean; promoted: boolean; relegated: boolean }[];
  legend: boolean;
  /** Your county's A team (last season's six best scorers) and the Inter-County standings. */
  county: { name: string; aTeam: { key: string; name: string; you: boolean; points: number }[]; youSelected: boolean; youSelectedLastSeason: boolean;
    standings: { localityKey: string; name: string; points: number; position: number; you: boolean }[];
    lastSeasonChampion: { name: string; you: boolean } | null } | null;
  /** Your darts nation: who would be picked for the World Cup on today's rankings, and who has represented it. */
  nation: { code: string; name: string; candidates: { key: string; name: string; you: boolean; ranking: string }[]; yourPlace: number | null; selected: boolean;
    worldCups: { season: number; players: string[]; you: boolean }[] } | null;
};

/** Your home club, its county league (finished seasons stored once; the current season live) and its members. */
export function createCareerClubService(database: CareerDatabase) {
  return {
    async read(actor: CareerActor, saveId: string): Promise<ClubView> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Row & { id: string; current_season: number };
        const season = Number(root.current_season);
        const home = String((await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${saveId}`)).rows[0]?.home_locality
          ?? (root.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
        const locality = LOCALITIES.find(l => l.key === home);
        if (!locality) return { club: null, season, members: [], captain: null, table: null, history: [], legend: false, county: null, nation: null };
        const country = locality.country;
        // Leagues and county darts run within each darts nation (Scotland, England, Wales and Northern Ireland separately).
        const code = dartsNation(country, locality.key);
        const leagueLocalities = LOCALITIES.filter(l => l.country === country && dartsNation(l.country, l.key) === code).map(l => ({ ...l, country: code }));
        const players = (await tx.execute(sql`SELECT id,first_name,surname,home_region,status,professional_status FROM career_world_players
          WHERE career_save_id=${saveId} AND nationality=${country}`)).rows;
        const localityOf = new Map<string, string | null>(players.map(p => [String(p.id), localityByRegion(String(p.home_region))?.key ?? null]));
        localityOf.set("HUMAN", locality.key);
        const stored = (await tx.execute(sql`SELECT * FROM career_club_seasons WHERE career_save_id=${saveId} AND country=${code} ORDER BY season`)).rows.map(seasonFrom);
        const storedSeasons = new Set(stored.map(s => s.season));
        // Finished seasons not stored yet (an existing save, or a season just ended), then the current one live.
        const missing = Array.from({ length: season - 1 }, (_, i) => i + 1).filter(s => !storedSeasons.has(s));
        const needed = [...new Set([...missing.flatMap(s => [s - 1, s]), season - 2, season - 1, season])].filter(s => s >= 1);
        const results: ClubResult[] = (await tx.execute(sql`SELECT r.participant_key,r.finishing_position,i.season FROM career_event_results r
          JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
          WHERE r.career_save_id=${saveId} AND i.status='COMPLETED' AND i.country=${country} AND i.classification<>'QUALIFIER'
            AND i.circuit IN (${sql.join(CLUB.circuits.map(c => sql`${c}`), sql`,`)}) AND i.season IN (${sql.join(needed.map(s => sql`${s}`), sql`,`)})`)).rows
          .map(r => ({ season: Number(r.season), participantKey: String(r.participant_key), locality: localityOf.get(String(r.participant_key)) ?? null, position: Number(r.finishing_position) }));
        const bySeason = new Map<number, ClubSeason[]>();
        for (const s of stored) bySeason.set(s.season, [...(bySeason.get(s.season) ?? []), s]);
        for (const s of missing) {
          const table = leagueSeason(code, leagueLocalities, results, s, bySeason.get(s - 1) ?? null);
          bySeason.set(s, table);
          await tx.execute(sql`INSERT INTO career_club_seasons (career_save_id,season,country,locality_key,division,points,position,captain_key)
            SELECT ${saveId}::uuid,t.season,t.country,t.locality_key,t.division,t.points,t.position,t.captain_key
            FROM jsonb_to_recordset(${JSON.stringify(table.map(t => ({ season: t.season, country: t.country, locality_key: t.localityKey, division: t.division,
              points: t.points, position: t.position, captain_key: t.captainKey })))}::jsonb)
              AS t(season integer,country text,locality_key text,division integer,points integer,position integer,captain_key text)
            ON CONFLICT DO NOTHING`);
        }
        const current = leagueSeason(code, leagueLocalities, results, season, bySeason.get(season - 1) ?? null);
        const mine = current.find(c => c.localityKey === locality.key)!;
        const nameOf = (key: string) => key === "HUMAN" ? "You" : (p => p ? `${p.first_name} ${p.surname}` : "Club member")(players.find(p => String(p.id) === key));
        const now = memberPoints(results, season), last = memberPoints(results, season - 1);
        const titles = new Map((await tx.execute(sql`SELECT r.participant_key,COUNT(*)::int AS n FROM career_event_results r
          JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
          WHERE r.career_save_id=${saveId} AND r.is_champion AND i.classification<>'QUALIFIER' GROUP BY r.participant_key`)).rows
          .map(r => [String(r.participant_key), Number(r.n)]));
        const memberKeys = ["HUMAN", ...players.filter(p => localityOf.get(String(p.id)) === locality.key).map(p => String(p.id))];
        const members = memberKeys.map(key => {
          const p = players.find(x => String(x.id) === key);
          return { key, name: nameOf(key), you: key === "HUMAN", active: key === "HUMAN" || p?.status === "ACTIVE", professional: key === "HUMAN" ? false : p?.professional_status === "PROFESSIONAL",
            seasonPoints: now.get(key)?.points ?? 0, lastSeasonPoints: last.get(key)?.points ?? 0, titles: titles.get(key) ?? 0 };
        }).sort((a, b) => b.seasonPoints - a.seasonPoints || b.lastSeasonPoints - a.lastSeasonPoints || Number(b.you) - Number(a.you) || a.name.localeCompare(b.name));
        const clubLocality = (key: string) => LOCALITIES.find(l => l.key === key)!;
        const history = [...bySeason.entries()].sort((a, b) => a[0] - b[0]).flatMap(([s, table]) => {
          const row = table.find(t => t.localityKey === locality.key); if (!row) return [];
          const next = s + 1 === season ? current : bySeason.get(s + 1), after = next?.find(t => t.localityKey === locality.key);
          return [{ season: s, division: row.division, position: row.position, points: row.points, champions: row.position === 1,
            promoted: !!after && after.division < row.division, relegated: !!after && after.division > row.division }];
        });
        const pro = (await tx.execute(sql`SELECT has_tour_card FROM career_saves WHERE id=${saveId}`)).rows[0]?.has_tour_card === true;
        // County: last season's six best scorers form the A team; Inter-County adds each area's six best this season.
        const countryLocalities = leagueLocalities;
        const aTeam = countyTeam(results, season, locality.key), previousTeam = countyTeam(results, season - 1, locality.key);
        const standings = interCounty(results, season, countryLocalities.map(l => l.key)), lastStandings = season > 1 ? interCounty(results, season - 1, countryLocalities.map(l => l.key)) : [];
        const regionName = (key: string) => countryLocalities.find(l => l.key === key)!.region;
        const county = {
          name: `${locality.region} County`, aTeam: aTeam.map(m => ({ key: m.key, name: nameOf(m.key), you: m.key === "HUMAN", points: m.points })),
          youSelected: aTeam.some(m => m.key === "HUMAN"), youSelectedLastSeason: previousTeam.some(m => m.key === "HUMAN"),
          standings: standings.map(c => ({ localityKey: c.locality, name: regionName(c.locality), points: c.points, position: c.position, you: c.locality === locality.key })),
          lastSeasonChampion: lastStandings[0] && lastStandings[0].points > 0 ? { name: regionName(lastStandings[0].locality), you: lastStandings[0].locality === locality.key } : null,
        };
        // Nation: the World Cup's own selection order on the latest published rankings (no hidden ratings).
        const ranks = (await tx.execute(sql`SELECT DISTINCT ON (s.list_key,r.participant_key) s.list_key,r.participant_key,r.position
          FROM career_ranking_snapshots s JOIN career_ranking_snapshot_rows r ON r.career_save_id=s.career_save_id AND r.snapshot_id=s.id
          WHERE s.career_save_id=${saveId} AND s.list_key IN ('pro-world','open-world','amateur')
            AND s.sequence=(SELECT MAX(sequence) FROM career_ranking_snapshots x WHERE x.career_save_id=s.career_save_id AND x.list_key=s.list_key)
          ORDER BY s.list_key,r.participant_key`)).rows;
        const rankingsOf = (key: string) => Object.fromEntries(ranks.filter(r => String(r.participant_key) === key).map(r => [String(r.list_key), Number(r.position)]));
        const label = (rk: Record<string, number>) => rk["pro-world"] !== undefined ? `World #${rk["pro-world"]}` : rk["open-world"] !== undefined ? `Open #${rk["open-world"]}` : rk.amateur !== undefined ? `Amateur #${rk.amateur}` : "Unranked";
        const compatriots = ["HUMAN", ...players.filter(p => p.status === "ACTIVE" && dartsNation(country, localityOf.get(String(p.id)) ?? null) === code).map(p => String(p.id))];
        const ranked = compatriots.map(key => ({ key, rk: rankingsOf(key) })).map(c => ({ ...c, order: selectionRank(c.rk) }))
          .filter((c): c is typeof c & { order: number } => c.order !== undefined).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
        const place = ranked.findIndex(c => c.key === "HUMAN");
        const cups = (await tx.execute(sql`SELECT i.season,p.captain_key,p.partner_key FROM career_event_pairs p
          JOIN career_event_instances i ON i.career_save_id=p.career_save_id AND i.id=p.event_id
          WHERE p.career_save_id=${saveId} AND p.nation=${code} ORDER BY i.season DESC LIMIT 6`)).rows;
        const nation = {
          code, name: NATION_NAMES[code] ?? COUNTRIES[code]?.name ?? code,
          candidates: ranked.slice(0, 6).map(c => ({ key: c.key, name: nameOf(c.key), you: c.key === "HUMAN", ranking: label(c.rk) })),
          yourPlace: place >= 0 ? place + 1 : null, selected: place >= 0 && place < 2,
          worldCups: cups.map(r => ({ season: Number(r.season), players: [String(r.captain_key), String(r.partner_key)].map(nameOf),
            you: r.captain_key === "HUMAN" || r.partner_key === "HUMAN" })),
        };
        return {
          club: { localityKey: locality.key, name: clubName(locality), city: locality.city, region: locality.region, country },
          season, members,
          captain: mine.captainKey ? { key: mine.captainKey, name: nameOf(mine.captainKey), you: mine.captainKey === "HUMAN" } : null,
          table: { division: mine.division, rows: current.filter(c => c.division === mine.division).sort((a, b) => a.position - b.position)
            .map(c => ({ localityKey: c.localityKey, name: clubName(clubLocality(c.localityKey)), points: c.points, position: c.position, you: c.localityKey === locality.key })) },
          history,
          legend: pro && history.length > 0,
          county, nation,
        };
      });
    },
  };
}
