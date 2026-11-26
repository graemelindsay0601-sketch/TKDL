import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Coins, CalendarDays, Rocket, ChevronRight, X } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";

const KEY = (id: number) => `tkdl:welcome-seen:${id}`;

const STEPS = [
  { icon: <Coins className="w-7 h-7" />, color: "#ffd24a", kicker: "How it works", title: "Points on the line",
    body: ["Everyone starts each season on 25 points.", "Before a match you both agree a stake. The winner takes those points from the loser.", "You can't stake more than the lower of your two balances. Drop to 0 and you're out until next season."] },
  { icon: <CalendarDays className="w-7 h-7" />, color: "#4fa8ff", kicker: "Seasons", title: "A new season every month",
    body: ["Points reset on the 1st; the top of the table on the last day is champion.", "Your ELO rating carries on across seasons and sets your tier.", "There's Doubles and Shift Wars too, on the same points and stakes."] },
  { icon: <Rocket className="w-7 h-7" />, color: "#3ee0b4", kicker: "Get started", title: "Your first steps", body: [] },
];
const CHECKLIST = [
  { label: "Play a match on the scorer", href: "/play" },
  { label: "Try today's daily drill", href: "/practice" },
  { label: "Have a look at the standings", href: "/leaderboard" },
  { label: "Set up your profile and darts", href: "/account" },
];

/** A three-card welcome for new players (fewer than 3 league matches), shown once per account on this device. */
export function WelcomeTour() {
  const me = useCurrentPlayer();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!me?.playerId) return;
    try { if (localStorage.getItem(KEY(me.playerId))) return; } catch { return; }
    let alive = true;
    fetch(`/api/players/${me.playerId}`).then(r => r.ok ? r.json() : null).then(p => {
      if (!alive || !p) return;
      if ((p.careerGamesPlayed ?? 0) < 3) setOpen(true); else { try { localStorage.setItem(KEY(me.playerId), "1"); } catch { /* private mode */ } }
    }).catch(() => {});
    return () => { alive = false; };
  }, [me?.playerId]);
  if (!open || !me) return null;
  const close = () => { try { localStorage.setItem(KEY(me.playerId), "1"); } catch { /* private mode */ } setOpen(false); };
  const s = STEPS[step], last = step === STEPS.length - 1;
  return (
    <div className="pm-welcome" role="dialog" aria-modal="true" aria-label="Welcome to TKDL">
      <div className="card" style={{ ["--wc" as string]: s.color }}>
        <button className="x" onClick={close} aria-label="Close"><X className="w-4 h-4" /></button>
        <div className="kick">{step === 0 ? `Welcome, ${me.playerName}` : s.kicker}</div>
        <div className="medal">{s.icon}</div>
        <h2>{s.title}</h2>
        {s.body.length > 0 && <ul>{s.body.map(b => <li key={b}>{b}</li>)}</ul>}
        {last && <div className="todo">{CHECKLIST.map(c => <Link key={c.href} href={c.href} onClick={close} className="item"><span>{c.label}</span><ChevronRight className="w-4 h-4" /></Link>)}</div>}
        <div className="dots">{STEPS.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</div>
        <div className="btns">
          {step > 0 && <button className="ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="go" onClick={() => last ? close() : setStep(step + 1)}>{last ? "Let's play" : "Next"}</button>
        </div>
        {!last && <button className="skip" onClick={close}>Skip</button>}
      </div>
    </div>
  );
}
