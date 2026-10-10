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
import {CareerMapPage} from "./pages/map";
import {WorldHub,WorldPlayerDirectory} from "./pages/world-hub";
import {MyCareerPage} from "./pages/my-career";
import {SponsorHQPage} from "./pages/sponsor-hq";

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
          <Route path="/career/:saveId/my-career/performance"><MyCareerPage ctx={ctx} section="performance"/></Route>
          <Route path="/career/:saveId/my-career/achievements"><MyCareerPage ctx={ctx} section="achievements"/></Route>
          <Route path="/career/:saveId/my-career/life"><MyCareerPage ctx={ctx} section="life"/></Route>
          <Route path="/career/:saveId/my-career/history"><MyCareerPage ctx={ctx} section="history"/></Route>
          <Route path="/career/:saveId/my-career"><MyCareerPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/calendar"><CalendarPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/sponsors"><SponsorHQPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/tournaments/:eventId/matches/:matchId">{(p:{eventId:string;matchId:string})=><TournamentPage ctx={ctx} eventId={p.eventId} matchId={p.matchId}/>}</Route>
          <Route path="/career/:saveId/tournaments/:eventId">{(p:{eventId:string})=><TournamentPage ctx={ctx} eventId={p.eventId}/>}</Route>
          <Route path="/career/:saveId/matches/:matchId/play">{(p: { matchId: string }) => <LiveMatchPage key={p.matchId} ctx={ctx} matchId={p.matchId} />}</Route>
          <Route path="/career/:saveId/events/:eventId">{(p: { eventId: string }) => <EventPage ctx={ctx} eventId={p.eventId} />}</Route>
          <Route path="/career/:saveId/rankings"><RankingsPage ctx={ctx} /></Route>
          <Route path="/career/:saveId/world/players/:npcId">{(p:{npcId:string})=><WorldPlayerDirectory ctx={ctx} id={p.npcId}/>}</Route>
          <Route path="/career/:saveId/world/players"><WorldPlayerDirectory ctx={ctx}/></Route>
          <Route path="/career/:saveId/world/events/:key">{(p:{key:string})=><WorldHub ctx={ctx} section="events" detail={p.key}/>}</Route>
          <Route path="/career/:saveId/world/events"><WorldHub ctx={ctx} section="events"/></Route>
          <Route path="/career/:saveId/world/venues/:key">{(p:{key:string})=><WorldHub ctx={ctx} section="venues" detail={p.key}/>}</Route>
          <Route path="/career/:saveId/world/venues"><WorldHub ctx={ctx} section="venues"/></Route>
          <Route path="/career/:saveId/world/history"><WorldHub ctx={ctx} section="history"/></Route>
          <Route path="/career/:saveId/world/search"><WorldHub ctx={ctx} section="search"/></Route>
          <Route path="/career/:saveId/world/trophies"><TrophyPage ctx={ctx}/></Route>
          <Route path="/career/:saveId/world"><WorldHub ctx={ctx}/></Route>
          <Route path="/career/:saveId/map"><CareerMapPage ctx={ctx}/></Route>
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
