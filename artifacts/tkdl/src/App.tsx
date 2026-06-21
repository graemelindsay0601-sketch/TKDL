import { lazy, Suspense, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";

const Dashboard       = lazy(() => import("@/pages/dashboard"));
const Leaderboard     = lazy(() => import("@/pages/leaderboard"));
const SubmitMatch     = lazy(() => import("@/pages/submit-match"));
const Players         = lazy(() => import("@/pages/players"));
const PlayerDetail    = lazy(() => import("@/pages/player-detail"));
const Seasons         = lazy(() => import("@/pages/seasons"));
const SeasonDetail    = lazy(() => import("@/pages/season-detail"));
const Achievements    = lazy(() => import("@/pages/achievements"));
const Admin           = lazy(() => import("@/pages/admin"));
const Rules           = lazy(() => import("@/pages/rules"));
const Play            = lazy(() => import("@/pages/play"));
const Practice        = lazy(() => import("@/pages/practice"));
const ShadowBot       = lazy(() => import("@/pages/shadow-bot"));
const ShadowBotDetail = lazy(() => import("@/pages/shadow-bot-detail"));
const ShadowLeague    = lazy(() => import("@/pages/shadow-league"));
const Coach           = lazy(() => import("@/pages/coach"));
const Tour            = lazy(() => import("@/pages/tour"));
const TourRun         = lazy(() => import("@/pages/tour-run"));
const Master501       = lazy(() => import("@/pages/master501"));
const HallOfFame      = lazy(() => import("@/pages/hall-of-fame"));
const Broadcast       = lazy(() => import("@/pages/broadcast"));
const Login           = lazy(() => import("@/pages/login"));
const Account         = lazy(() => import("@/pages/account"));
const Community       = lazy(() => import("@/pages/community"));
const HeadToHead      = lazy(() => import("@/pages/head-to-head"));
const NotFound        = lazy(() => import("@/pages/not-found"));

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

function RoutePage({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/broadcast">
        <Suspense fallback={null}><Broadcast /></Suspense>
      </Route>
      <Route path="/login">
        <RoutePage><Login /></RoutePage>
      </Route>
      <Route>
        <Layout>
          <Switch>
            <Route path="/">
              <RoutePage><Dashboard /></RoutePage>
            </Route>
            <Route path="/leaderboard">
              <RoutePage><Leaderboard /></RoutePage>
            </Route>
            <Route path="/submit">
              <RoutePage><SubmitMatch /></RoutePage>
            </Route>
            <Route path="/players">
              <RoutePage><Players /></RoutePage>
            </Route>
            <Route path="/players/:id">
              <RoutePage><PlayerDetail /></RoutePage>
            </Route>
            <Route path="/seasons">
              <RoutePage><Seasons /></RoutePage>
            </Route>
            <Route path="/seasons/:id">
              <RoutePage><SeasonDetail /></RoutePage>
            </Route>
            <Route path="/achievements">
              <RoutePage><Achievements /></RoutePage>
            </Route>
            <Route path="/rules">
              <RoutePage><Rules /></RoutePage>
            </Route>
            <Route path="/admin">
              <RoutePage><Admin /></RoutePage>
            </Route>
            <Route path="/play">
              <RoutePage><Play /></RoutePage>
            </Route>
            <Route path="/practice">
              <RoutePage><Practice /></RoutePage>
            </Route>
            <Route path="/shadow-bot/:playerId">
              <RoutePage><ShadowBotDetail /></RoutePage>
            </Route>
            <Route path="/shadow-bot">
              <RoutePage><ShadowBot /></RoutePage>
            </Route>
            <Route path="/tour/:runId">
              <RoutePage><TourRun /></RoutePage>
            </Route>
            <Route path="/tour">
              <RoutePage><Tour /></RoutePage>
            </Route>
            <Route path="/master501">
              <RoutePage><Master501 /></RoutePage>
            </Route>
            <Route path="/hall-of-fame">
              <RoutePage><HallOfFame /></RoutePage>
            </Route>
            <Route path="/community">
              <RoutePage><Community /></RoutePage>
            </Route>
            <Route path="/account">
              <RoutePage><Account /></RoutePage>
            </Route>
            <Route path="/h2h">
              <RoutePage><HeadToHead /></RoutePage>
            </Route>
            <Route path="/coach">
              <RoutePage><Coach /></RoutePage>
            </Route>
            <Route path="/shadow-league">
              <RoutePage><ShadowLeague /></RoutePage>
            </Route>
            <Route>
              <RoutePage><NotFound /></RoutePage>
            </Route>
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
