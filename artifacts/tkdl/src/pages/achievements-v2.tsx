import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/context/auth";
import { useFetch } from "@/hooks/use-fetch";
import { useAchievementsV2, METALS, METAL_NAME, fmt, seasonGoalText, type AreaView, type TrackView, type FeatView, type SeasonView, type Metal } from "@/components/achievements-v2/api";
import { trackArt, featArt, LOCKED } from "@/components/achievements-v2/art";
import { InspectSheet, type InspectItem } from "@/components/achievements-v2/InspectSheet";
import "./achievements-v2.css";

const METAL_RANK: Record<Metal, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, DIAMOND: 5 };
const AREA_TAB: Record<string, string> = { LEAGUE: "League", TEAMS: "Teams", PRACTICE: "Practice", MASTER501: "Master-501", MODES: "Modes", CAREER: "Career" };
const metalLabel = (t: TrackView) => t.metal ? `${METAL_NAME[t.metal]} · ${fmt(t.value, t.unit)}` : t.value > 0 ? `${fmt(t.value, t.unit)} so far` : "Not started";

function Bar({ value, tone = "gold" }: { value: number; tone?: "gold" | "green" }) {
  return <div className="av2-bar"><i className={tone === "green" ? "green" : ""} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} /></div>;
}

/** One piece on a shelf: its art in its current metal, or a silhouette while locked. */
function ShelfItem({ t, onOpen }: { t: TrackView; onOpen: () => void }) {
  const done = t.nextTarget === null;
  return (
    <div className={`av2-item av2-tap${t.metal ? "" : " locked"}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }} title={done ? `${t.title}: complete` : `${t.next} (${fmt(t.value, t.unit)} / ${fmt(t.nextTarget!, t.unit)})`}>
      <img src={trackArt(t.key, t.metal)} alt="" loading="lazy" style={t.metal ? undefined : LOCKED} />
      <div className="n">{t.title}</div>
      <div className="l">{metalLabel(t)}</div>
      <Bar value={done ? 1 : t.progress} />
      {!done && <div className="next">{t.next}</div>}
    </div>
  );
}

function FeatTile({ f, onOpen }: { f: FeatView; onOpen: () => void }) {
  const earned = !!f.earnedAt;
  return (
    <div className={`av2-feat av2-tap${earned ? "" : " locked"}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }} title={f.goal}>
      <img src={featArt(f.key)} alt="" loading="lazy" style={earned ? undefined : LOCKED} />
      <div className="n">{f.title}</div>
      <div className="g">{earned ? format(new Date(f.earnedAt!), "d MMM yyyy") : f.goal}</div>
      {f.reward && <div className="rw">{earned ? "Unlocked" : "Unlocks"}: {f.reward}</div>}
    </div>
  );
}

