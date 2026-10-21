import { ArrowUpRight, CalendarDays, ChevronRight, Crown, Map, MapPin, Newspaper, Search, Shield, Trophy, Users } from "lucide-react";

const championships = [
  { kind: "WORLD CHAMPIONSHIP · WEEK 22", name: "The Palace World Championship", venue: "The Palace · London", accent: "#d9b761" },
  { kind: "MAJOR · WEEK 26", name: "Northern Masters", venue: "Civic Arena · Leeds", accent: "#d85468" },
  { kind: "FEATURED · WEEK 31", name: "European Open", venue: "Rhein Forum · Cologne", accent: "#83b5d0" },
  { kind: "MAJOR · WEEK 34", name: "The Crown Invitational", venue: "Foundry Hall · Bristol", accent: "#d9b761" },
];
const headlines = [
  "Rook Calder holds the world number one spot after a strong spring",
  "Mara Vale returns to the Palace as defending champion",
  "Three new venues join the European circuit this season",
  "The Crown Invitational adds a second stage to its autumn weekend",
];
const explore = [
  { title: "Newsroom", detail: "Stories from your Career", icon: Newspaper },
  { title: "Players", detail: "The saved-player directory", icon: Users },
  { title: "Rivalries & H2H", detail: "Your played meetings", icon: Shield },
  { title: "Events & Circuits", detail: "Championship families", icon: Trophy },
  { title: "Venues", detail: "The world venue atlas", icon: MapPin },
  { title: "History", detail: "Champions and past seasons", icon: Crown },
  { title: "Records Book", detail: "Nine-darters & best performances", icon: Trophy },
];

const styles = `
.world-current{min-height:100vh;padding:16px 4.2% 30px;background:#0b111b;color:#e9eef5;font:14px/1.5 "DM Sans",system-ui,sans-serif}
.world-current *{box-sizing:border-box}.wc-top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 16px;border:1px solid #263445;border-radius:14px;background:linear-gradient(135deg,#172331,#101925);box-shadow:0 8px 18px #0005}
.wc-brand{font:700 17px Oswald,system-ui,sans-serif;letter-spacing:.09em}.wc-brand b{color:#e3c56d}.wc-meta{display:flex;gap:18px;color:#9eacbb;font-size:10px;letter-spacing:.14em;text-transform:uppercase}
.wc-nav,.wc-subnav{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;padding:8px;border:1px solid #263445;border-radius:12px;background:#111a26}
.wc-nav a,.wc-subnav a{display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:8px;color:#b7c2cf;text-decoration:none;font-size:12px}.wc-nav a.active,.wc-subnav a.active{background:#332a25;color:#f4d77b;border:1px solid #a8874555}
.wc-hero{position:relative;display:grid;grid-template-columns:1.2fr .8fr;min-height:300px;margin-top:18px;overflow:hidden;border:1px solid #aa8a4d;border-radius:12px;background:linear-gradient(112deg,#1c2938,#101b29 62%,#121523);box-shadow:0 12px 28px #0008,inset 0 1px #ffffff25}
.wc-hero-copy{align-self:center;padding:34px 38px}.wc-kicker{color:#e2c56d;font:700 10px Oswald,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase}
.wc-hero h1{margin:10px 0 8px;font:800 clamp(42px,6vw,72px)/.95 Oswald,system-ui,sans-serif;letter-spacing:.02em;text-transform:uppercase}
.wc-hero h1 em{color:#e3c56d;font-style:normal}.wc-hero p{max-width:56ch;color:#bbc6d4}
.wc-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.wc-actions a{padding:10px 14px;border:1px solid #c1a45d;border-radius:6px;background:linear-gradient(#efd98d,#b89543);color:#17202c;font-weight:800;text-decoration:none;box-shadow:0 3px #58451f}
.wc-actions a+ a{background:#172536;color:#e7edf4;box-shadow:0 3px #09111a}
.wc-art{position:relative;display:grid;place-items:center;min-height:260px;overflow:hidden}
.wc-target{position:relative;width:220px;height:220px;border-radius:50%;background:repeating-radial-gradient(circle,#192737 0 22px,#a68b4b 23px 24px,#172536 25px 42px,#b04759 43px 48px,#172536 49px 67px);border:7px solid #27394c;box-shadow:0 20px 24px #0008,inset 0 0 0 3px #e4c974}
.wc-target:before,.wc-target:after{position:absolute;content:"";background:#c5a453}.wc-target:before{width:2px;height:100%;left:50%;top:0}.wc-target:after{height:2px;width:100%;top:50%;left:0}
.wc-badge{position:absolute;right:9%;bottom:18%;padding:12px;border:1px solid #e5cb76;background:linear-gradient(145deg,#a2384b,#521c2c);box-shadow:5px 7px 0 #080e16;color:#f7e6ab;font:700 11px Oswald,system-ui,sans-serif;letter-spacing:.16em;text-align:center;transform:rotate(7deg)}
.wc-stats{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #465261;background:#101925}.wc-stats div{padding:12px 16px;border-right:1px solid #29384a}.wc-stats small{display:block;color:#8796a7;font-size:9px;letter-spacing:.14em;text-transform:uppercase}.wc-stats strong{display:block;margin-top:4px;color:#f3d982;font:700 20px Oswald,system-ui,sans-serif}
.wc-section{margin-top:16px;border:1px solid #344354;border-radius:10px;background:linear-gradient(155deg,#172536,#101a27);box-shadow:0 7px 15px #0006}
.wc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;border-bottom:1px solid #ffffff16;font:700 15px Oswald,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}.wc-head a{color:#e6ce7d;font:600 11px system-ui,sans-serif;text-decoration:none}
.wc-champs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:14px}
.wc-champ{position:relative;min-height:148px;display:flex;flex-direction:column;justify-content:end;overflow:hidden;padding:14px;border:1px solid #536273;border-radius:8px;background:linear-gradient(145deg,#27384a,#101824);box-shadow:inset 0 1px #ffffff1a}
.wc-champ:before{position:absolute;content:"";width:150px;height:150px;right:-34px;top:-42px;border:2px solid var(--accent);border-radius:50%;box-shadow:0 0 0 13px color-mix(in srgb,var(--accent) 12%,transparent),0 0 0 34px #ffffff05}
.wc-champ small{position:relative;color:var(--accent);font:700 9px Oswald,system-ui,sans-serif;letter-spacing:.16em}.wc-champ strong{position:relative;margin:6px 0;font:700 20px/1.1 Oswald,system-ui,sans-serif}.wc-champ em{position:relative;color:#aebbc9;font-size:11px;font-style:normal}
.wc-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.wc-headlines{margin:0;padding:6px 16px;list-style:none}.wc-headlines li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #ffffff12;color:#dce4ec}.wc-headlines li:last-child{border:0}.wc-headlines span{color:#99a8b8;font-size:10px}
.wc-explore{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px}.wc-tile{display:flex;align-items:center;gap:12px;min-height:72px;padding:11px;border:1px solid #39495a;border-radius:8px;background:#111e2c;color:#eaf0f7;text-decoration:none}.wc-tile svg{color:#e3c56d}.wc-tile strong{display:block;font:700 14px Oswald,system-ui,sans-serif}.wc-tile small{display:block;color:#9eacbb;font-size:10px}
.wc-foot{margin:18px;text-align:center;color:#728092;font-size:9px;letter-spacing:.16em;text-transform:uppercase}
@media(max-width:800px){.wc-hero{grid-template-columns:1fr}.wc-hero-copy{padding:26px 23px}.wc-art{min-height:190px}.wc-target{width:160px;height:160px}.wc-stats{grid-template-columns:repeat(2,1fr)}.wc-champs{grid-template-columns:1fr}.wc-two{grid-template-columns:1fr}.wc-explore{grid-template-columns:repeat(2,1fr)}.wc-meta{display:none}}
@media(max-width:520px){.world-current{padding:10px}.wc-nav a{padding:7px}.wc-subnav{overflow:auto;flex-wrap:nowrap}.wc-subnav a{white-space:nowrap}.wc-hero-copy{padding:20px}.wc-hero h1{font-size:46px}.wc-explore{grid-template-columns:1fr}}
`;

