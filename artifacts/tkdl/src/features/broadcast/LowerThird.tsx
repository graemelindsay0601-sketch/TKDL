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
import { cleanLine } from "./theme";
import { PRESENTERS, presenterPortraitSrc, type PresenterId } from "./presenters/presenter-config";
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
    <div className="flex flex-col items-stretch" style={{ maxWidth: 760, width: "100%", minWidth: 0 }}>
      {previousTurn && (
        <div className="self-start flex items-baseline gap-2 mb-1.5" style={{ opacity: 0.7, maxWidth: "90%", minWidth: 0, padding: "4px 12px", borderRadius: 999, background: "rgba(10,8,18,.78)", border: "1px solid rgba(255,255,255,.08)", marginLeft: 70 }}>
          <span className="pm-lab shrink-0" style={{ color: PRESENTERS[previousTurn.speaker as PresenterId].accent }}>{PRESENTERS[previousTurn.speaker as PresenterId].name}</span>
          <span className="truncate" style={{ fontFamily: "Inter, sans-serif", fontSize: "0.82rem", lineHeight: 1.3, color: "rgba(255,255,255,0.72)", minWidth: 0 }}>
            {cleanLine(previousTurn.text)}
          </span>
        </div>
      )}
      <div className="flex items-end gap-3 min-w-0">
        {/* The speaker in the app's glowing ring, beside their line. */}
        <div className="relative shrink-0 lt-ring" style={{ width: 62, height: 62 }}>
          <div className="absolute pointer-events-none" style={{ inset: -6, borderRadius: "50%", background: "conic-gradient(from 0deg, transparent, rgba(255,210,74,.6), transparent 30%, #c4b5fd99, transparent 65%)", filter: "blur(6px)" }} />
          <div className="relative w-full h-full rounded-full" style={{ padding: 3, background: "conic-gradient(from 200deg, #ffd24a, #c4b5fd, #ffd24a, #ffffff, #ffd24a)" }}>
            <div className="w-full h-full rounded-full overflow-hidden" style={{ background: "radial-gradient(circle at 50% 30%, #2f2850, #0f0d18)" }}>
              {/* Framed on the face: zoomed in and anchored near the top of the portrait. */}
              <div style={{ width: "100%", height: "100%", backgroundImage: `url(${presenterPortraitSrc(speaker, "speaking")})`, backgroundSize: "200%", backgroundPosition: "48% 24%", backgroundRepeat: "no-repeat" }} />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0" style={{ padding: 1, borderRadius: 16, background: "linear-gradient(140deg, #ffd24a, rgba(255,210,74,.12) 50%, #ffd24a)", boxShadow: "0 14px 36px rgba(0,0,0,.6)" }}>
          <div style={{ borderRadius: 15, padding: "10px 16px 12px", background: "linear-gradient(180deg, rgba(34,26,10,.97), rgba(15,11,5,.97))" }}>
            <div className="flex items-center gap-2">
              <span className="pm-lab" style={{ color: "#ffd24a" }}>{presenter.name}</span>
              <span className="pm-lab">· {presenter.role}</span>
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "1.05rem", lineHeight: 1.4, color: "#f3efe4", marginTop: 3 }}>
              {cleanLine(turn.text)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
