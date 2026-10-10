import { sql, type SQL } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { careerDate, ageOn } from "../identity/age.ts";
import { chronological, performanceStatistics, sportingStatistics } from "./model.ts";
import type { CareerFacts, DartEvidence, EventFact, Fact, MatchEvidence } from "./types.ts";

type Row = Record<string, unknown>;
const text = (r: Row, key: string) => String(r[key] ?? "");
const num = (r: Row, key: string) => Number(r[key]);
const object = (v: unknown): Row => v && typeof v === 'object' ? v as Row : {};
const label = (v: string) => v.toLowerCase().replaceAll('_', ' ');

/** Read-only composition. The existing root lock keeps A3/A4/A5 writers from
 * changing a save halfway through this snapshot; retired saves are readable. */
export function createCareerFactsService(database: CareerDatabase) {
  return { async read(actor: CareerActor, saveId: string): Promise<CareerFacts> {
    return database.transaction(async tx => {
      const root = await lockRoot(tx, actor, saveId, false);
      const rootRow = root as unknown as Row;
      const start = text(rootRow,'identity_start'), dob = text(rootRow,'identity_dob');
      const query = async (q: SQL) => (await tx.execute(q)).rows;
      const fact = (id: string, source: string, title: string, season: number, day: number | null, eventId?: string, storedAge?: unknown): Fact => {
        const date = start && day !== null ? careerDate(start,season,day) : null;
        return { id, source, label:title, season, day, week:day === null ? null : Math.ceil(day/7), date,
          age:typeof storedAge === 'number' ? storedAge : date && dob ? ageOn(dob,date) : null, ...(eventId ? {eventId} : {}) };
      };
      const weekDay = (r: Row, field='week') => (num(r,field)-1)*7+1;
      const resultRows = await query(sql`SELECT r.*, i.name, i.circuit, i.classification, i.presentation_tier, i.country, i.start_day, i.end_day,
          CASE WHEN r.participant_key='HUMAN' THEN COALESCE(p.display_name,s.career_name,'You') ELSE concat(n.first_name,' ',n.surname) END AS participant_name
        FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
        JOIN career_saves s ON s.id=r.career_save_id LEFT JOIN career_profiles p ON p.career_save_id=r.career_save_id
        LEFT JOIN career_world_players n ON n.career_save_id=r.career_save_id AND n.id=r.npc_id
        WHERE r.career_save_id=${saveId} AND i.status='COMPLETED' AND (r.participant_key='HUMAN' OR r.is_champion)`);
      const allResults: EventFact[] = resultRows.map(r => ({
        ...fact(`result:${text(r,'event_id')}:${text(r,'participant_key')}`, 'A3 event result', `${text(r,'name')}: ${label(text(r,'stage_reached'))}`, num(r,'season'),num(r,'end_day'),text(r,'event_id'),object(r.metadata).humanAge),
        // A6.5 result humanAge is explicitly age at event START, not completion.
        age:r.participant_key==='HUMAN' ? (typeof object(r.metadata).humanAge === 'number' ? Number(object(r.metadata).humanAge) : start && dob ? ageOn(dob,careerDate(start,num(r,'season'),num(r,'start_day'))) : null) : null,
        eventId:text(r,'event_id'), name:text(r,'name'), definitionKey:text(r,'definition_key'), circuit:text(r,'circuit'), classification:text(r,'classification'),
        presentationTier:text(r,'presentation_tier'), country:text(r,'country'), participantKey:text(r,'participant_key'), participantName:text(r,'participant_name'),
        position:num(r,'finishing_position'), stageReached:text(r,'stage_reached'), champion:r.is_champion===true, wins:num(r,'wins'), losses:num(r,'losses')
      })).sort(chronological);
      const results = allResults.filter(r=>r.participantKey==='HUMAN');
      const matchRows = await query(sql`SELECT m.*, i.season, i.name FROM career_tournament_matches m
        JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
        WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND (m.a_key='HUMAN' OR m.b_key='HUMAN')
        ORDER BY i.season,m.scheduled_day,m.event_id,m.round,m.slot,m.id`);
      const matches: MatchEvidence[] = matchRows.map(r=>({id:text(r,'id'),eventId:text(r,'event_id'),name:text(r,'name'),season:num(r,'season'),day:num(r,'scheduled_day'),round:num(r,'round'),slot:num(r,'slot'),won:r.winner_key==='HUMAN'}));
      const matchFacts = matches.map(m=>fact(`match:${m.id}`,'A3 completed match',`${m.won ? 'Won' : 'Lost'} — ${m.name}`,m.season,m.day,m.eventId));
      const sessions = await query(sql`SELECT s.match_id,s.event_id,s.format,s.first_thrower,s.darts FROM career_match_sessions s
        JOIN career_tournament_matches m ON m.career_save_id=s.career_save_id AND m.id=s.match_id
        WHERE s.career_save_id=${saveId} AND s.status='COMPLETED' AND m.status='COMPLETED' AND (m.a_key='HUMAN' OR m.b_key='HUMAN')`);
      const performance = performanceStatistics(sessions.map(r=>({matchId:text(r,'match_id'),eventId:text(r,'event_id'),format:r.format,firstThrower:r.first_thrower,darts:r.darts} as DartEvidence)),matches.length);
      const ranks = await query(sql`SELECT r.*, s.week, s.sequence,
          CASE WHEN r.participant_key='HUMAN' THEN COALESCE(p.display_name,'You') ELSE concat(n.first_name,' ',n.surname) END AS participant_name
        FROM career_ranking_snapshot_rows r JOIN career_ranking_snapshots s ON s.career_save_id=r.career_save_id AND s.id=r.snapshot_id
        LEFT JOIN career_world_players n ON n.career_save_id=r.career_save_id AND n.id=r.npc_id
        LEFT JOIN career_profiles p ON p.career_save_id=r.career_save_id
        WHERE r.career_save_id=${saveId} AND r.list_key='pro-world' AND (r.participant_key='HUMAN' OR r.position=1)
        ORDER BY r.publication_index, r.position`);
      const rankFact = (r: Row) => ({...fact(`ranking:${text(r,'snapshot_id')}:${text(r,'participant_key')}`,'A5 ranking snapshot',`World ranking #${num(r,'position')}`,num(r,'season'),weekDay(r)),position:num(r,'position')});
      const humanRanks = ranks.filter(r=>r.participant_key==='HUMAN');
      const bestRank = [...humanRanks].sort((a,b)=>num(a,'position')-num(b,'position') || num(a,'publication_index')-num(b,'publication_index'))[0];
      const milestones = await query(sql`SELECT * FROM career_sporting_milestones WHERE career_save_id=${saveId} AND participant_key='HUMAN'`);
      const cards = await query(sql`SELECT * FROM career_tour_cards WHERE career_save_id=${saveId} AND participant_key='HUMAN' ORDER BY awarded_season,awarded_week,id`);
      const cardFacts = cards.map(r=>fact(`card:${text(r,'id')}`,'A5 Tour Card',`Tour Card awarded — ${label(text(r,'source'))}`,num(r,'awarded_season'),weekDay(r,'awarded_week')));
      // Renewals/retentions are not regains. Only an evidenced gap after a loss/expiry is.
      const regainedTourCards = cards.flatMap((r,i) => {
        const previous = cards[i-1];
        return previous && r.source !== 'RANKING_RETENTION' && ['LOST','EXPIRED','SURRENDERED'].includes(text(previous,'status')) && previous.ended_season != null && previous.ended_week != null &&
          (num(previous,'ended_season')*52+num(previous,'ended_week')) < (num(r,'awarded_season')*52+num(r,'awarded_week')) ? [cardFacts[i]] : [];
      });
      const sponsors = await query(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id=${saveId}`);
      const sponsorEvents = await query(sql`SELECT e.id, e.event_type, e.season, e.week, e.details,
          COALESCE(j.source->>'displayName', j.source->'sponsor'->>'displayName',
            j.source->'formalOffer'->'sponsor'->>'displayName', j.sponsor_key) AS sponsor_name,
          COALESCE(e.details->'source'->>'eventName', e.details->'source'->'event'->>'eventName',
            j.source->'event'->>'eventName', j.source->'formalOffer'->>'eventName') AS source_event_name,
          COALESCE(e.details->'source'->>'eventId', e.details->'source'->'event'->>'eventId',
            j.source->'event'->>'eventId', j.source->'formalOffer'->>'eventId') AS source_event_id,
          j.signed_contract_id
        FROM career_sponsor_journey_events e JOIN career_sponsor_journeys j
          ON j.career_save_id=e.career_save_id AND j.id=e.journey_id
        WHERE e.career_save_id=${saveId} AND e.season IS NOT NULL AND e.week IS NOT NULL
          AND e.event_type IN ('INTEREST','OFFER_RECEIVED','SPONSOR_ACCEPTED_REQUEST','SPONSOR_REJECTED',
            'SPONSOR_WITHDREW','PLAYER_DECLINED','PLAYER_WALKED_AWAY','SIGNED','OFFER_EXPIRED','ACTIVITY_UPDATE')
        ORDER BY e.season,e.week,e.ordinal,e.id LIMIT 500`);
      const signedJourneyContractIds = new Set(sponsorEvents.filter(r => r.event_type === "SIGNED")
        .map(r => String(r.signed_contract_id ?? "")).filter(Boolean));
      const sponsorJourneyFacts = sponsorEvents.map(r => {
        const details = object(r.details);
        const sponsorName = text(r, 'sponsor_name');
        const summary = typeof details.summary === "string" ? details.summary
          : typeof details.message === "string" ? details.message : "";
        const eventName = text(r, "source_event_name");
        const context = eventName ? ` after ${eventName}` : "";
        const eventType = text(r, "event_type");
        const labelText = summary ? `${sponsorName} — ${summary}${context}` : `${sponsorName} — ${label(eventType)}${context}`;
        return fact(`sponsor-event:${eventType}:${text(r,'id')}`, `A4 sponsor journey event: ${eventType}`,
          labelText, num(r,'season'), (num(r,'week')-1)*7+1,
          text(r,'source_event_id') || undefined);
      });
      const entitlements = await query(sql`SELECT q.*, i.end_day AS source_day, i.season AS source_season FROM career_qualification_entitlements q
        LEFT JOIN career_event_instances i ON i.career_save_id=q.career_save_id AND i.id=q.source_event_id WHERE q.career_save_id=${saveId} AND q.recipient_key='HUMAN'`);
      const timeline: Fact[] = [fact('career-start','A1 profile','Career started',1,1), ...matchFacts, ...results,
        ...milestones.map(r=>fact(`milestone:${text(r,'id')}`,'A5 sporting milestone',label(text(r,'kind')),num(r,'season'),weekDay(r),undefined,object(r.detail).humanAge)),
        ...cardFacts,
        ...cards.filter(r=>r.ended_season!==null).map(r=>fact(`card-end:${text(r,'id')}`,'A5 Tour Card',`Tour Card ${label(text(r,'status'))}`,num(r,'ended_season'),weekDay(r,'ended_week'))),
        ...sponsors.filter(r=>!signedJourneyContractIds.has(text(r,'id')))
          .map(r=>fact(`sponsor:${text(r,'id')}`,'A4 sponsor contract',`Sponsor signed: ${text(r,'sponsor_key')} (${label(text(r,'tier'))})`,num(r,'start_season'),weekDay(r,'start_week'))),
        ...sponsorJourneyFacts,
        ...entitlements.map(r=>fact(`qualification:${text(r,'id')}`,'A3 qualification',`Qualified: ${text(r,'target_key')} — ${label(text(r,'entitlement_type'))}`,num(r,'awarded_season'),r.source_day != null && r.source_season===r.awarded_season ? num(r,'source_day') : null,text(r,'source_event_id') || undefined))
      ].sort(chronological);
      // Existing A5 milestones cover Q-School/ranking progress; snapshots expose
      // the precise best ranking, without recalculating ranking money or order.
      const titles = results.filter(r=>r.champion);
      const tiers = ['WORLD','MAJOR','TELEVISED','FEATURED','STANDARD','LOCAL'];
      const topTier = tiers.find(t=>titles.some(r=>r.presentationTier===t));
      return { careerSaveId:saveId, statistics:sportingStatistics(matches,results,Number(root.current_season)), performance,
        records:{firstMatch:matchFacts[0]??null,firstWin:matchFacts.find((_,i)=>matches[i].won)??null,
          firstFinal:results.find(r=>r.champion || r.stageReached==='FINAL')??null,firstTitle:titles[0]??null,latestTitle:titles.at(-1)??null,
          bestWorldRanking:bestRank ? rankFact(bestRank) : null,highestTierTitles:titles.filter(r=>r.presentationTier===topTier),firstTourCard:cardFacts[0]??null,regainedTourCards},
        results, timeline, world:{champions:allResults.filter(r=>r.champion),rankingLeaders:ranks.filter(r=>r.position===1).map(r=>({...rankFact(r),age:null,participantKey:text(r,'participant_key'),participantName:text(r,'participant_name')}))} };
    });
  } };
}