export function Current() {
  return <main className="world-current">
    <style>{styles}</style>
    <header className="wc-top"><div className="wc-brand">TKDL <b>CAREER</b></div><div className="wc-meta"><span>Season 4</span><span>Week 21</span><span>The North Star</span></div><span>Attention · 2</span></header>
    <nav className="wc-nav" aria-label="Career destinations">
      <a href="#home">Home</a><a href="#map"><Map size={14}/>Map</a><a href="#calendar"><CalendarDays size={14}/>Calendar</a><a href="#nights">Nights Out</a><a className="active" href="#world">Darts World</a><a href="#career">My Career</a>
    </nav>
    <nav className="wc-subnav" aria-label="Darts World pages">
      <a href="#rankings">Rankings</a><a href="#players">Players</a><a href="#events">Events &amp; Circuits</a><a href="#venues">Venues</a><a href="#history">History</a>
    </nav>
    <section className="wc-hero">
      <div className="wc-hero-copy"><span className="wc-kicker">THE DARTS WORLD · SEASON 4 / WEEK 21</span><h1>Darts<br/><em>World</em></h1>
        <p>Rankings, the big championships, players and news from your darts world.</p>
        <div className="wc-actions"><a href="#rankings">Rankings &amp; races <ArrowUpRight size={14}/></a><a href="#palace">The Palace World Championship <ChevronRight size={14}/></a></div></div>
      <div className="wc-art" aria-label="Decorative championship dartboard"><div className="wc-target"/><div className="wc-badge">WORLD<br/>CIRCUIT<br/>04</div></div>
      <dl className="wc-stats"><div><small>Published World #1</small><strong>Rook Calder</strong></div><div><small>Last World Champion</small><strong>Mara Vale</strong></div><div><small>Championships ahead</small><strong>04</strong></div><div><small>World news</small><strong>08</strong></div></dl>
    </section>
    <section className="wc-section"><header className="wc-head"><span><Trophy size={16}/> Upcoming Championships</span><a href="#events">All events <ArrowUpRight size={13}/></a></header>
      <div className="wc-champs">{championships.map(event=><article className="wc-champ" key={event.name} style={{"--accent":event.accent} as React.CSSProperties}><small>{event.kind}</small><strong>{event.name}</strong><em><MapPin size={12}/> {event.venue}</em></article>)}</div>
    </section>
    <div className="wc-two">
      <section className="wc-section"><header className="wc-head"><span><Newspaper size={16}/> Around the world</span><a href="#news">Newsroom <ArrowUpRight size={13}/></a></header><ul className="wc-headlines">{headlines.map((story,i)=><li key={story}>{story}<span>W{21-i}</span></li>)}</ul></section>
      <section className="wc-section"><header className="wc-head"><span><Search size={16}/> Explore the world</span><a href="#search">Search <ArrowUpRight size={13}/></a></header>
        <div className="wc-explore">{explore.map(({title,detail,icon:Icon})=><a className="wc-tile" href={`#${title.toLowerCase().replaceAll(" ","-")}`} key={title}><Icon size={19}/><span><strong>{title}</strong><small>{detail}</small></span></a>)}</div>
      </section>
    </div>
    <footer className="wc-foot">Illustrative mock data · no live Career save changed</footer>
  </main>;
}
