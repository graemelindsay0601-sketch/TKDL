// TKDL LIVE — the top-level broadcast player (handover doc 15.4's scene
// state machine, wired to real timers/React state on top of scene-timing
// .ts's pure logic). Owns: the persistent wordmark/label chrome, which
// scene is currently mounted, advancing dialogue turns on their own
// hold-time, looping into a fresh Edition once the programme is exhausted,
// and admitting queued live inserts at a safe boundary.
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
  nextPlayableSegmentIndex, filterUnseenOverlays, mergeOverlayQueue, popReadyOverlay,
  advancePlayerState, INITIAL_PLAYER_STATE,
  type PlayerState, type PlayheadPosition,
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

// Used only by the two early-return states below (loading / no Edition yet)
// — the main runtime's own background is StudioSet.tsx's StudioBackdrop.
const SHELL_STYLE = {
  background: "radial-gradient(ellipse at 20% 20%, rgba(255,0,92,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(0,102,255,0.1) 0%, transparent 55%), #06040e",
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
        <div className="sticky top-0 z-10 px-6 py-3 text-center backdrop-blur" style={{ background: "rgba(6,4,14,0.85)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
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
};

function PlayerRuntime({ edition, refetchEdition, overlays, tickerItems, invalidSegmentIds, namesByKey, seenIds, markSeen }: PlayerRuntimeProps) {
  // 14.4/15.4: the top-of-show headline tease (up to 3 segments) plays
  // before the main programme body — one combined playlist so scene-timing
  // .ts's own segment-index logic doesn't need to know about the split.
  const playlist: Segment[] = useMemo(() => [...edition.headlines, ...edition.segments], [edition]);

  const [state, setState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [overlayQueue, setOverlayQueue] = useState<LiveOverlayItem[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<LiveOverlayItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Merge fresh live overlays into the queue (11.4/11.5), dropping anything this browser session has already shown.
  useEffect(() => {
    const fresh = filterUnseenOverlays(overlays, seenIds);
    if (fresh.length === 0) return;
    setOverlayQueue(q => mergeOverlayQueue(q, fresh));
  }, [overlays, seenIds]);

  /** Pops one ready overlay off the queue into `activeOverlay` if the current boundary allows it. Returns whether one was admitted. */
  function tryAdmitOverlay(position: PlayheadPosition): boolean {
    let admitted = false;
    setOverlayQueue(q => {
      const popped = popReadyOverlay(q, position);
      if (!popped) return q;
      admitted = true;
      setActiveOverlay(popped.overlay);
      markSeen(popped.overlay.storyId);
      return popped.remainingQueue;
    });
    return admitted;
  }

  // The main scheduler: one real timer per phase that needs one
  // (PLAY_DIALOGUE_TURN's own reading-pace hold, TRANSITION's brief beat).
  // BOOT/LOAD_EDITION/PLAY_SEGMENT are instant per scene-timing.ts's own
  // state machine and just re-enter this effect on the next render.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (activeOverlay) return; // paused for LIVE_INSERT — resumes via dismissOverlay below

    switch (state.phase) {
      case "BOOT":
      case "LOAD_EDITION":
        setState(s => advancePlayerState(s, { totalTurnsInCurrentSegment: 0, hasMorePlayableSegments: playlist.length > 0 }));
        return;

      case "PLAY_SEGMENT": {
        const playableIndex = nextPlayableSegmentIndex(playlist, invalidSegmentIds, state.segmentIndex);
        if (playableIndex === -1) {
          refetchEdition(); // programme (or everything left in it) is exhausted/invalid — fetch whatever Edition is current now
          setState({ phase: "LOAD_EDITION", segmentIndex: 0, turnIndex: 0 });
          return;
        }
        if (playableIndex !== state.segmentIndex) {
          setState(s => ({ ...s, segmentIndex: playableIndex }));
          return;
        }
        setState(s => advancePlayerState(s, { totalTurnsInCurrentSegment: playlist[playableIndex].dialogue.length, hasMorePlayableSegments: true }));
        return;
      }

      case "PLAY_DIALOGUE_TURN": {
        const segment = playlist[state.segmentIndex];
        if (!segment) { setState({ phase: "LOAD_EDITION", segmentIndex: 0, turnIndex: 0 }); return; }
        const turn = segment.dialogue[state.turnIndex];
        const holdMs = Math.max(1000, (turn?.holdSeconds ?? 4) * 1000);
        timerRef.current = setTimeout(() => {
          if (tryAdmitOverlay({ kind: "turn_boundary" })) { setState(s => ({ ...s, phase: "LIVE_INSERT" })); return; }
          setState(s => advancePlayerState(s, { totalTurnsInCurrentSegment: segment.dialogue.length, hasMorePlayableSegments: true }));
        }, holdMs);
        return;
      }

      case "TRANSITION": {
        timerRef.current = setTimeout(() => {
          if (tryAdmitOverlay({ kind: "segment_boundary" })) { setState(s => ({ ...s, phase: "LIVE_INSERT" })); return; }
          const nextIndex = nextPlayableSegmentIndex(playlist, invalidSegmentIds, state.segmentIndex + 1);
          setState(s => advancePlayerState(s, { totalTurnsInCurrentSegment: 0, hasMorePlayableSegments: nextIndex !== -1 }));
        }, 500);
        return;
      }

      case "LIVE_INSERT":
        return; // handled by dismissOverlay below
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, activeOverlay, playlist, invalidSegmentIds]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function dismissOverlay() {
    setActiveOverlay(null);
    setState(s => advancePlayerState(s, { totalTurnsInCurrentSegment: 0, hasMorePlayableSegments: true }));
  }

  const segment = playlist[state.segmentIndex] ?? null;
  const turnsPlayed = state.turnIndex + 1;
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

  return (
    <div className="fixed inset-0 flex flex-col select-none" style={{ background: "#06040e", fontFamily: "Oswald, sans-serif" }}>
      <StudioBackdrop variant={backdropVariant} />
      <PresenterOverlay
        variant={backdropVariant}
        activeSpeaker={activeTurn ? (activeTurn.speaker as "A" | "B") : null}
        activeState={activeTurnState}
      />
      <ShowTitleBar subtitle={cornerLabel} />

      <ScreenPanel framed={segment ? segment.scene !== "breaking" && segment.scene !== "champion" : true}>
        {segment && SceneComponent ? (
          <SceneComponent key={segment.id} segment={segment} turnsPlayed={turnsPlayed} />
        ) : (
          <div className="flex-1" />
        )}
      </ScreenPanel>

      <LowerThirdDock>
        {activeTurn && (
          <div className="lower-third-in" key={`${segment?.id}-${visible.length}`}>
            <LowerThird turn={activeTurn} previousTurn={previousTurn} />
          </div>
        )}
      </LowerThirdDock>

      <div className="relative shrink-0" style={{ zIndex: 2 }}>
        <LiveTicker items={tickerItems} namesByKey={namesByKey} />
      </div>

      {activeOverlay && (
        <LiveInsertOverlay overlay={activeOverlay} namesBySubjectKey={namesBySubjectKey} onDismiss={dismissOverlay} />
      )}
    </div>
  );
}
