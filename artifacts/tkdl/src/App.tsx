import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";

const Dashboard    = lazy(() => import("@/pages/dashboard"));
const Leaderboard  = lazy(() => import("@/pages/leaderboard"));
const SubmitMatch  = lazy(() => import("@/pages/submit-match"));
const Players      = lazy(() => import("@/pages/players"));
const PlayerDetail = lazy(() => import("@/pages/player-detail"));
const Seasons      = lazy(() => import("@/pages/seasons"));
const SeasonDetail = lazy(() => import("@/pages/season-detail"));
const Achievements = lazy(() => import("@/pages/achievements"));
const Admin        = lazy(() => import("@/pages/admin"));
const Rules        = lazy(() => import("@/pages/rules"));
const Play         = lazy(() => import("@/pages/play"));
const Practice     = lazy(() => import("@/pages/practice"));
const ShadowBot       = lazy(() => import("@/pages/shadow-bot"));
const ShadowBotDetail = lazy(() => import("@/pages/shadow-bot-detail"));
const Tour         = lazy(() => import("@/pages/tour"));
const TourRun      = lazy(() => import("@/pages/tour-run"));
const Master501    = lazy(() => import("@/pages/master501"));
const HallOfFame   = lazy(() => import("@/pages/hall-of-fame"));
const Broadcast    = lazy(() => import("@/pages/broadcast"));
const Login        = lazy(() => import("@/pages/login"));
const Account      = lazy(() => import("@/pages/account"));
const Community    = lazy(() => import("@/pages/community"));
const HeadToHead   = lazy(() => import("@/pages/head-to-head"));
const NotFound     = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
        style={{ borderTopColor: "#ff005c" }} />
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/broadcast">
        <Suspense fallback={null}>
          <Broadcast />
        </Suspense>
      </Route>
      <Route path="/login">
        <Suspense fallback={null}>
          <Login />
        </Suspense>
      </Route>
      <Route>
        <Layout>
          <Suspense fallback={<PageLoader />}>
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
              <Route path="/play"          component={Play}        />
              <Route path="/practice"      component={Practice}    />
              <Route path="/shadow-bot/:playerId" component={ShadowBotDetail} />
              <Route path="/shadow-bot"    component={ShadowBot}   />
              <Route path="/tour/:runId"   component={TourRun}     />
              <Route path="/tour"          component={Tour}        />
              <Route path="/master501"     component={Master501}   />
              <Route path="/hall-of-fame"  component={HallOfFame}  />
              <Route path="/community"     component={Community}   />
              <Route path="/account"       component={Account}     />
              <Route path="/h2h"           component={HeadToHead}  />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
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
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
