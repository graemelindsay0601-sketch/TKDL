// TKDL LIVE — the guest presenter cameo: when a real player hits a genuine
// career milestone this Edition, the two hosts invite them up to the desk
// for a brief, warm moment before moving on — a "cameo," not a full
// segment of their own. Exactly mirrors closing-tease-math.ts's and
// cold-open-math.ts's own split: pure template data + one pure lookup
// helper here, zero @workspace/db imports, directly unit-testable via
// `node --test`; the DB-facing parts (buildTemplateFacts, interpolateTemplate)
// stay in edition-engine.ts's own buildGuestCameoSegment, which is this
// file's only real caller.
//
// ── Why the guest never has a line of their own ─────────────────────────
// {{playerName}} is a real, named, identifiable member of this club, not a
// fictional character. Inventing words and putting them in that real
// person's mouth — even a cheerful one-liner — is not something either
// presenter's dialogue should ever do. Every template below is written so
// BOTH lines belong to Chalky and Ton themselves: they invite the player up
// and talk about them, using only that story type's own verified facts;
// the "guest" is welcomed and named on screen, never scripted. This is also
// why there's no new presenter portrait or third speaker identity involved
// anywhere in this feature — PresenterPortrait.tsx's own header already
// documents this project's standing rule to omit the visual layer entirely
// rather than invent a stand-in face, and a text cameo with no fabricated
// quote needs no visual layer to begin with.
//
// ── Why only three of the four MILESTONE story types ─────────────────────
// CAREER_MATCH_MILESTONE, CAREER_WIN_MILESTONE and 180_MILESTONE are
// genuinely something to applaud — exactly the kind of moment a real desk
// would invite someone up for. ELIMINATION_MILESTONE is the opposite: a
// bittersweet "that number nobody wants to see climb" (see its own existing
// commentary-library.ts phrases, all careful to stay neutral/sympathetic
// rather than celebratory). Inviting someone to the desk to celebrate their
// own elimination count would be tone-deaf, so that story type is
// deliberately absent from GUEST_CAMEO_TEMPLATES below — hasGuestCameo()
// returns false for it, same as for every non-MILESTONE story type.
//
// ── Why every template is safe to air verbatim ──────────────────────────
// Every placeholder below comes straight from that exact story type's own
// established *_REQUIRES fact set in commentary-library.ts
// (CAREER_MATCH_MILESTONE_REQUIRES, CAREER_WIN_MILESTONE_REQUIRES,
// MILESTONE_180_REQUIRES) — never a fact that story type doesn't actually
// carry, so interpolation can never fail for a story of the right type.
// Hand-checked against the same two rules commentary-library.ts's own
// phrases are held to (17.2's record-claim language, 12.7's banned-topic
// language) and edition-engine.ts's own FUTURE_MATCH_LANGUAGE_PATTERN.
import type { StoryType } from "./story-types.ts";

type GuestCameoPair = { a: string; b: string };

export const GUEST_CAMEO_TEMPLATES: Partial<Record<StoryType, readonly GuestCameoPair[]>> = {
  CAREER_MATCH_MILESTONE: [
    { a: "Before we move on, let's get {{playerName}} up to the desk for a second — that's career match number {{careerGamesPlayed}} tonight.", b: "Come on up, {{playerName}}. {{careerGamesPlayed}} matches in this league is no small thing — enjoy the moment." },
    { a: "Quick one before we continue — {{playerName}}, come and join us, because {{careerGamesPlayed}} TKDL matches deserves a mention.", b: "Get yourself up here. That kind of staying power earns a seat at the desk for a minute." },
  ],
  CAREER_WIN_MILESTONE: [
    { a: "Let's bring {{playerName}} up to the desk for a moment — career win number {{careerWins}}, that's worth celebrating properly.", b: "Come and join us, {{playerName}}. {{careerWins}} wins in this league is a serious number." },
    { a: "Before we get into the rest of the show — {{playerName}}, come up and join us. {{careerWins}} career wins doesn't happen by accident.", b: "Get yourself over here. That's a landmark, that." },
  ],
  "180_MILESTONE": [
    { a: "Right, {{playerName}} — get yourself up to the desk, because {{career180s}} career maximums is worth a round of applause.", b: "Come and join us for a second. {{matchThrown180s}} of them tonight alone, by the sound of it." },
    { a: "Before anything else — {{playerName}}, come up and join us at the desk. {{career180s}} career 180s doesn't happen to just anybody.", b: "Get up here. We'll let the board speak for itself tonight." },
  ],
};

export function hasGuestCameo(storyType: StoryType): boolean {
  return storyType in GUEST_CAMEO_TEMPLATES;
}
