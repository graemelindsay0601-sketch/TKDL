import { Shield, Target, Trophy, Zap, Skull, Star, RefreshCw, BookOpen } from "lucide-react";

function RuleSection({
  icon, title, accent = "#ff005c", children,
}: {
  icon: React.ReactNode; title: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className="pdc-card p-6 relative overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}`, paddingLeft: "24px" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 300px 200px at -60px 50%, ${accent}0a, transparent 70%)` }} />
      <div className="flex items-center gap-3 mb-4 relative">
        <div style={{ color: accent, filter: `drop-shadow(0 0 6px ${accent}88)` }}>{icon}</div>
        <h2 className="font-black uppercase text-lg"
          style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", color: "#fff" }}>
          {title}
        </h2>
      </div>
      <div className="space-y-2.5 relative">{children}</div>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
      <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "#ff005c", boxShadow: "0 0 6px rgba(255,0,92,0.6)" }} />
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
  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8" style={{ color: "#ff005c", filter: "drop-shadow(0 0 8px rgba(255,0,92,0.6))" }} />
          <h1 className="font-black uppercase"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", letterSpacing: "0.04em", textShadow: "0 0 30px rgba(255,0,92,0.2)", lineHeight: 1 }}>
            League Rules
          </h1>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          The Tesco Kilbirnie Darts League — points wager format. Read before you play.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Points system */}
        <RuleSection icon={<Target className="w-5 h-5" />} title="The Points System" accent="#ff005c">
          <Rule>Every player starts each season with <Highlight>25 points</Highlight>.</Rule>
          <Rule>Before each match, both players agree on a <Gold>stake</Gold> — the number of points wagered (minimum <Highlight>1</Highlight>).</Rule>
          <Rule>The <Highlight>winner</Highlight> takes the staked points from the loser's total.</Rule>
          <Rule>The maximum stake is limited to the <Highlight>lower</Highlight> of the two players' current points balances — you can't wager what you don't have.</Rule>
          <Rule>Points are <Red>zero-sum</Red>: exactly what one player loses, the other gains.</Rule>
        </RuleSection>

        {/* Elimination */}
        <RuleSection icon={<Skull className="w-5 h-5" />} title="Elimination" accent="#ff005c">
          <Rule>If your points total drops to <Red>zero</Red>, you are <Highlight>eliminated</Highlight>.</Rule>
          <Rule>Eliminated players can no longer play in the current season and appear <Red>struck through</Red> on the leaderboard.</Rule>
          <Rule>A player can only be eliminated by a match that reduces them to exactly <Highlight>0</Highlight>.</Rule>
          <Rule>Eliminated players are reset at the start of each new season.</Rule>
        </RuleSection>

        {/* ELO */}
        <RuleSection icon={<Zap className="w-5 h-5" />} title="ELO Rating" accent="#0066ff">
          <Rule>Every player also has an <Blue>ELO rating</Blue>, starting at <Highlight>1000</Highlight>.</Rule>
          <Rule>ELO is recalculated after every match using the standard formula (K=32, floor at 800).</Rule>
          <Rule>ELO acts as a <Highlight>tiebreaker</Highlight> when two players have equal points on the leaderboard.</Rule>
          <Rule>ELO is <Highlight>not</Highlight> the primary ranking — points are. But it reflects true skill level across all games played.</Rule>
          <Rule>ELO carries over across seasons and builds your <Highlight>career legacy</Highlight>.</Rule>
        </RuleSection>

        {/* Tiers */}
        <RuleSection icon={<Shield className="w-5 h-5" />} title="Tier System" accent="#ffd24a">
          <Rule><Gold>Diamond</Gold> — ELO 1400+. The elite. Less than 1% ever reach this.</Rule>
          <Rule><Gold>Platinum</Gold> — ELO 1250–1399. Consistent high-level players.</Rule>
          <Rule><Gold>Gold</Gold> — ELO 1100–1249. Above average. Proven results.</Rule>
          <Rule><Highlight>Silver</Highlight> — ELO 950–1099. The starting tier. Most players here.</Rule>
          <Rule>🪨 <Highlight>Bronze</Highlight> — ELO below 950. Under pressure.</Rule>
          <Rule>Tiers update <Highlight>after every match</Highlight> based on current ELO.</Rule>
        </RuleSection>

        {/* Season structure */}
        <RuleSection icon={<RefreshCw className="w-5 h-5" />} title="Season Structure" accent="#22c55e">
          <Rule>Seasons run <Highlight>monthly</Highlight>. The server automatically opens a new season each month.</Rule>
          <Rule>The player with the <Gold>most points</Gold> at season end is crowned <Gold>Season Champion</Gold> — no playoff needed.</Rule>
          <Rule>If two or more players are <Highlight>tied on points</Highlight>, a single one-off tiebreaker match is played to decide the champion. No stake — just a straight game.</Rule>
          <Rule>Season standings are <Highlight>snapshotted</Highlight> permanently — you can view them in the Season Archive.</Rule>
          <Rule>At season reset, <Highlight>everyone</Highlight> starts fresh with 25 points. Only <Blue>ELO</Blue> carries over.</Rule>
        </RuleSection>

        {/* Achievements */}
        <RuleSection icon={<Star className="w-5 h-5" />} title="Achievements" accent="#a855f7">
          <Rule>There are <Highlight>92 achievements</Highlight> to unlock across 5 rarities: Common, Rare, Epic, Legendary, and Mythic.</Rule>
          <Rule>Achievements are checked automatically after every match and season event.</Rule>
          <Rule>Some achievements are <Highlight>hidden</Highlight> — you won't know what they are until you unlock them.</Rule>
          <Rule><span style={{ color: "#ff005c", fontWeight: 700 }}>Mythic</span> achievements are season-level milestones (e.g. winning the championship, being unbeaten all season).</Rule>
          <Rule>Achievements are <Highlight>permanent</Highlight> — they don't reset between seasons.</Rule>
          <Rule>Check your progress on your <Highlight>Player Profile</Highlight> page.</Rule>
        </RuleSection>

        {/* Match submission */}
        <RuleSection icon={<Trophy className="w-5 h-5" />} title="Submitting Matches" accent="#ffd24a">
          <Rule>Any player can submit a match result via <Gold>Submit Match</Gold> in the sidebar.</Rule>
          <Rule>Select the <Highlight>winner</Highlight> and <Highlight>loser</Highlight> from the dropdown — you cannot pick the same player twice.</Rule>
          <Rule>Enter the <Gold>stake</Gold>: the number of points agreed upon before the match.</Rule>
          <Rule>Submitted results are <Highlight>immediate and final</Highlight>. Contact an admin if a mistake was made.</Rule>
          <Rule>Admins can <Red>delete</Red> incorrect matches via the Admin panel.</Rule>
        </RuleSection>

        {/* Spirit of the game */}
        <RuleSection icon={<Target className="w-5 h-5" />} title="Spirit of the Game" accent="#ff005c">
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
