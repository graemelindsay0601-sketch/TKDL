// TKDL LIVE — the broadcast lower third: a name-strap caption for whoever's
// currently talking. Replaced DialogueCard.tsx's chat-bubble stack (rejected
// as "still looks like a WhatsApp thread") with a solid-colour name plate
// directly above a single caption line, hard rectangular edges, no bubble
// tail — mounted once by BroadcastPlayer.tsx, in the same place on the
// studio desk's front (StudioSet.tsx's PresenterDesk) for every scene.
//
// No photo insert here — a first version bled a small photo into the left
// edge, but presenters/StudioSet.tsx's PresenterDesk now keeps both hosts
// permanently visible standing at the desk above this caption, so a second
// photo here would just be a duplicate. Real broadcast lower thirds work
// the same way: no name-strap photo when the person is already on camera.
//
// ── `previousTurn`: the exchange, not just the latest line ───────────────
// This used to show ONLY the current turn — each new line simply replaced
// the last, so two hosts trading a fact/reaction/handoff (commentary-math
// .ts's own QUICK_HIT blueprint) never actually looked like an exchange on
// screen, just one caption after another. Real user feedback, verbatim: "i
// want some conversation between the host not just raw data... like a talk
// show." `previousTurn` (BroadcastPlayer.tsx passes the turn immediately
// before the active one, same segment only) now renders demoted — smaller,
// dimmed, no name plate — directly above the live line, so viewers can see
// what was just said AND what's being said now at once, the way a real
// two-shot conversation reads. Deliberately not a third state, not a full
// history: showing more than one prior line would start to look like the
// rejected chat-bubble stack again.
import { PRESENTERS, type PresenterId } from "./presenters/presenter-config";
import type { DialogueTurn } from "./types";

export type LowerThirdProps = {
  turn: DialogueTurn;
  /** The turn immediately before `turn` in the same segment, if any — rendered demoted above the live line so the pair reads as an exchange. */
  previousTurn?: DialogueTurn | null;
};

export function LowerThird({ turn, previousTurn }: LowerThirdProps) {
  const speaker = turn.speaker as PresenterId;
  const presenter = PRESENTERS[speaker];

  return (
    // `minWidth: 0` on every level below — a real user screenshot on a
    // narrow phone showed this whole caption box, and the active line's own
    // text with it, overflowing past both screen edges rather than wrapping.
    // Cause: `previousTurn`'s line uses `truncate` (nowrap + ellipsis), and
    // a `white-space: nowrap` element's contribution to its flex ancestors'
    // shrink calculation is its FULL un-wrapped width, not the visually
    // clipped one — flex items default to `min-width: auto`, so without an
    // explicit override that full width becomes a hard floor the whole
    // lower-third (and everything sharing its flex row, incl. the box
    // BroadcastPlayer.tsx mounts this in) refuses to shrink below, however
    // narrow the actual viewport is. `min-width: 0` at each nesting level
    // removes that floor so `width: 100%`/`truncate` can do their real job.
    <div className="flex flex-col items-stretch" style={{ maxWidth: 640, width: "100%", minWidth: 0 }}>
      {previousTurn && (
        <div
          className="self-start flex items-baseline gap-1.5 px-3 py-1 mb-1"
          style={{
            opacity: 0.5,
            transform: "scale(0.94)",
            transformOrigin: "left bottom",
            background: "rgba(6,4,14,0.72)",
            borderLeft: `2px solid ${PRESENTERS[previousTurn.speaker as PresenterId].accent}80`,
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          <span className="font-bold uppercase shrink-0" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.05em", color: PRESENTERS[previousTurn.speaker as PresenterId].accent }}>
            {PRESENTERS[previousTurn.speaker as PresenterId].name}
          </span>
          <span className="truncate" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.78rem", lineHeight: 1.3, color: "rgba(255,255,255,0.6)", minWidth: 0 }}>
            {previousTurn.text}
          </span>
        </div>
      )}

      <div className="self-start flex items-baseline gap-2 px-3 py-1" style={{ background: presenter.accent }}>
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", letterSpacing: "0.06em", color: "#fff" }}>
          {presenter.name}
        </span>
        <span className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.82)" }}>
          {presenter.role}
        </span>
      </div>
      <div
        className="px-3 py-2.5"
        style={{
          background: "rgba(6,4,14,0.94)",
          borderLeft: `1px solid ${presenter.accent}40`,
          borderRight: `1px solid ${presenter.accent}40`,
          borderBottom: `1px solid ${presenter.accent}40`,
        }}
      >
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.98rem", lineHeight: 1.35, color: "rgba(255,255,255,0.95)" }}>
          {turn.text}
        </span>
      </div>
    </div>
  );
}
