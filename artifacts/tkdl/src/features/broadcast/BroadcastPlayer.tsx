// TKDL LIVE — the top-level broadcast player. Owns: the persistent
// wordmark/label chrome, which scene is currently mounted, and admitting
// queued live inserts at a safe boundary.
//
// ── One shared clock, not one timer per viewer ───────────────────────────
// Real user feedback, in order: (1) "the show restarts every time you
// click away... jarring" — a phone (especially an installed/home-screen
// web app, which this one is — index.html's own apple-mobile-web-app-
// capable meta tag) routinely unloads a backgrounded tab's memory outright
// and reloads the page fresh; (2) directly after, the actual ask: "if I
// started watching the show right now and someone else started it in 5
// mins, we'd both be at the same part, same as how a live TV show actually
// works." A per-client chained-setTimeout state machine (what used to live
// here) can only ever half-solve either problem — a resume-point hack can
// paper over a reload, but two independently-paced tabs are still never
// actually watching the same instant. Both are properly solved at once by
// not tracking "which segment/turn is playing" as this component's own
// state at all: scene-timing.ts's computeTimedPosition() derives it fresh,
// every tick, purely from this Edition's own `generatedAt` timestamp
// (shared by every viewer of it) and `Date.now()`. A reload just
// recomputes the same formula and lands back on the live position — better
// than resuming where THIS viewer left off, it resumes where the
// PROGRAMME actually is, the same as turning a real TV back on. This does
// assume viewing devices' clocks are roughly correct, the same assumption
// this file's own live-insert auto-dismiss timers already make.
//
// ── Studio backdrop ───────────────────────────────────────────────────────
// No literal illustrated set: the user's own reference clip plays entirely
// over a plain dark ground with graphics on top, and this reuses the exact
// dark radial-glow backdrop tkdl-live.tsx's own placeholder screen already
// established (SHELL_STYLE below) rather than commissioning separate studio
// artwork — one consistent "TKDL LIVE" ground for every screen this feature
// shows, not a new background per state.
//
// ── No previous Edition yet (17: "No previous Edition exists") ───────────
// Rather than an empty/placeholder screen, this mounts the app's own
// existing kiosk standings board (pages/broadcast.tsx's `Broadcast`) — a
// real, already-built "live standings/results view," exactly what that
// section calls for, not a new fallback screen invented for this one case.
import { useEffect, useMemo, useRef, useState } from "react";
import Broadcast from "../../pages/broadcast";
import { useBroadcast, useSeenOverlays } from "./useBroadcast";
import {
  filterUnseenOverlays, mergeOverlayQueue, popReadyOverlay,
  totalPlayableDurationMs, computeTimedPosition, buildPlaylist,
  type PlayheadPosition,
} from "./scene-timing";
import { SCENE_COMPONENTS } from "./scenes";
import { visibleTurns } from "./scenes/scene-support";
import { activeStateForScene } from "./presenters/presenter-state";
import { StudioBackdrop, ShowTitleBar, ScreenPanel, PresenterOverlay, LowerThirdDock } from "./presenters/StudioSet";
import { LiveTicker } from "./LiveTicker";
import { LiveInsertOverlay } from "./LiveInsertOverlay";
import { LowerThird } from "./LowerThird";
import { LEAGUE_LABEL, SCENE_LABEL } from "./theme";
import type { CurrentEdition, LiveOverlayItem, LiveTickerItem, Segment } from "./types";

// How often the shared clock re-derives the current position. Dialogue
// turns hold for several real seconds each (`holdSeconds`, DialogueTurn's
// own field), so this is far finer-grained than it needs to be to feel
// instant, while staying cheap enough to leave running on a kiosk screen
// for hours.
const CLOCK_TICK_MS = 500;

// Used only by the two early-return states below (loading / no Edition yet)
// — the main runtime's own background is StudioSet.tsx's StudioBackdrop.
const SHELL_STYLE = {
  background: "radial-gradient(ellipse at 20% 0%, rgba(255,0,92,0.15) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(0,102,255,0.15) 0%, transparent 55%), #040208",
  fontFamily: "Oswald, sans-serif",
} as const;

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="font-black uppercase text-white" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.05rem", letterSpacing: "0.02em" }}>
        TKDL<span style={{ color: "#ff005c" }}>LIVE</span>
      </span>
      <span className="live-dot" aria-hidden="true" />
    </div>
  );
}

