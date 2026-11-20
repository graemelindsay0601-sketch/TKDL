import { TIER_COLORS } from "@/components/tier-badge";
import { PageHero } from "@/components/premium/Premium";
import { Shield, Target, Trophy, Zap, Skull, Star, RefreshCw, BookOpen, Users, Coins, Layers, Tv2, Dumbbell, Bot, Flame, Swords, Medal } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";

// GET /achievements/counts — same live source the Hub uses for its "X
// total achievements" stat, which used to be a hardcoded number that
// drifted from reality as achievements were added/retired (see hub route's
// own comment on that fix). This page's "There are N achievements" line had
// exactly the same hardcoded-number problem — worth fixing the same way
// rather than just typing in a fresher number that will only go stale
// again next time achievements are added or retired. `core` specifically
// (not the endpoint's grand total) because this section — and its "5
// rarities" claim — describes the league/core achievement system; Shadow
// Bot and Card Clash each get their own count called out in their own
// section below, and Tour achievements don't carry a rarity at all (see
// achievements/detail route), so folding them in here would make the "5
// rarities" line inaccurate.
type AchievementCounts = { core: number; tour: number; shadowBot: number; cardClash: number; total: number };

function RuleSection({
  icon, title, accent = "#ff005c", children, stat, statLabel, n,
}: {
  icon: React.ReactNode; title: string; accent?: string; children: React.ReactNode;
  stat?: React.ReactNode; statLabel?: string; n?: number;
}) {
  return (
    <div className="pm-card p-5 relative overflow-hidden" style={{ ["--pm-acc" as any]: accent }}>
      <div className="absolute pointer-events-none" style={{ right: -70, top: -70, width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle, ${accent}2a, transparent 70%)` }} />
      {n != null && (
        <div className="absolute pointer-events-none select-none" style={{ right: 14, bottom: 6, fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 64, lineHeight: 1, color: "transparent", WebkitTextStroke: `1px ${accent}33` }}>
          {String(n).padStart(2, "0")}
        </div>
      )}
      <div className="flex items-center gap-3 mb-4 relative">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ color: accent, background: `${accent}1c`, border: `1px solid ${accent}55`, boxShadow: `0 0 14px ${accent}33` }}>{icon}</span>
        <h2 className="uppercase text-lg"
          style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, letterSpacing: "0.05em", color: "#f2eefc", lineHeight: 1.15 }}>
          {title}
        </h2>
        {stat != null && (
          <div className="ml-auto shrink-0 text-center rounded-xl px-3 py-1.5" style={{ background: `linear-gradient(180deg, ${accent}30, ${accent}0a)`, border: `1px solid ${accent}66`, boxShadow: `0 0 14px ${accent}2a` }}>
            <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, color: "#fff", textShadow: `0 0 10px ${accent}` }}>{stat}</div>
            {statLabel && <div className="pm-lab justify-center" style={{ fontSize: 8, marginTop: 2, letterSpacing: ".12em" }}>{statLabel}</div>}
          </div>
        )}
      </div>
      <div className="space-y-2.5 relative">{children}</div>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm" style={{ color: "#cfcade", lineHeight: 1.6 }}>
      <span className="shrink-0 mt-2 w-1.5 h-1.5 rotate-45" style={{ background: "#ffd24a", boxShadow: "0 0 6px rgba(255,210,74,0.7)" }} />
      <span>{children}</span>
    </div>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-black" style={{ color: "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em" }}>{children}</span>;
}

function Gold({ children }: { children: React.ReactNode }) {
  return <span className="font-black" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{children}</span>;
}

function Red({ children }: { children: React.ReactNode }) {
  return <span className="font-black" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{children}</span>;
}

function Blue({ children }: { children: React.ReactNode }) {
  return <span className="font-black" style={{ color: "#6ab0ff", fontFamily: "Oswald, sans-serif" }}>{children}</span>;
}

export default function Rules() {
  const { data: achCounts } = useFetch<AchievementCounts>("/api/achievements/counts");
  return (
    <div className="space-y-6 pm-page">
      <PageHero kicker="The rulebook" icon={<BookOpen className="w-3.5 h-3.5" />} title="League Rules" accent="#ff005c" accent2="#ffd24a"
        sub="The Tesco Kilbirnie Darts League — points wager format. Read before you play.">
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { v: "25", l: "Start pts", c: "#ff7aa6" },
            { v: "1000", l: "Start ELO", c: "#9cc6ff" },
            { v: "1+", l: "Min stake", c: "#ffd24a" },
            { v: "0", l: "= Out", c: "#ff5c7a" },
          ].map(t => (
            <div key={t.l} className="rounded-2xl px-1 py-2.5 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.12)" }}>
              <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, color: t.c, textShadow: `0 0 14px ${t.c}77` }}>{t.v}</div>
              <div className="pm-lab justify-center mt-1" style={{ fontSize: 8, letterSpacing: ".1em" }}>{t.l}</div>
            </div>
          ))}
        </div>
      </PageHero>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Points system */}
        <RuleSection icon={<Target className="w-5 h-5" />} title="The Points System" n={1} stat="25" statLabel="start pts" accent="#ff005c">
          <Rule>Every player starts each season with <Highlight>25 points</Highlight>.</Rule>
          <Rule>Before each match, both players agree on a <Gold>stake</Gold> — the number of points wagered (minimum <Highlight>1</Highlight>).</Rule>
          <Rule>The <Highlight>winner</Highlight> takes the staked points from the loser's total.</Rule>
          <Rule>The maximum stake is limited to the <Highlight>lower</Highlight> of the two players' current points balances — you can't wager what you don't have.</Rule>
          <Rule>Points are <Red>zero-sum</Red>: exactly what one player loses, the other gains.</Rule>
        </RuleSection>

        {/* Elimination */}
        <RuleSection icon={<Skull className="w-5 h-5" />} title="Elimination" n={2} stat="0" statLabel="= out" accent="#ff005c">
          <Rule>If your points total drops to <Red>zero</Red>, you are <Highlight>eliminated</Highlight>.</Rule>
          <Rule>Eliminated players can no longer play in the current season and appear <Red>struck through</Red> on the leaderboard.</Rule>
          <Rule>A player can only be eliminated by a match that reduces them to exactly <Highlight>0</Highlight>.</Rule>
          <Rule>Eliminated players are reset at the start of each new season.</Rule>
        </RuleSection>

        {/* ELO */}
        <RuleSection icon={<Zap className="w-5 h-5" />} title="ELO Rating" n={3} stat="1000" statLabel="start ELO" accent="#0066ff">
          <Rule>Every player also has an <Blue>ELO rating</Blue>, starting at <Highlight>1000</Highlight>.</Rule>
          <Rule>ELO is recalculated after every match using the standard formula (K=32, floor at 800).</Rule>
          <Rule>ELO acts as a <Highlight>tiebreaker</Highlight> when two players have equal points on the leaderboard.</Rule>
          <Rule>ELO is <Highlight>not</Highlight> the primary ranking — points are. But it reflects true skill level across all games played.</Rule>
          <Rule>ELO carries over across seasons and builds your <Highlight>career legacy</Highlight>.</Rule>
        </RuleSection>

        {/* Tiers */}
        <RuleSection icon={<Shield className="w-5 h-5" />} title="Tier System" n={4} stat="5" statLabel="tiers" accent="#ffd24a">
          <Rule><Gold>Diamond</Gold> — ELO 1400+. The elite. Less than 1% ever reach this.</Rule>
          <Rule><Gold>Platinum</Gold> — ELO 1250–1399. Consistent high-level players.</Rule>
          <Rule><Gold>Gold</Gold> — ELO 1100–1249. Above average. Proven results.</Rule>
          <Rule><Highlight>Silver</Highlight> — ELO 950–1099. The starting tier. Most players here.</Rule>
          <Rule>🪨 <Highlight>Bronze</Highlight> — ELO below 950. Under pressure.</Rule>
          <Rule>Tiers update <Highlight>after every match</Highlight> based on current ELO.</Rule>
          <div className="grid grid-cols-5 gap-1 pt-2">
            {([["Bronze", "<950"], ["Silver", "950"], ["Gold", "1100"], ["Platinum", "1250"], ["Diamond", "1400+"]] as const).map(([t, e], k) => { const c = TIER_COLORS[t] ?? "#9ca3af"; return (
              <div key={t} className="text-center">
                <div className="rounded-md" style={{ height: 8 + k * 6, background: `linear-gradient(180deg, ${c}, ${c}44)`, boxShadow: `0 0 10px ${c}55`, marginTop: 24 - k * 6 }} />
                <div className="pm-lab justify-center mt-1.5" style={{ fontSize: 8, color: c, letterSpacing: ".06em" }}>{t}</div>
                <div className="text-[10px] tabular-nums" style={{ color: "#8f8aa3", fontFamily: "Oswald, sans-serif" }}>{e}</div>
              </div>
            ); })}
          </div>
        </RuleSection>

        {/* Season structure */}
        <RuleSection icon={<RefreshCw className="w-5 h-5" />} title="Season Structure" n={5} stat="1" statLabel="month" accent="#22c55e">
          <Rule>Seasons run <Highlight>monthly</Highlight>. The server automatically opens a new season each month.</Rule>
          <Rule>The player with the <Gold>most points</Gold> at season end is crowned <Gold>Season Champion</Gold> — no playoff needed.</Rule>
          <Rule>If two or more players are <Highlight>tied on points</Highlight>, a single one-off tiebreaker match is played to decide the champion. No stake — just a straight game.</Rule>
          <Rule>Season standings are <Highlight>snapshotted</Highlight> permanently — you can view them in the Season Archive.</Rule>
          <Rule>At season reset, <Highlight>everyone</Highlight> starts fresh with 25 points. Only <Blue>ELO</Blue> carries over.</Rule>
        </RuleSection>

        {/* Achievements */}
        <RuleSection icon={<Star className="w-5 h-5" />} title="Achievements" n={6} stat={achCounts?.core ?? "90+"} statLabel="to unlock" accent="#a855f7">
          <Rule>There are <Highlight>{achCounts?.core ?? "90+"} achievements</Highlight> to unlock across 5 rarities: Common, Rare, Epic, Legendary, and Mythic.</Rule>
          <Rule>Achievements are checked automatically after every match and season event.</Rule>
          <Rule>Some achievements are <Highlight>hidden</Highlight> — you won't know what they are until you unlock them.</Rule>
          <Rule><span style={{ color: "#ff005c", fontWeight: 700 }}>Mythic</span> achievements are season-level milestones (e.g. winning the championship, being unbeaten all season).</Rule>
          <Rule>Achievements are <Highlight>permanent</Highlight> — they don't reset between seasons.</Rule>
          <Rule>Check your progress on your <Highlight>Player Profile</Highlight> page.</Rule>
        </RuleSection>

        {/* Doubles Event & Shift Wars */}
        <RuleSection icon={<Users className="w-5 h-5" />} title="Doubles Event & Shift Wars" n={7} stat="3" statLabel="depts" accent="#22c55e">
          <Rule>Both run as their own <Highlight>monthly leagues</Highlight> alongside singles, resetting at the same time singles does.</Rule>
          <Rule><Highlight>Doubles Event</Highlight> teams are <Gold>randomly redrawn</Gold> every month — new pairings, fresh points.</Rule>
          <Rule><Highlight>Shift Wars</Highlight> departments are fixed — the same three teams reset to their starting points each month.</Rule>
          <Rule>Both use the same points/wager mechanic as singles. Shift Wars is <Highlight>points only</Highlight> — no ELO or tiers.</Rule>
          <Rule>Each month's Shift Wars champion is recorded permanently — check the Shift Wars tab on Standings.</Rule>
        </RuleSection>

        {/* Match submission */}
        <RuleSection icon={<Trophy className="w-5 h-5" />} title="Submitting Matches" n={8} accent="#ffd24a">
          <Rule>Any player can submit a match result via <Gold>Submit Match</Gold> in the sidebar.</Rule>
          <Rule>Select the <Highlight>winner</Highlight> and <Highlight>loser</Highlight> from the dropdown — you cannot pick the same player twice.</Rule>
          <Rule>Enter the <Gold>stake</Gold>: the number of points agreed upon before the match.</Rule>
          <Rule>Submitted results are <Highlight>immediate and final</Highlight>. Contact an admin if a mistake was made.</Rule>
          <Rule>Admins can <Red>delete</Red> incorrect matches via the Admin panel.</Rule>
        </RuleSection>

        {/* Coins & Cosmetics */}
        <RuleSection icon={<Coins className="w-5 h-5" />} title="Coins & The Shop" n={9} accent="#ffd24a">
          <Rule>You earn <Gold>coins</Gold> app-wide — match wins, achievements, daily activity, and more all pay out into one <Highlight>shared balance</Highlight>.</Rule>
          <Rule>Spend them in two places: <Highlight>Card Clash's</Highlight> card shop for packs, or the <Highlight>Customize</Highlight> tab on your Account page for name styles and profile icons.</Rule>
          <Rule>Cosmetics you buy are <Highlight>yours forever</Highlight> — equip or swap between owned ones anytime, for free.</Rule>
          <Rule>An equipped name style shows on your own Account page <Highlight>and</Highlight> on your player profile, so it's visible to anyone who looks you up.</Rule>
        </RuleSection>

        {/* Card Clash */}
        <RuleSection icon={<Layers className="w-5 h-5" />} title="Card Clash" n={10} accent="#f97316">
          <Rule>A collectible-card mini-game, separate from the singles ladder — open packs to collect <Highlight>GOOD</Highlight> and <Red>BAD</Red> effect cards across three rarities.</Rule>
          <Rule>Equip a hand of cards before a Card Clash match to give yourself edges — or curse your opponent.</Rule>
          <Rule>Runs its own seasonal leaderboard, standings, and rewards, independent of the singles/Doubles/Shift Wars seasons.</Rule>
          <Rule>Full card effects and current pack pricing live in Card Clash's own <Highlight>Rules</Highlight> tab, in-app.</Rule>
        </RuleSection>

        {/* TKDL LIVE */}
        <RuleSection icon={<Tv2 className="w-5 h-5" />} title="TKDL LIVE" n={11} accent="#ffd24a">
          <Rule>An automated broadcast <Highlight>"show"</Highlight> that recaps league storylines, form, and highlights.</Rule>
          <Rule>New editions publish periodically — the sidebar's <Gold>LIVE</Gold> tab lights up with a dot whenever a fresh one is ready to watch.</Rule>
          <Rule>It's a produced recap, <Highlight>not</Highlight> a real-time stream — catch up whenever suits you.</Rule>
        </RuleSection>

        {/* Practice, Master 501 & Tour Mode */}
        <RuleSection icon={<Dumbbell className="w-5 h-5" />} title="Practice, Master 501 & Tour Mode" n={12} stat="3" statLabel="modes" accent="#22c55e">
          <Rule><Highlight>Practice</Highlight> — play any game format solo, against the Shadow Bot, or pass-and-play locally. Drills and coaching stats are tracked on your Account page.</Rule>
          <Rule><Highlight>Master 501</Highlight> — a 5-tier progression ladder (Challenger through World Championship) with tightening dart-limit handicaps and longer leg formats the further you climb.</Rule>
          <Rule><Highlight>Tour Mode</Highlight> — a 6-tier bracket tournament (Pub & Local through PDC Majors) across 5 difficulty levels. Winning earns trophies that count toward your Hall of Fame record.</Rule>
          <Rule>All three are playable from a shared device without logging in — same as submitting a match.</Rule>
        </RuleSection>

        {/* Shadow Bot */}
        <RuleSection icon={<Bot className="w-5 h-5" />} title="Shadow Bot" n={13} accent="#22d3ee">
          <Rule>An AI opponent with selectable <Highlight>personas</Highlight> and difficulty levels, for solo practice anytime.</Rule>
          <Rule>Tracks its own achievement set, separate from league play.</Rule>
          <Rule>A good way to warm up or test a format before wagering real points on it.</Rule>
        </RuleSection>

        {/* Board Curse & Boss Battles */}
        <RuleSection icon={<Flame className="w-5 h-5" />} title="Board Curse & Boss Battles" n={14} accent="#eab308">
          <Rule><Highlight>Board Curse</Highlight> — curse-themed challenge formats, playable solo, vs. the bot, or local pass-and-play. <Gold>Endless Survival</Gold> gives each leg a visit limit that tightens as the streak grows, plus one Ward per run to neutralise an active curse.</Rule>
          <Rule><Highlight>Boss Battles</Highlight> — a fixed ladder of bosses fought in order. Each boss has clear, clean-sweep and speed mastery medals; clearing the ladder unlocks the two-life <Gold>Boss Rush</Gold>.</Rule>
          <Rule>Both are shared-device, no-login game modes, same as Practice and Tour Mode.</Rule>
        </RuleSection>

        {/* Titles */}
        <RuleSection icon={<Medal className="w-5 h-5" />} title="Titles" n={15} stat="1" statLabel="active" accent="#a855f7">
          <Rule>Earned display titles for milestones across <Highlight>league matches, Master 501, Practice, and Shadow Bot</Highlight>.</Rule>
          <Rule>Equip one from your Account page to show it next to your name — unlike achievements, only <Highlight>one title</Highlight> can be active at a time.</Rule>
        </RuleSection>

        {/* Spirit of the game */}
        <RuleSection icon={<Target className="w-5 h-5" />} title="Spirit of the Game" n={16} accent="#ff005c">
          <Rule>High stakes make for great stories — but don't wager what you're not willing to lose.</Rule>
          <Rule>The format rewards <Highlight>consistency</Highlight> over luck. Over a season, the best player rises.</Rule>
          <Rule>Eliminations are dramatic but <Highlight>temporary</Highlight> — you're back next season.</Rule>
          <Rule>This is a workplace league — play hard, play fair, and enjoy the rivalry.</Rule>
          <Rule>🎯 May your double-top never wobble.</Rule>
        </RuleSection>

      </div>
    </div>
  );
}
