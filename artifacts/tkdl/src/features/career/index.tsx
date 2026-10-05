import { Route, Switch, useParams } from "wouter";
import "./career.css";
import { CareerShell } from "./shell";
import { SavesPage } from "./pages/saves";
import { HomePage } from "./pages/home";
import { CalendarPage } from "./pages/calendar";
import { EventPage } from "./pages/event";
import { RankingsPage } from "./pages/rankings";
import { QSchoolPage } from "./pages/q-school";
import { PalacePage } from "./pages/palace";
import { JourneyPage } from "./pages/journey";
import { FinancesPage } from "./pages/finances";
import { HistoryPage } from "./pages/history";
import { LegacyPage, NpcLegacyPage } from "./pages/legacy";
import { RelationshipsPage } from "./pages/relationships";
import { GoalsPage } from "./pages/goals";
import { RecognitionPage } from "./pages/recognition";
import { LifePage, StoriesPage, NpcLifePage } from "./pages/life";
import { LiveMatchPage } from "./pages/live-match";
import {WorldPage,WorldMapPage,WorldPlayersPage,TrophyPage,PresentationPage} from "./pages/world";
import {TournamentPage} from "./pages/tournament";

/**
 * TKDL Career (A6). Stable URLs under /career (not /tour/career: /tour/:runId is the
 * Classic Tour run route and the layout treats /tour/* as a match-in-progress route).
 *   /career                                  saves (3 slots + archive)
 *   /career/:saveId                          Home
 *   /career/:saveId/calendar                 Calendar
 *   /career/:saveId/events/:eventId          Event / Tournament
 *   /career/:saveId/matches/:matchId/play    Live match (A6.5: GameScorer, server-verified)
 *   /career/:saveId/rankings                 Rankings
 *   /career/:saveId/q-school                 Q-School
 *   /career/:saveId/world-championship       The Palace
 *   /career/:saveId/journey                  Career Journey
 *   /career/:saveId/finances                 Finances & Sponsorship
 *   /career/:saveId/history                  My Career / History & Trophy Room
 */
export default function CareerApp() {
  return (
    <Switch>
      <Route path="/career"><SavesPage /></Route>
      <Route path="/career/:saveId/*?"><CareerSaveRoutes /></Route>
    </Switch>
  );
}

function CareerSaveRoutes() {
  const { saveId } = useParams<{ saveId: string }>();
  return (
    <CareerShell saveId={saveId}>
      {ctx => (
        <Switch>
          <Route path="/career/:saveId/calendar"><CalendarPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/tournaments/:eventId/matches/:matchId">{(p:{eventId:string;matchId:string})=><TournamentPage ctx={ctx} eventId={p.eventId} matchId={p.matchId}/>}</Route>
          <Route path="/career/:saveId/tournaments/:eventId">{(p:{eventId:string})=><TournamentPage ctx={ctx} eventId={p.eventId}/>}</Route>
          <Route path="/career/:saveId/matches/:matchId/play">{(p: { matchId: string }) => <LiveMatchPage key={p.matchId} ctx={ctx} matchId={p.matchId} />}</Route>
          <Route path="/career/:saveId/events/:eventId">{(p: { eventId: string }) => <EventPage ctx={ctx} eventId={p.eventId} />}</Route>
          <Route path="/career/:saveId/rankings"><RankingsPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/world/players"><WorldPlayersPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/world/trophies"><TrophyPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/world"><WorldPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/map"><WorldMapPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/guide"><WorldPage ctx={ctx} guide/></Route>
          <Route path="/career/:saveId/presentation"><PresentationPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/q-school"><QSchoolPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/world-championship"><PalacePage ctx={ctx} /></Route>
          <Route path="/career/:saveId/journey"><JourneyPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/finances"><FinancesPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/history/npcs/:npcId">{(p:{npcId:string})=><NpcLegacyPage ctx={ctx} npcId={p.npcId}/>}</Route>
          <Route path="/career/:saveId/history/facts"><HistoryPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/history"><LegacyPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/relationships"><RelationshipsPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/goals"><GoalsPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/life/npcs/:npcId">{(p:{npcId:string})=><NpcLifePage ctx={ctx} npcId={p.npcId}/>}</Route>
          <Route path="/career/:saveId/life"><LifePage ctx={ctx}/></Route>
          <Route path="/career/:saveId/stories"><StoriesPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/recognition/npcs/:npcId">{(p:{npcId:string})=><RecognitionPage ctx={ctx} npcId={p.npcId}/>}</Route>
          <Route path="/career/:saveId/recognition"><RecognitionPage ctx={ctx} /></Route>
          <Route><HomePage ctx={ctx} /></Route>
        </Switch>
      )}
    </CareerShell>
  );
}