export function BroadcastPlayer() {
  const { edition, live, invalidSegmentIds, namesByKey } = useBroadcast();
  const { seenIds, markSeen } = useSeenOverlays();

  if (!edition.data && edition.loading) {
    return <div className="fixed inset-0" style={SHELL_STYLE} />;
  }

  if (!edition.data?.edition) {
    // Nothing has cleared the quality gate yet — a real, complete fallback
    // (the standings board), not an empty screen.
    return (
      <div className="fixed inset-0 overflow-y-auto" style={SHELL_STYLE}>
        <div className="sticky top-0 z-10 px-6 text-center backdrop-blur" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)", paddingBottom: "0.75rem", background: "rgba(6,4,14,0.85)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Wordmark />
          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            The first Edition is still being prepared — here's where things stand right now.
          </div>
        </div>
        <Broadcast />
      </div>
    );
  }

  return (
    <PlayerRuntime
      key={edition.data.edition.id}
      edition={edition.data.edition}
      refetchEdition={edition.refetch}
      overlays={live.data?.overlays ?? []}
      tickerItems={live.data?.tickerItems ?? []}
      invalidSegmentIds={invalidSegmentIds}
      namesByKey={namesByKey}
      seenIds={seenIds}
      markSeen={markSeen}
    />
  );
}

type PlayerRuntimeProps = {
  edition: CurrentEdition;
  refetchEdition: () => void;
  overlays: LiveOverlayItem[];
  tickerItems: LiveTickerItem[];
  invalidSegmentIds: ReadonlySet<string>;
  namesByKey: ReadonlyMap<string, string>;
  seenIds: ReadonlySet<number>;
  markSeen: (storyId: number) => void;
  previewActiveOverlay?: LiveOverlayItem | null;
};

type BroadcastPlayerPreviewProps = {
  edition: CurrentEdition;
  tickerItems?: LiveTickerItem[];
  namesByKey?: ReadonlyMap<string, string>;
  activeOverlay?: LiveOverlayItem | null;
};

const EMPTY_IDS = new Set<string>();
const EMPTY_STORY_IDS = new Set<number>();
const EMPTY_NAMES = new Map<string, string>();
const NOOP = () => {};

/**
 * Development review surface for the real player chrome and scene components.
 * It deliberately bypasses data fetching, not product authentication: the
 * route that mounts it only exists in Vite development builds.
 */
export function BroadcastPlayerPreview({ edition, tickerItems = [], namesByKey = EMPTY_NAMES, activeOverlay = null }: BroadcastPlayerPreviewProps) {
  return (
    <PlayerRuntime
      edition={edition}
      refetchEdition={NOOP}
      overlays={[]}
      tickerItems={tickerItems}
      invalidSegmentIds={EMPTY_IDS}
      namesByKey={namesByKey}
      seenIds={EMPTY_STORY_IDS}
      markSeen={NOOP}
      previewActiveOverlay={activeOverlay}
    />
  );
}