/** The area's showpiece in a lit glass case. */
function Showpiece({ f, onOpen }: { f: FeatView; onOpen: () => void }) {
  const earned = !!f.earnedAt;
  return (
    <div className={`av2-show av2-tap${earned ? " earned" : ""}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}>
      <div className="glass" />
      <img src={featArt(f.key)} alt="" style={earned ? undefined : { ...LOCKED, opacity: 0.75 }} />
      <div className="txt">
        <div className="kicker">The showpiece</div>
        <div className="title">{f.title}</div>
        <div className="goal">{f.goal}</div>
        <div className={earned ? "won" : "pts"}>{earned ? `Earned ${format(new Date(f.earnedAt!), "d MMM yyyy")}` : `${f.points} points`}</div>
        {f.reward && <div className="rw">{earned ? "Unlocked" : "Unlocks"}: {f.reward}</div>}
      </div>
    </div>
  );
}

function SeasonCard({ g }: { g: SeasonView }) {
  const target = g.targets[Math.min(g.completed, g.targets.length - 1)];
  const allDone = g.completed >= g.targets.length;
  return (
    <div className={`av2-card av2-season${allDone ? " done" : ""}`}>
      <div className="row"><b>{g.title}</b><span>{allDone ? "Done" : `${fmt(Math.min(g.value, target))} / ${fmt(target)}`}</span></div>
      <div className="g">{seasonGoalText(g)}</div>
      <Bar value={allDone ? 1 : g.value / target} tone="green" />
    </div>
  );
}

/** Tells everyone what changed: a new system, and nothing from the old one is lost (it lives on as the Classics). */
function UpdateNotice() {
  const KEY = "tkdl:av2-update-notice";
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(KEY) !== "seen"; } catch { return true; } });
  const close = () => { setOpen(false); try { localStorage.setItem(KEY, "seen"); } catch { /* fine */ } };
  if (!open) return <button className="av2-notice-mini" onClick={() => setOpen(true)}>What's changed?</button>;
  return (
    <div className="av2-notice" role="note">
      <div className="kicker">New update</div>
      <h2>Achievements have been rebuilt</h2>
      <ul>
        <li><b>Your old achievements aren't lost.</b> Every badge you earned is kept, exactly as it was, in <Link href="/achievements/classics">Classics</Link> and on your profile.</li>
        <li><b>The Classics are now frozen.</b> No new Classic badges are given out from here on. Everything new is earned in this cabinet instead.</li>
        <li><b>Your history counts.</b> The new achievements were worked out from everything you've already played, so you start with the pieces you've earned.</li>
        <li><b>New unlocks pay coins.</b> Every new level, feat and season goal from now on pays coins, plus a one-off welcome bonus if you'd already earned something before the update.</li>
        <li><b>Career has its own tab.</b> Career mode achievements are for bragging rights only. They never give you anything inside Career.</li>
      </ul>
      <div className="actions"><Link href="/achievements/classics" className="ghost">See my Classics</Link><button onClick={close}>Got it</button></div>
    </div>
  );
}

export default function AchievementsV2Page() {
  const { user } = useAuth();
  const search = new URLSearchParams(useSearch());
  const playerId = Number(search.get("player")) || user?.playerId || null;
  const { data, loading } = useAchievementsV2(playerId, true);
  const { data: player } = useFetch<{ name?: string }>(playerId ? `/api/players/${playerId}` : null);
  const [tab, setTab] = useState<AreaView["area"]>("LEAGUE");
  const [inspect, setInspect] = useState<InspectItem | null>(null);
  const view = data && "view" in data ? data.view : null;
  const area = useMemo(() => view?.areas.find(a => a.area === tab) ?? null, [view, tab]);
  const best = useMemo(() => (view?.areas ?? []).flatMap(a => a.tracks.filter(t => t.metal))
    .sort((a, b) => METAL_RANK[b.metal!] - METAL_RANK[a.metal!] || b.level - a.level).slice(0, 3), [view]);
  const seasonGoals = view?.areas.flatMap(a => a.seasonGoals.filter(g => g.value > 0 || a.area === "LEAGUE")) ?? [];

  if (!playerId) return <div className="av2-empty">Sign in to see your achievements. <Link href="/achievements/classics">Classics</Link></div>;
  if (loading) return <div className="av2-empty">Opening the cabinet…</div>;
  if (!view) return <div className="av2-empty">The new achievements aren't live yet. <Link href="/achievements/classics">See the Classics</Link></div>;

  const showpiece = area?.feats.find(f => f.showpiece) ?? null;
  const feats = (area?.feats ?? []).filter(f => !f.showpiece).sort((a, b) => Number(!!b.earnedAt) - Number(!!a.earnedAt));
  const shelves: TrackView[][] = []; (area?.tracks ?? []).forEach((t, i) => { if (i % 3 === 0) shelves.push([]); shelves[shelves.length - 1].push(t); });

  return (
    <div className="av2">
      {data && "preview" in data && data.preview && <div className="av2-preview">Admin preview, worked out live from history. Players can't see this until achievements are switched on.</div>}
      <UpdateNotice />
      <header className="av2-hero">
        <h1>Achievements</h1>
        <div className="sub">{player?.name ?? "Player"} · <b>{fmt(view.score)}</b> points · {view.featsEarned} feats{view.nearly.length ? <> · <span className="purple">{view.nearly.length} nearly there</span></> : null}</div>
        <div className="stage">
          <div className="beam" /><div className="beam l" /><div className="beam r" /><div className="floor" />
          {best[1] && <img className="side l av2-tap" src={trackArt(best[1].key, best[1].metal)} alt="" onClick={() => setInspect({ kind: "track", t: best[1] })} />}
          {best[0] && <img className="main av2-tap" src={trackArt(best[0].key, best[0].metal)} alt="" onClick={() => setInspect({ kind: "track", t: best[0] })} />}
          {best[2] && <img className="side r av2-tap" src={trackArt(best[2].key, best[2].metal)} alt="" onClick={() => setInspect({ kind: "track", t: best[2] })} />}
          {!best.length && <div className="nothing">Your best pieces go on show here.</div>}
        </div>
      </header>
      <div className="av2-metals">
        {METALS.map(m => <div key={m} className={`m ${m.toLowerCase()}`}><i /><b>{view.metals[m]}</b>{METAL_NAME[m]}</div>)}
        <Link href="/achievements/classics" className="classics">Classics</Link>
      </div>

      {view.nearly.length > 0 && (
        <section>
          <h2>Nearly there <small>next level</small></h2>
          {view.nearly.map(t => (
            <div key={t.key} className="av2-near av2-tap" onClick={() => setInspect({ kind: "track", t })}>
              <img src={trackArt(t.key, t.metal)} alt="" style={t.metal ? undefined : LOCKED} />
              <div className="body"><div className="t">{t.title}</div><div className="g">{t.next} · {fmt(t.value, t.unit)} / {fmt(t.nextTarget!, t.unit)}</div><Bar value={t.progress} /></div>
            </div>
          ))}
        </section>
      )}

      {data && "recent" in data && data.recent.length > 0 && (
        <section>
          <h2>Recently earned</h2>
          <div className="av2-recent">
            {data.recent.map(u => (
              <div key={`${u.key}-${u.level}-${u.at}`} className="r">
                <img src={u.kind === "TRACK" ? trackArt(u.key, u.metal) : featArt(u.key)} alt="" />
                <div className="n">{u.title}</div>
                <div className="l">{u.kind === "TRACK" ? `Level ${u.level} · ` : ""}+{u.coins} coins</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {seasonGoals.length > 0 && (
        <section>
          <h2>This season</h2>
          <div className="av2-seasons">{seasonGoals.map(g => <SeasonCard key={g.key} g={g} />)}</div>
        </section>
      )}

      <section>
        <h2>The cabinet <small>{area ? `${AREA_TAB[area.area]} ${area.earned} / ${area.total}` : ""}</small></h2>
        <div className="av2-tabs">
          {view.areas.map(a => (
            <button key={a.area} onClick={() => setTab(a.area)} className={tab === a.area ? "on" : ""}>{AREA_TAB[a.area] ?? a.name} <span>{a.earned}/{a.total}</span></button>
          ))}
        </div>
        {tab === "CAREER" && <p className="av2-career-note">Bragging rights only: these count across all your Career saves and never change anything inside Career. 180s, checkouts, averages and nine-darters count from matches you throw live.</p>}
        {showpiece && <Showpiece f={showpiece} onOpen={() => setInspect({ kind: "feat", f: showpiece })} />}
        {area?.reward && <p className="av2-reward-note">Reach Diamond on any {AREA_TAB[area.area]} track to unlock the <b>{area.reward}</b> profile frame{area.tracks.some(t => t.metal === "DIAMOND") ? " (unlocked)" : ""}.</p>}
        <div className="av2-cabinet">
          {shelves.map((row, i) => <div key={i} className="av2-shelf">{row.map(t => <ShelfItem key={t.key} t={t} onOpen={() => setInspect({ kind: "track", t })} />)}</div>)}
        </div>
        <h2 className="feats">Feats <small>{feats.filter(f => f.earnedAt).length} / {feats.length}</small></h2>
        <div className="av2-feats">{feats.map(f => <FeatTile key={f.key} f={f} onOpen={() => setInspect({ kind: "feat", f })} />)}</div>
      </section>
      {inspect && <InspectSheet item={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}
