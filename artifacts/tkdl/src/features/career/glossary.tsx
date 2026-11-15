import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, X } from "lucide-react";

/** Plain-English meanings of the words Career uses. */
export const GLOSSARY: { term: string; means: string }[] = [
  { term: "Continue / Play on", means: "Moves time forward. A whole week is played at once and stops for anything waiting on you: your match, a booked stream, a season review." },
  { term: "Today", means: "The day you're on. Mid-week means the rest of the week has already been played while you were busy (in a match, say)." },
  { term: "Entering an event", means: "Qualifying or being invited doesn't enter you: you still press Enter before entries close." },
  { term: "Entries open / close", means: "Each event takes entries for a few weeks before it starts. Miss the window and you can't play it." },
  { term: "Local events", means: "Pub nights, leagues and knockouts near home. Cheap, and the first step on every path." },
  { term: "County, regional, national amateur", means: "The next level up: bigger fields, better prizes, and what sponsors and the tour notice." },
  { term: "Challenger Tour and Vault", means: "The road to the professional tour for amateurs. Good results here lead to a Tour Card." },
  { term: "Q-School", means: "The annual qualifying school. Do well and you win a Tour Card." },
  { term: "Tour Card", means: "Your licence to play the professional (Pro Tour) events for two seasons." },
  { term: "World ranking", means: "Built from prize money and results in ranking events. It decides invitations to the big events." },
  { term: "Majors", means: "The big televised tournaments. You get in through your ranking or qualifiers." },
  { term: "Sponsors", means: "Brands that pay you. They come to you once your results meet their tier: see Sponsor HQ for who could sign you next." },
  { term: "Local nights", means: "Practice, the pub league and club knockouts: something to do on any free night, for little or no money." },
  { term: "DartCast", means: "Your streaming channel. Go live on free nights to build followers, then earn from ads, tips, members and brand deals." },
  { term: "Your path", means: "What you want from the career. The guide on Today tracks each step and points you at the events that help." },
];

export function Glossary() {
  return <section className="guide-card career-glossary" aria-labelledby="career-glossary-title">
    <h2 id="career-glossary-title"><BookOpen aria-hidden /> What the words mean</h2>
    <dl>{GLOSSARY.map(g => <div key={g.term}><dt>{g.term}</dt><dd>{g.means}</dd></div>)}</dl>
  </section>;
}

const seenKey = (saveId: string) => `tkdl-career-walkthrough:${saveId}`;
const STEPS = [
  { title: "Today tells you where you are", body: "The top card shows the week and the day, and what (if anything) the game is waiting on." },
  { title: "Do the numbered steps", body: "\"What to do next\" lists the best one to three things right now, with a button for each." },
  { title: "Plan your week", body: "Tap a day in This week to see what you can enter that night. Book something, or a local night, before you play on." },
  { title: "Play on", body: "Continue plays the week. It stops for your matches, and warns you if you've nothing booked." },
  { title: "Pick a path", body: "Choose what you want from your career and the guide tracks every step and what it needs." },
];
/** A short walkthrough the first time a save opens on the new Today page. */
export function Walkthrough({ saveId }: { saveId: string }) {
  const [step, setStep] = useState(() => { try { return localStorage.getItem(seenKey(saveId)) === "done" ? -1 : 0; } catch { return -1; } });
  const close = () => { try { localStorage.setItem(seenKey(saveId), "done"); } catch { /* this device only */ } setStep(-1); };
  if (step < 0) return null;
  const s = STEPS[step];
  return <section className="guide-card career-walkthrough" aria-labelledby="career-walkthrough-title" aria-live="polite">
    <header className="guide-card__head"><h2 id="career-walkthrough-title">How Career works · {step + 1} of {STEPS.length}</h2>
      <button type="button" className="guide-link" onClick={close} aria-label="Close the walkthrough"><X aria-hidden /></button></header>
    <b>{s.title}</b><p>{s.body}</p>
    <div className="career-walkthrough__nav">
      {step > 0 && <button type="button" className="career-btn career-btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
      {step < STEPS.length - 1 ? <button type="button" className="career-btn career-btn-gold" onClick={() => setStep(step + 1)}>Next</button>
        : <button type="button" className="career-btn career-btn-gold" onClick={close}>Got it</button>}
      <Link href={`/career/${saveId}/guide`} className="guide-link">What the words mean</Link>
    </div>
  </section>;
}
