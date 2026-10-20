import { useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Crown, Flag, Shield, Trophy, Users, X } from "lucide-react";
import { CareerNavigation } from "./CareerNavigation";
import "./_group.css";

const previewLink = "#career-preview";

function Section({ title, icon, accent, children }: { title: string; icon: ReactNode; accent: string; children: ReactNode }) {
  return <section className="career-section" style={{ "--section-accent": accent } as CSSProperties}>
    <div className="career-section-head"><h2><span aria-hidden>{icon}</span>{title}</h2></div>
    {children}
  </section>;
}

function CareerHeader() {
  const [attentionOpen, setAttentionOpen] = useState(false);
  return <header className="career-header">
    <div className="career-header-main"><div className="career-brand">My Career<small>Season 2 · Week 18 · Professional</small></div><span className="career-chip">Slot 1</span></div>
    <div className="career-header-tools"><div className="career-attention-wrap"><button type="button" className="career-attention-trigger" aria-expanded={attentionOpen} onClick={() => setAttentionOpen(value => !value)}><Bell size={17} aria-hidden /><span>Attention</span><span className="career-inbox-count">2</span></button>
      {attentionOpen && <section className="career-attention-panel" aria-label="Career attention"><header className="career-attention-panel-header"><div><span className="career-eyebrow">Career updates</span><h2>Attention</h2><p>Your next steps and recent activity.</p></div>
        <div><span className="career-attention-total">2 actions</span>{" "}<button type="button" className="career-attention-close" aria-label="Close Career attention" onClick={() => setAttentionOpen(false)}><X size={17} /></button></div></header>
        <div className="career-attention-content"><section className="career-attention-group"><h3>Action required</h3><a href={previewLink}><Bell size={14} />Season Review waiting</a><a href={previewLink}>East Midlands Open · Entry closes this week</a></section>
          <section className="career-attention-group"><h3>Career updates</h3><a href={previewLink}><Trophy size={14} />First ranking recorded · Season 1</a></section>
          <section className="career-attention-group"><h3>World news</h3><a href={previewLink}>North returns to winning form ahead of the majors</a></section></div></section>}
    </div>
      <a className="home-text-link" href={previewLink}>Career Guide</a><a className="home-text-link" href={previewLink}>Save health</a></div>
  </header>;
}

function ClubTable({ rows, seasonPoints = false }: { rows: { pos: number; name: string; points: number; you?: boolean; foot?: string }[]; seasonPoints?: boolean }) {
  return <ol className="career-club__table">{rows.map(row => <li key={`${row.pos}-${row.name}`} className={row.you ? "is-you" : undefined}>
    <b>{row.pos}</b><span>{row.you ? <strong>You</strong> : row.name}{row.foot && <small>{row.foot}</small>}</span><em>{row.points}</em>
    {seasonPoints && <small>Last season {Math.max(0, row.points - 3)} pts · {row.pos === 1 ? "2 titles" : "1 title"}</small>}
  </li>)}</ol>;
}

