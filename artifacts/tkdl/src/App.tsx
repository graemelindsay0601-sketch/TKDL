import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

import Dashboard    from "@/pages/dashboard";
import Leaderboard  from "@/pages/leaderboard";
import SubmitMatch  from "@/pages/submit-match";
import Players      from "@/pages/players";
import PlayerDetail from "@/pages/player-detail";
import Seasons      from "@/pages/seasons";
import SeasonDetail from "@/pages/season-detail";
import Achievements from "@/pages/achievements";
import Admin from "@/pages/admin";
import AutoScorerTestPage from "@/pages/auto-scorer-test";
import Rules        from "@/pages/rules";
import Play         from "@/pages/play";
import Practice     from "@/pages/practice";
import ShadowBot       from "@/pages/shadow-bot";
import ShadowBotDetail from "@/pages/shadow-bot-detail";
import Tour         from "@/pages/tour";
import TourRun      from "@/pages/tour-run";
import Master501    from "@/pages/master501";
import HallOfFame   from "@/pages/hall-of-fame";
import Broadcast      from "@/pages/broadcast";
import Login          from "@/pages/login";
import Account        from "@/pages/account";
import ScorerJoin     from "@/pages/scorer-join";
import ScorerDisplay  from "@/pages/scorer-display";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function AppRoutes() {
  return (
    <Switch>
      <Route path="/broadcast"           component={Broadcast}      />
      <Route path="/scorer/join"          component={ScorerJoin}    />
      <Route path="/scorer/display/:code" component={ScorerDisplay} />
      <Route path="/login"               component={Login}          />
      <Route>
        <Layout>
          <Switch>
            <Route path="/"              component={Dashboard}   />
            <Route path="/leaderboard"   component={Leaderboard} />
            <Route path="/submit"        component={SubmitMatch} />
            <Route path="/players"       component={Players}     />
            <Route path="/players/:id"   component={PlayerDetail}/>
            <Route path="/seasons"       component={Seasons}     />
            <Route path="/seasons/:id"   component={SeasonDetail}/>
            <Route path="/achievements"  component={Achievements}/>
            <Route path="/rules"         component={Rules}       />
            <Route path="/admin"         component={Admin}       />
        <Route path="/admin/auto-scorer-test" component={AutoScorerTestPage} />
            <Route path="/play"          component={Play}        />
            <Route path="/practice"      component={Practice}    />
            <Route path="/shadow-bot/:playerId" component={ShadowBotDetail} />
            <Route path="/shadow-bot"    component={ShadowBot}   />
            <Route path="/tour/:runId"   component={TourRun}     />
            <Route path="/tour"          component={Tour}        />
            <Route path="/master501"     component={Master501}   />
            <Route path="/hall-of-fame"  component={HallOfFame}  />
            <Route path="/account"       component={Account}     />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
