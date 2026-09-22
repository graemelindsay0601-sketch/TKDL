import { lazy, Suspense, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

const Dashboard = lazyWithRetry(() => import("@/pages/dashboard"), "dashboard");
const Leaderboard = lazyWithRetry(() => import("@/pages/leaderboard"), "leaderboard");
const SubmitMatch = lazyWithRetry(() => import("@/pages/submit-match"), "submit-match");
const Players = lazyWithRetry(() => import("@/pages/players"), "players");
const PlayerDetail = lazyWithRetry(() => import("@/pages/player-detail"), "player-detail");
const Seasons = lazyWithRetry(() => import("@/pages/seasons"), "seasons");
const SeasonDetail = lazyWithRetry(() => import("@/pages/season-detail"), "season-detail");
const Achievements = lazyWithRetry(() => import("@/pages/achievements"), "achievements");
const AchievementDetail = lazyWithRetry(() => import("@/pages/achievement-detail"), "achievement-detail");
const Admin = lazyWithRetry(() => import("@/pages/admin"), "admin");
const Rules = lazyWithRetry(() => import("@/pages/rules"), "rules");
const Play = lazyWithRetry(() => import("@/pages/play"), "play");
const CardClash = lazyWithRetry(() => import("@/pages/card-clash"), "card-clash");
const BossBattle = lazyWithRetry(() => import("@/pages/boss-battle"), "boss-battle");
const BoardCurse = lazyWithRetry(() => import("@/pages/board-curse"), "board-curse");
const Practice = lazyWithRetry(() => import("@/pages/practice"), "practice");
const ShadowBot = lazyWithRetry(() => import("@/pages/shadow-bot"), "shadow-bot");
const ShadowBotDetail = lazyWithRetry(() => import("@/pages/shadow-bot-detail"), "shadow-bot-detail");
const ShadowLeague = lazyWithRetry(() => import("@/pages/shadow-league"), "shadow-league");
const Tour = lazyWithRetry(() => import("@/pages/tour"), "tour");
const TourRun = lazyWithRetry(() => import("@/pages/tour-run"), "tour-run");
const Master501 = lazyWithRetry(() => import("@/pages/master501"), "master501");
const HallOfFame = lazyWithRetry(() => import("@/pages/hall-of-fame"), "hall-of-fame");
const Broadcast = lazyWithRetry(() => import("@/pages/broadcast"), "broadcast");
const TkdlLive = lazyWithRetry(() => import("@/pages/tkdl-live"), "tkdl-live");
const TkdlLivePreview = import.meta.env.DEV ? lazy(() => import("@/pages/tkdl-live-preview")) : null;
const Login = lazyWithRetry(() => import("@/pages/login"), "login");
const Account = lazyWithRetry(() => import("@/pages/account"), "account");
const Community = lazyWithRetry(() => import("@/pages/community"), "community");
const HeadToHead = lazyWithRetry(() => import("@/pages/head-to-head"), "head-to-head");
const NotFound = lazyWithRetry(() => import("@/pages/not-found"), "not-found");

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
      {TkdlLivePreview && (
        <Route path="/__tkdl-live-preview">
          <Suspense fallback={null}><TkdlLivePreview /></Suspense>
        </Route>
      )}
      <Route path="/broadcast">
        <Suspense fallback={null}><Broadcast /></Suspense>
      </Route>
      <Route path="/tkdl-live">
        <Suspense fallback={null}><TkdlLive /></Suspense>
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
            <Route path="/achievements/:system/:key">
              <RoutePage><AchievementDetail /></RoutePage>
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
            <Route path="/card-clash">
              <RoutePage><CardClash /></RoutePage>
            </Route>
            <Route path="/boss-battle">
              <RoutePage><BossBattle /></RoutePage>
            </Route>
            <Route path="/board-curse">
              <RoutePage><BoardCurse /></RoutePage>
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