export function CurrentClub() {
  return <main className="career-root">
    <CareerHeader />
    <CareerNavigation />
    <div className="career-club">
      <section className="career-page-hero" style={{ "--hero-accent": "#7ec8a4" } as CSSProperties}>
        <div className="career-page-hero__stage">
          <div className="career-page-hero__content">
            <div className="career-page-hero__text">
              <p className="career-page-hero__kicker"><i aria-hidden="true" />Nottinghamshire · County league</p>
              <h1 className="career-page-hero__title">The Robin Hood</h1>
              <div className="career-page-hero__subtitle"><p>Your home club. Members score club points with their finishes at club nights, county and regional events. You turned professional and remain the club’s legend.</p></div>
            </div>
          </div>
        </div>
        <dl className="career-page-hero__stats" style={{ "--hero-cols": 4 } as CSSProperties}>
          <div className="is-gold"><dt>Division</dt><dd>1</dd></div><div><dt>League position</dt><dd>2nd</dd></div>
          <div><dt>Club points</dt><dd>48</dd></div><div><dt>Captain</dt><dd>Jack Turner</dd></div>
        </dl>
      </section>

      <Section title="Division 1 · Season 2" icon={<Shield size={16} />} accent="#7ec8a4">
        <ClubTable rows={[
          { pos: 1, name: "Nottingham Trent", points: 53, foot: "3 titles · Last season 27 pts" },
          { pos: 2, name: "The Robin Hood", points: 48, you: true, foot: "2 titles · Last season 31 pts" },
          { pos: 3, name: "Derbyshire Arrows", points: 41, foot: "Last season 22 pts" },
          { pos: 4, name: "Leicester Doubles", points: 36, foot: "Last season 19 pts" },
          { pos: 5, name: "Lincoln City", points: 31, foot: "Last season 14 pts" },
          { pos: 6, name: "The Steel Tip", points: 27, foot: "Last season 12 pts" },
        ]} />
        <p className="career-club__footnote">The top two go up and the bottom two go down at the end of the season. Points: winner 5, runner-up 3, semi-final 2, quarter-final 1.</p>
      </Section>

      <div id="team-nights"><Section title="Team nights" icon={<Users size={16} />} accent="#69b8ec">
        <div className="team-night">
          <p className="team-night__note">Wednesday nights, weeks 4–44: your nation’s clubs play each other home and away, six singles a side (best of five legs). You play whenever you’re free. If you’re booked into an event that night, a clubmate stands in. After the league, the top four play semi-finals and a final; league seeding breaks a tied knockout match.</p>
          <p className="team-night__next" data-free="true"><b>Next: week 19</b>, away at Derbyshire Arrows. You’re in the team.</p>
          <div className="team-night__last">
            <p><b>Week 17</b>, at home to Leicester Doubles: <strong data-tone="up">Won 4-2</strong></p>
            <ol className="team-night__singles">
              <li><span>Jack Turner</span><b>3-1</b><span>Sam Price</span></li><li data-you="true"><span>You</span><b>3-2</b><span>Peter Howard</span></li>
              <li><span>Callum Reed</span><b>1-3</b><span>Dan Walker</span></li><li><span>Tom Walsh</span><b>3-0</b><span>Gary Collins</span></li>
            </ol>
          </div>
          <ClubTable rows={[
            { pos: 1, name: "Nottingham Trent", points: 31, foot: "P8 W7 D0 L1 · singles 39-18" },
            { pos: 2, name: "The Robin Hood", points: 28, you: true, foot: "P8 W6 D0 L2 · singles 34-21" },
            { pos: 3, name: "Derbyshire Arrows", points: 25, foot: "P8 W5 D1 L2 · singles 31-24" },
            { pos: 4, name: "Leicester Doubles", points: 21, foot: "P8 W4 D0 L4 · singles 28-27" },
          ]} />
          <p className="team-night__note">Your singles this season: won 6 of 7.</p>
        </div>
      </Section></div>

      <div id="host-tournament"><Section title="Run your own tournament" icon={<Trophy size={16} />} accent="#ffd24a">
        <div className="host">
          <p className="host__note">Book the back room at The Robin Hood and run your own night. The room and any prize money you add are paid up front. Players pay your entry fee: you keep 20% and the rest goes in the pot with your prize money (winner half, runner-up a quarter, semi-finalists an eighth each). It’s a local special in the calendar, so only players free that night can come, and you can enter it yourself. Up to 2 a season.</p>
          <form className="host__form" aria-label="Read-only tournament setup">
            <label><span>Name (optional)</span><input disabled value="" placeholder="The Robin Hood Open" readOnly /></label>
            <label><span>Week</span><select disabled defaultValue="Week 22"><option>Week 22</option></select></label>
            <label><span>Night</span><select disabled defaultValue="Saturday"><option>Saturday</option></select></label>
            <label><span>Field</span><select disabled defaultValue="16 players (room £25)"><option>16 players (room £25)</option></select></label>
            <label><span>Entry fee (£)</span><input disabled value="10" readOnly /></label>
            <label><span>Your prize money (£)</span><input disabled value="50" readOnly /></label>
            <p className="host__preview">Expect about <b>12</b> players. Pot about <b>£150</b> (winner £75). You pay <b>£75</b> now and keep about <b>£24</b> of the fees.</p>
            <button type="button" className="career-btn career-btn-gold" disabled>Book it</button>
          </form>
          <ul className="host__events"><li><a href={previewLink}><b>Robin Hood Winter Classic</b></a><small>Wk 10 · Saturday · Played · 14 players · £10 entry · you kept £28 · you won it</small></li></ul>
        </div>
      </Section></div>

      <Section title="Members" icon={<Users size={16} />} accent="#7ec8a4">
        <ClubTable seasonPoints rows={[
          { pos: 1, name: "Jack Turner", points: 48, foot: "Captain · 3 titles" },
          { pos: 2, name: "You", points: 42, you: true, foot: "Professional · 2 titles" },
          { pos: 3, name: "Callum Reed", points: 35, foot: "1 title" },
          { pos: 4, name: "Tom Walsh", points: 31, foot: "1 title" },
          { pos: 5, name: "Peter Howard", points: 24 },
          { pos: 6, name: "Gary Collins", points: 18 },
        ]} />
      </Section>

      <Section title="Nottinghamshire representative squads" icon={<Shield size={16} />} accent="#69b8ec">
        <div className="career-club__copy">
          <p>Choose the county squad category you’re eligible for. UKDA-style format: 12 singles in each men’s team and 6 in each women’s team; A matches are best of 7 legs, women’s and lower-division men’s B matches best of 5. When selected and available, you play your own single in the live scorer; the other singles are simulated. The fixture completes after your match is finished.</p>
          <div className="career-club__switches"><button type="button" className="career-btn career-btn-gold" aria-pressed="true" disabled>Men’s squads</button><button type="button" className="career-btn career-btn-ghost" aria-pressed="false" disabled>Women’s squads</button></div>
        </div>
        <p className="career-club__copy">You are currently selected in the men’s A squad.</p>
        <div className="career-club__grid">
          <section className="career-club__mini"><h3>Men’s A · 12/12</h3><ol><li>1. Jack Turner · 21 pts</li><li className="is-you">2. You · 18 pts</li><li>3. Callum Reed · 16 pts</li><li>4. Tom Walsh · 14 pts</li></ol></section>
          <section className="career-club__mini"><h3>Men’s B · 10/12</h3><ol><li>1. Peter Howard · 11 pts</li><li>2. Gary Collins · 9 pts</li><li>3. Sam Price · 8 pts</li></ol></section>
          <section className="career-club__mini"><h3>Women’s A · 6/6</h3><ol><li>1. Rachel Moore · 18 pts</li><li>2. Sarah Green · 14 pts</li><li>3. Lucy Hill · 12 pts</li></ol></section>
          <section className="career-club__mini"><h3>Women’s B · 5/6</h3><ol><li>1. Emma White · 9 pts</li><li>2. Anne Foster · 8 pts</li></ol></section>
        </div>
        <h3 className="career-club__subhead">UKDA-style county team standings · Season 2</h3>
        <p className="career-club__caption">Separate tables for men’s and women’s A/B teams. Points are sets won in played county fixtures.</p>
        <div className="career-club__grid">
          <section className="career-club__mini"><h4>Men’s A</h4><ClubTable rows={[{ pos: 1, name: "Nottinghamshire", points: 34, foot: "4 played · 3W 0D 1L" },{ pos: 2, name: "Derbyshire", points: 29, foot: "4 played · 2W 1D 1L" },{ pos: 3, name: "Leicestershire", points: 26, foot: "4 played · 2W 0D 2L" }]} /></section>
          <section className="career-club__mini"><h4>Women’s A</h4><ClubTable rows={[{ pos: 1, name: "Nottinghamshire", points: 22, foot: "4 played · 3W 0D 1L" },{ pos: 2, name: "Lincolnshire", points: 18, foot: "4 played · 2W 0D 2L" },{ pos: 3, name: "Derbyshire", points: 16, foot: "4 played · 1W 1D 2L" }]} /></section>
        </div>
        <h3 className="career-club__subhead">County fixtures</h3>
        <ul className="career-club__history"><li><span>Round 5 · Week 21</span><span>at Derbyshire</span><em>Scheduled</em></li><li><span>Round 4 · Week 17</span><span>vs Leicestershire</span><em>Men A 8-4 · Women A 4-2 · You won your single</em></li></ul>
        <h3 className="career-club__subhead">Individual county points · Season 2</h3>
        <p className="career-club__caption">These individual event finishes select the squads; they do not count as team match results.</p>
        <ClubTable rows={[{ pos: 1, name: "Jack Turner", points: 26 },{ pos: 2, name: "You", points: 22, you: true },{ pos: 3, name: "Callum Reed", points: 18 },{ pos: 4, name: "Tom Walsh", points: 15 }]} />
      </Section>

      <Section title="England national team" icon={<Flag size={16} />} accent="#e4bb67">
        <p className="career-club__copy">The World Cup of Darts takes each nation’s two best players on the published rankings. On today’s rankings you are 8th in line.</p>
        <ClubTable rows={[{ pos: 1, name: "Luke Humphries", points: 1 },{ pos: 2, name: "Michael Smith", points: 4 },{ pos: 3, name: "Rob Cross", points: 8 },{ pos: 4, name: "You", points: 18, you: true }]} />
        <ul className="career-club__history"><li><span>Season 1</span><span>Luke Humphries &amp; Michael Smith</span><em></em></li></ul>
      </Section>

      <Section title="Club history" icon={<Crown size={16} />} accent="#e9c77a">
        <p className="career-club__copy">Division titles: Division 2, season 1</p>
        <ul className="career-club__history"><li><span>Season 2</span><span>Division 1 · 2nd · 48 pts</span><em>Promoted</em></li><li><span>Season 1</span><span>Division 2 · 1st · 41 pts</span><em>Champions</em></li></ul>
      </Section>
    </div>
  </main>;
}