function PlayerRuntime({ edition, refetchEdition, overlays, tickerItems, invalidSegmentIds, namesByKey, seenIds, markSeen, previewActiveOverlay }: PlayerRuntimeProps) {
  // buildPlaylist (scene-timing.ts) owns the actual running order — see its
  // own header for why opening/headlines/body get stitched in that specific
  // sequence and why it's a pure, separately-tested function rather than
  // inline logic here.
  const playlist: Segment[] = useMemo(() => buildPlaylist(edition.headlines, edition.segments), [edition]);

  // The shared clock (this file's own header comment above) — `editionStartMs`
  // is this Edition's own `generatedAt`, identical for every viewer of it,
  // so `now - editionStartMs` is the same "how far into the programme" value
  // wherever it's computed, and `now` itself only ever moves forward in real
  // time (CLOCK_TICK_MS below), never advanced or paused by this component.
  const editionStartMs = useMemo(() => new Date(edition.generatedAt).getTime(), [edition.generatedAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const totalMs = useMemo(() => totalPlayableDurationMs(playlist, invalidSegmentIds), [playlist, invalidSegmentIds]);
  const rawElapsedMs = Math.max(0, now - editionStartMs); // clamped for a clock-skewed/future `generatedAt` — never a negative "how far in"
  // Once the prepared programme has played out in full, loop the SAME
  // Edition from the top — still perfectly in sync, since every viewer
  // wraps at the identical instant — while asking once per completed loop
  // for whatever Edition is actually current now (mirrors the old model's
  // own "TRANSITION -> LOAD_EDITION" trigger, just driven by the clock
  // reaching the end of the timeline instead of a client walking off the
  // end of its own local playlist index).
  const loopCount = totalMs > 0 ? Math.floor(rawElapsedMs / totalMs) : 0;
  const elapsedMs = totalMs > 0 ? rawElapsedMs % totalMs : 0;
  const position = useMemo(
    () => (totalMs > 0 ? computeTimedPosition(playlist, invalidSegmentIds, elapsedMs) : null),
    [playlist, invalidSegmentIds, elapsedMs, totalMs],
  );

  const lastLoopRef = useRef(0);
  useEffect(() => {
    if (totalMs === 0) { refetchEdition(); return; } // nothing playable at all (e.g. every segment invalidated) — keep asking
    if (loopCount > lastLoopRef.current) {
      lastLoopRef.current = loopCount;
      refetchEdition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopCount, totalMs]);

  const [overlayQueue, setOverlayQueue] = useState<LiveOverlayItem[]>([]);
  const [queuedActiveOverlay, setQueuedActiveOverlay] = useState<LiveOverlayItem | null>(null);
  // Development captures need the requested overlay immediately and for as
  // long as the page stays open. Production still uses only the boundary-
  // admitted queue below; the explicit preview value never enters that path.
  const activeOverlay = previewActiveOverlay === undefined ? queuedActiveOverlay : previewActiveOverlay;

  // Merge fresh live overlays into the queue (11.4/11.5), dropping anything this browser session has already shown.
  useEffect(() => {
    const fresh = filterUnseenOverlays(overlays, seenIds);
    if (fresh.length === 0) return;
    setOverlayQueue(q => mergeOverlayQueue(q, fresh));
  }, [overlays, seenIds]);

  // Admits a queued overlay the instant the shared clock crosses a safe
  // boundary (11.4) — `segment_boundary` for the whole `transition` beat
  // (wide enough this tick-based check reliably lands inside it),
  // `turn_boundary` the first tick the clock reaches a new turn. Overlays
  // are deliberately NOT part of the shared clock at all: LiveInsertOverlay
  // .tsx is a small banner layered on top (not a full-screen takeover), and
  // the whole point of a shared clock is that it never pauses for any one
  // viewer — the programme underneath keeps advancing exactly on schedule
  // while the banner is up, the same as a real breaking-news crawl never
  // pausing the show playing behind it. `lastBoundaryKeyRef` only fires this
  // once per distinct position, not on every tick that happens to re-render
  // with the same one.
  const lastBoundaryKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!position) return;
    const key = position.kind === "segment" ? `seg:${position.segmentIndex}:${position.turnIndex}` : `trans:${position.segmentIndex}`;
    if (key === lastBoundaryKeyRef.current) return;
    lastBoundaryKeyRef.current = key;
    if (activeOverlay) return; // one at a time — the next queued overlay gets its own boundary once this one is dismissed

    const boundary: PlayheadPosition = position.kind === "transition" ? { kind: "segment_boundary" } : { kind: "turn_boundary" };
    setOverlayQueue(q => {
      const popped = popReadyOverlay(q, boundary);
      if (!popped) return q;
      setQueuedActiveOverlay(popped.overlay);
      markSeen(popped.overlay.storyId);
      return popped.remainingQueue;
    });
  }, [position, activeOverlay, markSeen]);

  function dismissOverlay() {
    if (previewActiveOverlay === undefined) {
      setQueuedActiveOverlay(null); // the shared clock never paused, so this just uncovers wherever the programme already is
    }
  }

  const segment = position ? playlist[position.segmentIndex] ?? null : null;
  // During the trailing transition beat, keep showing that segment's own
  // last turn (nothing new to show yet) — the same as the old TRANSITION
  // phase leaving its segment/turn untouched from PLAY_DIALOGUE_TURN.
  const turnsPlayed = position && segment ? (position.kind === "segment" ? position.turnIndex + 1 : segment.dialogue.length) : 0;
  const SceneComponent = segment ? SCENE_COMPONENTS[segment.scene] : null;
  const cornerLabel = segment ? (segment.leagueType ? LEAGUE_LABEL[segment.leagueType] : SCENE_LABEL[segment.scene]) : "TKDL LIVE";

  // The line actually being read, in the ONE fixed screen position every
  // scene shares (LowerThird.tsx's header explains why this moved out of
  // the scenes and up here) — a real broadcast lower third doesn't change
  // location depending on what's behind it.
  const visible = segment ? visibleTurns(segment, turnsPlayed) : [];
  const activeTurn = visible.length > 0 ? visible[visible.length - 1] : null;
  // The turn immediately before the active one, same segment only — never
  // carried over from the previous segment's own closing line, which would
  // read as two hosts mid-conversation about two completely different
  // stories. LowerThird.tsx's own header explains why this exists.
  const previousTurn = visible.length > 1 ? visible[visible.length - 2] : null;
  const activeTurnState = segment && activeTurn ? activeStateForScene(segment.scene, visible.length - 1) : "neutral";

  const namesBySubjectKey = namesByKey; // 11.5 subjectKeys and this ticker's keys share the same `${leagueType}:${id}` convention (see useEntityNames)

  const backdropVariant = segment?.scene === "breaking" ? "breaking" : segment?.scene === "champion" ? "champion" : "main";

  const isTransition = position?.kind === "transition";
  const sceneAnimationClass = isTransition ? "scene-exit" : "scene-enter";

  return (
    <div className="fixed inset-0 flex flex-col select-none" style={{ background: "#06040e", fontFamily: "Oswald, sans-serif" }}>
      <StudioBackdrop variant={backdropVariant} />
      <PresenterOverlay
        variant={backdropVariant}
        activeSpeaker={activeTurn ? (activeTurn.speaker as "A" | "B") : null}
        activeState={activeTurnState}
      />
      <div data-broadcast-region="title-bar">
        <ShowTitleBar subtitle={`${edition.mode.replace("_", " ")} · ${cornerLabel}`} />
      </div>

      <ScreenPanel framed={segment ? segment.scene !== "breaking" && segment.scene !== "champion" : true}>
        {segment && SceneComponent ? (
          <div className={`w-full h-full flex flex-col min-h-0 flex-1 ${sceneAnimationClass}`}>
            <SceneComponent key={segment.id} segment={segment} turnsPlayed={turnsPlayed} />
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </ScreenPanel>

      <LowerThirdDock>
        {activeTurn && (
          // `minWidth: 0, maxWidth: "100%"` — this is LowerThirdDock's own
          // flex item; without an explicit override a flex item's default
          // `min-width: auto` lets LowerThird.tsx's own nowrap/truncate
          // content force this (and the caption inside it) wider than the
          // screen instead of shrinking to fit (see that file's own header
          // for the full mechanism — a real user screenshot on a narrow
          // phone showed exactly this, text clipped off both edges).
          <div className={isTransition ? "scene-exit" : "lower-third-in"} style={{ minWidth: 0, maxWidth: "100%" }} key={`${segment?.id}-${visible.length}`}>
            <LowerThird turn={activeTurn} previousTurn={previousTurn} />
          </div>
        )}
      </LowerThirdDock>

      <div data-broadcast-region="ticker" className="relative shrink-0" style={{ zIndex: 2 }}>
        <LiveTicker items={tickerItems} namesByKey={namesByKey} />
      </div>

      {activeOverlay && (
        <LiveInsertOverlay overlay={activeOverlay} namesBySubjectKey={namesBySubjectKey} onDismiss={dismissOverlay} />
      )}
    </div>
  );
}
