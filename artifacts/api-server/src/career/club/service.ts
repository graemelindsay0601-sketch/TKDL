import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { CLUB, clubName, leagueSeason, memberPoints, type ClubResult, type ClubSeason } from "./model.ts";

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
        if (!locality) return { club: null, season, members: [], captain: null, table: null, history: [], legend: false };
        const country = locality.country;
        const players = (await tx.execute(sql`SELECT id,first_name,surname,home_region,status,professional_status FROM career_world_players
          WHERE career_save_id=${saveId} AND nationality=${country}`)).rows;
        const localityOf = new Map<string, string | null>(players.map(p => [String(p.id), localityByRegion(String(p.home_region))?.key ?? null]));
        localityOf.set("HUMAN", locality.key);
        const stored = (await tx.execute(sql`SELECT * FROM career_club_seasons WHERE career_save_id=${saveId} AND country=${country} ORDER BY season`)).rows.map(seasonFrom);
        const storedSeasons = new Set(stored.map(s => s.season));
        // Finished seasons not stored yet (an existing save, or a season just ended), then the current one live.
        const missing = Array.from({ length: season - 1 }, (_, i) => i + 1).filter(s => !storedSeasons.has(s));
        const needed = [...new Set([...missing.flatMap(s => [s - 1, s]), season - 1, season])].filter(s => s >= 1);
        const results: ClubResult[] = (await tx.execute(sql`SELECT r.participant_key,r.finishing_position,i.season FROM career_event_results r
          JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
          WHERE r.career_save_id=${saveId} AND i.status='COMPLETED' AND i.country=${country} AND i.classification<>'QUALIFIER'
            AND i.circuit IN (${sql.join(CLUB.circuits.map(c => sql`${c}`), sql`,`)}) AND i.season IN (${sql.join(needed.map(s => sql`${s}`), sql`,`)})`)).rows
          .map(r => ({ season: Number(r.season), participantKey: String(r.participant_key), locality: localityOf.get(String(r.participant_key)) ?? null, position: Number(r.finishing_position) }));
        const bySeason = new Map<number, ClubSeason[]>();
        for (const s of stored) bySeason.set(s.season, [...(bySeason.get(s.season) ?? []), s]);
        for (const s of missing) {
          const table = leagueSeason(country, LOCALITIES, results, s, bySeason.get(s - 1) ?? null);
          bySeason.set(s, table);
          await tx.execute(sql`INSERT INTO career_club_seasons (career_save_id,season,country,locality_key,division,points,position,captain_key)
            SELECT ${saveId}::uuid,t.season,t.country,t.locality_key,t.division,t.points,t.position,t.captain_key
            FROM jsonb_to_recordset(${JSON.stringify(table.map(t => ({ season: t.season, country: t.country, locality_key: t.localityKey, division: t.division,
              points: t.points, position: t.position, captain_key: t.captainKey })))}::jsonb)
              AS t(season integer,country text,locality_key text,division integer,points integer,position integer,captain_key text)
            ON CONFLICT DO NOTHING`);
        }
        const current = leagueSeason(country, LOCALITIES, results, season, bySeason.get(season - 1) ?? null);
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
        return {
          club: { localityKey: locality.key, name: clubName(locality), city: locality.city, region: locality.region, country },
          season, members,
          captain: mine.captainKey ? { key: mine.captainKey, name: nameOf(mine.captainKey), you: mine.captainKey === "HUMAN" } : null,
          table: { division: mine.division, rows: current.filter(c => c.division === mine.division).sort((a, b) => a.position - b.position)
            .map(c => ({ localityKey: c.localityKey, name: clubName(clubLocality(c.localityKey)), points: c.points, position: c.position, you: c.localityKey === locality.key })) },
          history,
          legend: pro && history.length > 0,
        };
      });
    },
  };
}
