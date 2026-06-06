import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Admin        from "@/pages/admin";
import Rules        from "@/pages/rules";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function AppRoutes() {
  return (
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
