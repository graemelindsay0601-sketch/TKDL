import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Crown, Map, MapPin, Medal, Newspaper, Shield, Sparkles, Trophy, Users } from "lucide-react";
import type { CSSProperties } from "react";

const championships = [
  { type: "WORLD CHAMPIONSHIP", week: "WEEK 22", name: "The Palace World Championship", venue: "The Palace · London", code: "01", color: "#d6b65d" },
  { type: "MAJOR", week: "WEEK 26", name: "Northern Masters", venue: "Civic Arena · Leeds", code: "02", color: "#c6535a" },
  { type: "FEATURED", week: "WEEK 31", name: "European Open", venue: "Rhein Forum · Cologne", code: "03", color: "#7195a6" },
  { type: "MAJOR", week: "WEEK 34", name: "The Crown Invitational", venue: "Foundry Hall · Bristol", code: "04", color: "#a99061" },
];

const news = [
  { index: "01", category: "RANKINGS", title: "Rook Calder keeps his grip on the summit", detail: "A composed spring run leaves the world number one clear at the top.", week: "WEEK 21" },
  { index: "02", category: "CHAMPIONSHIP", title: "Mara Vale returns to the Palace as defending champion", detail: "The reigning world champion is set for a title defence under the capital lights.", week: "WEEK 20" },
  { index: "03", category: "CIRCUIT", title: "Three new venues join the European swing", detail: "The travelling tour adds fresh stages across the continent this season.", week: "WEEK 19" },
  { index: "04", category: "PLAYERS", title: "Ivo Mercer makes a late charge into the seeded places", detail: "A run of steady floor-event finishes puts the fictional contender in range of a major seed.", week: "WEEK 18" },
];

const destinations = [
  { title: "Newsroom", sub: "Stories from your Career", icon: Newspaper, href: "#newsroom", number: "01", tone: "red" },
  { title: "Players", sub: "Every saved player", icon: Users, href: "#players", number: "02", tone: "blue" },
  { title: "Rivalries & H2H", sub: "Your played meetings", icon: Shield, href: "#rivalries", number: "03", tone: "gold" },
  { title: "Events & Circuits", sub: "Every championship family", icon: Trophy, href: "#events", number: "04", tone: "red" },
  { title: "Venues", sub: "The world venue atlas", icon: MapPin, href: "#venues", number: "05", tone: "blue" },
  { title: "History", sub: "Champions & past seasons", icon: Crown, href: "#history", number: "06", tone: "gold" },
  { title: "Records Book", sub: "Nine-darters & best performances", icon: Medal, href: "#records", number: "07", tone: "red" },
];

const styles = `
.dw{--ink:#e9e4d8;--muted:#a1a6aa;--line:#34404a;--navy:#0b1420;--panel:#111e2b;--gold:#d5b65d;--red:#b83d4b;min-height:100vh;background:radial-gradient(ellipse at 50% -22%,#263448 0,#101a28 38%,#09111c 74%);color:var(--ink);font-family:'DM Sans',sans-serif;overflow:hidden}
.dw *{box-sizing:border-box}.dw a{color:inherit;text-decoration:none}.dw-shell{max-width:1440px;margin:0 auto;padding:20px 42px 48px}
.dw-mast{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 19px;border:1px solid #35414c;background:linear-gradient(180deg,#1b2938,#121d2a);box-shadow:0 5px 0 #070d14,0 10px 20px #050a10;border-radius:7px}
.dw-brand{display:flex;align-items:center;gap:12px;font:700 18px/1 'Oswald',sans-serif;letter-spacing:.1em}.dw-mark{display:grid;place-items:center;width:30px;height:30px;background:linear-gradient(140deg,#d8bc6a,#a27d36);clip-path:polygon(50% 0,94% 24%,94% 76%,50% 100%,6% 76%,6% 24%);color:#151c22;font:800 15px 'Oswald',sans-serif}.dw-brand span:last-child{color:#e9e1d1}.dw-brand b{color:var(--gold);font-weight:700}
.dw-season{display:flex;align-items:center;gap:22px;color:#9faab4;font-size:10px;letter-spacing:.15em;text-transform:uppercase}.dw-season strong{color:#e4d9b5;font-weight:700}.dw-alert{display:flex;gap:8px;align-items:center;color:#d7c681;font-size:11px}.dw-alert i{width:7px;height:7px;background:#bd4c56;border-radius:50%;box-shadow:0 0 0 3px #bd4c562e}
.dw-mainnav{display:flex;align-items:stretch;gap:4px;margin-top:12px;padding:4px;border-bottom:1px solid #394450;background:#101b28}.dw-mainnav a{display:flex;align-items:center;gap:8px;padding:11px 16px;color:#aab4be;font-size:12px;font-weight:600;transition:color .2s,background .2s}.dw-mainnav a:hover{color:#f0e7d5;background:#223041}.dw-mainnav a.is-active{color:#f1d77e;background:linear-gradient(180deg,#362d25,#27231f);box-shadow:inset 0 -2px var(--gold)}
.dw-subnav{display:flex;align-items:center;gap:21px;padding:11px 17px;border-bottom:1px solid #273542;color:#8794a0;font-size:10px;letter-spacing:.11em;text-transform:uppercase}.dw-subnav a{transition:color .2s}.dw-subnav a:hover{color:var(--gold)}.dw-subnav .sub-current{color:#e5c66d}
.dw-hero{position:relative;isolation:isolate;display:grid;grid-template-columns:1.1fr .9fr;min-height:420px;margin-top:21px;overflow:hidden;border:1px solid #796743;border-radius:4px;background:linear-gradient(110deg,#182738 0%,#152334 46%,#101a27 100%);box-shadow:0 9px 0 #080f17,0 16px 30px #0007,inset 0 1px #ffffff24}
.dw-hero:before{position:absolute;z-index:-1;content:"";inset:0;background:linear-gradient(90deg,transparent 47%,#0b14201a 58%,#09121bc9 100%),repeating-linear-gradient(0deg,transparent 0 44px,#ffffff05 45px 46px)}
.dw-hero-copy{align-self:center;padding:44px 30px 58px 49px;z-index:2}.dw-kicker{display:flex;align-items:center;gap:10px;color:#d9bd69;font:700 10px 'Oswald',sans-serif;letter-spacing:.22em;text-transform:uppercase}.dw-kicker:before{content:"";width:25px;height:2px;background:#ba424d}
.dw-title{margin:21px 0 15px;font:700 clamp(58px,7vw,94px)/.78 'Oswald',sans-serif;letter-spacing:-.025em;text-transform:uppercase;text-shadow:0 3px 0 #0b1016}.dw-title em{display:block;margin-top:14px;color:#d9bd69;font-style:normal}.dw-description{max-width:420px;margin:24px 0 0;color:#b5c0c8;font-size:15px;line-height:1.7}
.dw-hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}.dw-btn{display:inline-flex;align-items:center;gap:11px;min-height:42px;padding:0 16px;background:linear-gradient(#e0c674,#b18d43);color:#161d25!important;font-size:11px;font-weight:800;letter-spacing:.04em;border:1px solid #f0d78e;box-shadow:0 4px 0 #665126,0 8px 14px #0004;transition:transform .18s,box-shadow .18s}.dw-btn:hover{transform:translateY(-2px);box-shadow:0 6px 0 #665126,0 10px 16px #0005}.dw-btn--ghost{background:linear-gradient(#1b2a3a,#142130);border-color:#637283;color:#e4e8e8!important;box-shadow:0 4px 0 #0b1219,0 8px 14px #0004}.dw-btn--ghost:hover{box-shadow:0 6px 0 #0b1219,0 10px 16px #0005}
.dw-arena{position:relative;min-height:420px;overflow:hidden;display:grid;place-items:center;perspective:900px}.dw-arena-floor{position:absolute;left:5%;right:-8%;bottom:-33%;height:73%;transform:rotateX(65deg);transform-origin:center top;background:repeating-linear-gradient(90deg,#ac8e473c 0 1px,transparent 1px 55px),repeating-linear-gradient(0deg,#a9b0b626 0 1px,transparent 1px 55px),linear-gradient(155deg,#1d2a37,#0a111a 70%);border:1px solid #776341;box-shadow:0 -16px 0 #1a2633,0 -20px 0 #786546}
.dw-arena-stands{position:absolute;inset:0 0 37%;background:repeating-linear-gradient(0deg,transparent 0 19px,#aab7c00b 20px 21px),linear-gradient(180deg,#0a121e 0%,#182431 68%,#253340 100%);clip-path:polygon(0 0,100% 0,100% 100%,55% 79%,0 100%)}
.dw-light{position:absolute;top:2%;width:42%;height:67%;opacity:.3;clip-path:polygon(47% 0,53% 0,100% 100%,0 100%);background:linear-gradient(180deg,#d9c58155,transparent)}.dw-light--left{left:1%;transform:rotate(8deg)}.dw-light--right{right:0;transform:rotate(-9deg)}
.dw-board-rig{position:relative;z-index:1;width:min(58%,280px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#526070,#1c2936 48%,#080f18);border:9px solid #263340;box-shadow:0 10px 0 #111a24,0 21px 24px #0009,inset 2px 3px #ffffff31,inset -5px -8px 13px #0009;transform:translateY(-6px) rotate(-8deg)}
.dw-board{position:relative;width:84%;aspect-ratio:1;border-radius:50%;border:4px solid #c6a75a;background:repeating-conic-gradient(from -6deg,#bd444d 0deg 1deg,#111a22 1deg 18deg,#c9b888 18deg 19deg,#15212b 19deg 36deg);box-shadow:inset 0 0 0 2px #131c24,inset 0 0 0 15px #19232e,inset 0 0 0 18px #d4b75f,inset 0 0 0 21px #15212b,inset 0 0 0 43px #18232d,inset 0 0 0 47px #bd444d,inset 0 0 0 50px #131d27,inset 0 0 0 72px #d0b15b,inset 0 0 0 76px #17222c,inset 0 0 0 98px #c7a653,inset 0 0 0 102px #111a23}.dw-board:before,.dw-board:after{position:absolute;content:"";background:#d9bc6d;opacity:.8}.dw-board:before{width:1px;height:100%;left:50%;top:0}.dw-board:after{height:1px;width:100%;top:50%;left:0}
.dw-board-core{position:absolute;z-index:2;left:50%;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);background:#cf4350;border:2px solid #e7cf81;box-shadow:0 0 0 4px #14202b}
.dw-circuit-tag{position:absolute;z-index:3;right:7%;bottom:17%;display:grid;place-items:center;width:108px;height:112px;background:linear-gradient(145deg,#b94451,#6f2635);clip-path:polygon(50% 0,94% 19%,90% 77%,50% 100%,10% 77%,6% 19%);border:0;color:#f3df9c;text-align:center;font:700 12px/1.15 'Oswald',sans-serif;letter-spacing:.14em;text-shadow:0 1px 0 #55202a;filter:drop-shadow(5px 7px 0 #070d13)}.dw-circuit-tag b{font-size:27px;line-height:1;color:#f1d77e}
.dw-hero-caption{position:absolute;right:24px;top:22px;display:flex;align-items:center;gap:8px;color:#a9b2bb;font:700 9px 'Oswald',sans-serif;letter-spacing:.18em;text-transform:uppercase;writing-mode:vertical-rl}
.dw-stats{position:relative;z-index:4;grid-column:1/-1;display:grid;grid-template-columns:1.2fr 1.2fr .8fr .8fr;margin:-38px 20px 0;background:linear-gradient(180deg,#202e3c,#121e2a);border:1px solid #5a5746;box-shadow:0 5px 0 #080f17,0 12px 20px #0006}.dw-stat{min-height:77px;padding:15px 19px;border-right:1px solid #ffffff17}.dw-stat:last-child{border:0}.dw-stat small{display:block;margin-bottom:6px;color:#95a0a8;font-size:9px;letter-spacing:.14em;text-transform:uppercase}.dw-stat strong{display:block;color:#f1e6c7;font:700 21px/1.1 'Oswald',sans-serif}.dw-stat:first-child strong{color:#e0c36c}.dw-stat .dw-count{font-size:25px;color:#d6b65d}
.dw-section{margin-top:29px}.dw-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:12px}.dw-section-title{display:flex;align-items:center;gap:10px;margin:0;color:#ece6d8;font:700 22px 'Oswald',sans-serif;letter-spacing:.045em;text-transform:uppercase}.dw-section-title svg{color:var(--gold)}.dw-section-kicker{display:block;margin-bottom:4px;color:#82909c;font-size:9px;letter-spacing:.17em;text-transform:uppercase}.dw-section-link{display:flex;align-items:center;gap:8px;color:#d7bc6b!important;font-size:11px;font-weight:700}.dw-section-link:hover{color:#f1d87f!important}
.dw-championships{display:grid;grid-template-columns:1.28fr 1fr 1fr;gap:13px}.dw-event{--event:#d5b65d;position:relative;isolation:isolate;min-height:185px;display:flex;align-items:flex-end;overflow:hidden;padding:18px;border:1px solid #46515b;background:linear-gradient(155deg,#293847,#121d28 75%);box-shadow:0 4px 0 #080f17,0 10px 20px #0005,inset 0 1px #ffffff1e;transition:transform .2s,border-color .2s}.dw-event:hover{transform:translateY(-3px);border-color:var(--event)}.dw-event:before{position:absolute;z-index:-1;inset:0;content:"";background:linear-gradient(0deg,#0b1119 1%,#0b1119de 24%,transparent 78%),radial-gradient(ellipse at 72% 20%,color-mix(in srgb,var(--event) 28%,transparent),transparent 55%)}.dw-event--wide{min-height:224px}.dw-event-art{position:absolute;z-index:-1;right:4%;top:4%;width:46%;height:88%;opacity:.68}.dw-event-art:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 10px,#d8c17a22 11px 12px),linear-gradient(160deg,transparent 40%,#0b111c 100%);clip-path:polygon(8% 0,92% 0,100% 100%,0 100%)}.dw-event-art:after{content:"";position:absolute;left:25%;top:17%;width:52%;height:51%;border:1px solid color-mix(in srgb,var(--event) 85%,transparent);border-radius:50%;box-shadow:0 0 0 10px #0c1521,0 0 0 11px color-mix(in srgb,var(--event) 70%,transparent),0 0 0 23px #0c1521,0 0 0 24px color-mix(in srgb,var(--event) 45%,transparent),0 0 0 36px #0c1521,0 0 0 37px color-mix(in srgb,var(--event) 35%,transparent)}.dw-event-code{position:absolute;right:15px;top:8px;color:#ffffff16;font:700 98px/.9 'Oswald',sans-serif}.dw-event-copy{position:relative;max-width:90%}.dw-event-top{display:flex;align-items:center;gap:8px;color:var(--event);font:700 9px 'Oswald',sans-serif;letter-spacing:.16em}.dw-event-top i{width:4px;height:4px;border-radius:50%;background:var(--event)}.dw-event h3{margin:9px 0;color:#f0e9da;font:700 25px/1.05 'Oswald',sans-serif}.dw-event:not(.dw-event--wide) h3{font-size:20px}.dw-event-meta{display:flex;align-items:center;gap:6px;color:#adb6bc;font-size:10px}.dw-event-meta svg{color:var(--event)}.dw-event-status{position:absolute;right:14px;bottom:15px;color:#abb5bc;font:700 8px 'Oswald',sans-serif;letter-spacing:.12em;text-transform:uppercase}
.dw-lower{display:grid;grid-template-columns:1fr 1.1fr;gap:24px;margin-top:32px}.dw-news-panel,.dw-explore-panel{position:relative;border:1px solid #364451;background:linear-gradient(155deg,#182635,#101a26);box-shadow:0 5px 0 #080f17,0 13px 24px #0005}.dw-panel-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #ffffff18}.dw-panel-head .dw-section-title{font-size:17px}.dw-head-rule{height:1px;flex:1;margin:0 16px;background:linear-gradient(90deg,#766340,transparent)}.dw-news-list{list-style:none;margin:0;padding:0 18px}.dw-news-item{display:grid;grid-template-columns:34px 1fr auto;gap:12px;align-items:start;padding:16px 0;border-bottom:1px solid #ffffff14}.dw-news-item:last-child{border:0}.dw-news-index{color:#7e8993;font:700 14px 'Oswald',sans-serif}.dw-news-category{display:block;margin-bottom:5px;color:#d7ba64;font:700 8px 'Oswald',sans-serif;letter-spacing:.15em}.dw-news-item h3{margin:0;color:#e9e5dc;font:600 14px/1.35 'DM Sans',sans-serif}.dw-news-item p{margin:5px 0 0;color:#9aa5ae;font-size:10px;line-height:1.5}.dw-news-week{color:#81909b;font:700 8px 'Oswald',sans-serif;letter-spacing:.1em;white-space:nowrap}
.dw-destinations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:13px}.dw-destination{--tone:#d3b45c;position:relative;min-height:73px;display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #3b4956;background:linear-gradient(140deg,#1b2b3a,#131f2b);box-shadow:inset 0 1px #ffffff12,0 3px 0 #0a121a;transition:transform .18s,border-color .18s,background .18s}.dw-destination:hover{transform:translateY(-2px);border-color:var(--tone);background:linear-gradient(140deg,#263847,#182534)}.dw-destination-icon{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;color:var(--tone);background:linear-gradient(145deg,#344451,#1b2936);border:1px solid #58626a;box-shadow:0 2px 0 #090f15}.dw-destination-copy{min-width:0}.dw-destination strong{display:block;color:#ece7dd;font:700 14px 'Oswald',sans-serif}.dw-destination small{display:block;margin-top:3px;color:#96a2ab;font-size:9px;line-height:1.35}.dw-destination-num{position:absolute;right:9px;top:7px;color:#82909b70;font:700 9px 'Oswald',sans-serif}.dw-destination-arrow{margin-left:auto;color:#7d8a94;flex-shrink:0}
.dw-footer{display:flex;justify-content:space-between;gap:16px;padding:21px 2px 0;margin-top:24px;border-top:1px solid #293642;color:#77848e;font-size:9px;letter-spacing:.1em;text-transform:uppercase}.dw-footer span:last-child{color:#9f8b55}
@media(max-width:920px){.dw-shell{padding:16px 22px 38px}.dw-hero{grid-template-columns:1fr .85fr}.dw-hero-copy{padding-left:31px}.dw-stats{grid-template-columns:repeat(4,1fr);margin-left:14px;margin-right:14px}.dw-stat{padding:13px 12px}.dw-stat strong{font-size:17px}.dw-lower{gap:16px}.dw-destinations{gap:7px;padding:10px}.dw-destination{padding:10px;gap:9px}.dw-destination-icon{width:32px;height:32px;flex-basis:32px}}
@media(max-width:700px){.dw-shell{padding:10px 12px 28px}.dw-mast{height:52px;padding:0 12px}.dw-season{display:none}.dw-mainnav{overflow:auto;scrollbar-width:none;gap:1px}.dw-mainnav::-webkit-scrollbar,.dw-subnav::-webkit-scrollbar{display:none}.dw-mainnav a{flex:0 0 auto;padding:10px 12px;font-size:11px}.dw-subnav{overflow:auto;white-space:nowrap;gap:18px;padding:10px 12px}.dw-hero{grid-template-columns:1fr;min-height:0;margin-top:14px}.dw-hero-copy{padding:31px 23px 18px}.dw-title{font-size:68px}.dw-description{margin-top:19px;font-size:13px}.dw-hero-actions{gap:10px;margin-top:20px}.dw-btn{font-size:10px;padding:0 12px}.dw-arena{min-height:245px}.dw-arena-floor{bottom:-55%;height:95%}.dw-board-rig{width:170px}.dw-circuit-tag{width:80px;height:84px;right:10%;bottom:12%;font-size:9px}.dw-circuit-tag b{font-size:21px}.dw-hero-caption{right:12px;top:12px}.dw-stats{grid-template-columns:repeat(2,1fr);margin:-10px 12px 14px}.dw-stat{min-height:68px;padding:12px;border-bottom:1px solid #ffffff17}.dw-stat:nth-child(2){border-right:0}.dw-stat:nth-child(3),.dw-stat:nth-child(4){border-bottom:0}.dw-stat strong{font-size:18px}.dw-section{margin-top:23px}.dw-section-title{font-size:18px}.dw-section-heading{align-items:center}.dw-championships{grid-template-columns:1fr;gap:9px}.dw-event,.dw-event--wide{min-height:170px;padding:15px}.dw-event--wide{min-height:190px}.dw-event-status{display:none}.dw-event h3{font-size:20px}.dw-event:not(.dw-event--wide) h3{font-size:19px}.dw-event-code{font-size:74px}.dw-lower{grid-template-columns:1fr;gap:18px;margin-top:24px}.dw-panel-head{padding:13px}.dw-news-list{padding:0 13px}.dw-news-item{grid-template-columns:27px 1fr auto;gap:8px;padding:14px 0}.dw-news-item h3{font-size:12px}.dw-news-item p{font-size:9px}.dw-destination{min-height:68px}.dw-footer{flex-direction:column;gap:7px;font-size:8px}}
@media(max-width:390px){.dw-hero-actions{flex-direction:column;align-items:stretch}.dw-btn{justify-content:space-between}.dw-destinations{grid-template-columns:1fr}.dw-news-week{font-size:7px}}
`;

function SectionHeading({ eyebrow, title, href, label, icon: Icon }: { eyebrow: string; title: string; href: string; label: string; icon: typeof Trophy }) {
  return <div className="dw-section-heading"><div><span className="dw-section-kicker">{eyebrow}</span><h2 className="dw-section-title"><Icon size={17} strokeWidth={1.8} />{title}</h2></div><a className="dw-section-link" href={href}>{label}<ArrowUpRight size={14} /></a></div>;
}

export function Redesign() {
  return (
    <main className="dw">
      <style>{styles}</style>
      <div className="dw-shell">
        <header className="dw-mast">
          <div className="dw-brand"><span className="dw-mark">T</span><span>TKDL <b>CAREER</b></span></div>
          <div className="dw-season"><span>Illustrative season <strong>04</strong></span><span>Week <strong>21</strong></span><span>The North Star</span></div>
          <div className="dw-alert"><i /> Attention · 2</div>
        </header>
        <nav className="dw-mainnav" aria-label="Career destinations">
          <a id="home" href="#home">Home</a>
          <a id="map" href="#map"><Map size={14} />Map</a>
          <a id="calendar" href="#calendar"><CalendarDays size={14} />Calendar</a>
          <a id="nights" href="#nights">Nights Out</a>
          <a className="is-active" href="#darts-world">Darts World</a>
          <a id="my-career" href="#my-career">My Career</a>
        </nav>
        <nav className="dw-subnav" aria-label="Darts World destinations">
          <a className="sub-current" id="rankings" href="#rankings">Rankings</a>
          <a href="#players">Players</a>
          <a href="#events">Events &amp; Circuits</a>
          <a id="venues-nav" href="#venues">Venues</a>
          <a id="history-nav" href="#history">History</a>
          <a id="records-nav" href="#records">Records Book</a>
        </nav>

        <section className="dw-hero" id="darts-world">
          <div className="dw-hero-copy">
            <span className="dw-kicker">The darts world · season 04 / week 21</span>
            <h1 className="dw-title">Darts <em>World</em></h1>
            <p className="dw-description">Every ranking, championship and great name in the circuit. Step inside the world your Career is shaping.</p>
            <div className="dw-hero-actions">
              <a className="dw-btn" href="#rankings">Rankings &amp; races <ArrowRight size={15} /></a>
              <a className="dw-btn dw-btn--ghost" href="#palace">The Palace World Championship <ChevronRight size={15} /></a>
            </div>
          </div>
          <div className="dw-arena" aria-label="Illustrated championship darts arena">
            <div className="dw-arena-stands" />
            <div className="dw-light dw-light--left" />
            <div className="dw-light dw-light--right" />
            <div className="dw-arena-floor" />
            <div className="dw-board-rig"><div className="dw-board"><i className="dw-board-core" /></div></div>
            <div className="dw-circuit-tag">WORLD<br />CIRCUIT<br /><b>04</b></div>
            <div className="dw-hero-caption">The stage is set · the season is alive</div>
          </div>
          <div className="dw-stats">
            <div className="dw-stat"><small>Published World #1</small><strong>Rook Calder</strong></div>
            <div className="dw-stat"><small>Last World Champion</small><strong>Mara Vale</strong></div>
            <div className="dw-stat"><small>Championships ahead</small><strong className="dw-count">04</strong></div>
            <div className="dw-stat"><small>World news</small><strong className="dw-count">08</strong></div>
          </div>
        </section>

        <section className="dw-section" id="events">
          <SectionHeading eyebrow="The next nights that matter" title="Upcoming Championships" href="#events" label="All events" icon={Trophy} />
          <div className="dw-championships">
            {championships.map((event, i) => (
              <a id={i === 0 ? "palace" : undefined} href="#events" className={`dw-event${i === 0 ? " dw-event--wide" : ""}`} key={event.code} style={{ "--event": event.color } as CSSProperties}>
                <div className="dw-event-art" />
                <span className="dw-event-code">{event.code}</span>
                <div className="dw-event-copy">
                  <div className="dw-event-top"><span>{event.type}</span><i />{event.week}</div>
                  <h3>{event.name}</h3>
                  <div className="dw-event-meta"><MapPin size={12} />{event.venue}</div>
                </div>
                <span className="dw-event-status">Season preview</span>
              </a>
            ))}
          </div>
        </section>

        <div className="dw-lower">
          <section className="dw-news-panel" id="newsroom">
            <header className="dw-panel-head">
              <h2 className="dw-section-title"><Newspaper size={16} />Around the world</h2><span className="dw-head-rule" />
              <a className="dw-section-link" href="#newsroom">Newsroom <ArrowUpRight size={14} /></a>
            </header>
            <ul className="dw-news-list">
              {news.map(story => <li className="dw-news-item" key={story.index}>
                <span className="dw-news-index">{story.index}</span>
                <div><span className="dw-news-category">{story.category}</span><h3>{story.title}</h3><p>{story.detail}</p></div>
                <span className="dw-news-week">{story.week}</span>
              </li>)}
            </ul>
          </section>
          <section className="dw-explore-panel">
            <header className="dw-panel-head">
              <h2 className="dw-section-title"><Sparkles size={16} />Explore the world</h2><span className="dw-head-rule" />
              <a className="dw-section-link" href="#world-directory">All destinations <ArrowUpRight size={14} /></a>
            </header>
            <nav className="dw-destinations" id="world-directory" aria-label="Explore the darts world">
              {destinations.map(({ title, sub, icon: Icon, href, number, tone }) => (
                <a className={`dw-destination dw-destination--${tone}`} href={href} id={title === "Players" ? "players" : title === "Rivalries & H2H" ? "rivalries" : title === "Venues" ? "venues" : title === "History" ? "history" : title === "Records Book" ? "records" : undefined} key={title} style={{ "--tone": tone === "red" ? "#c6535a" : tone === "blue" ? "#81a9b8" : "#d5b65d" } as CSSProperties}>
                  <span className="dw-destination-icon"><Icon size={17} strokeWidth={1.8} /></span>
                  <span className="dw-destination-copy"><strong>{title}</strong><small>{sub}</small></span>
                  <span className="dw-destination-num">{number}</span><ArrowDownRight className="dw-destination-arrow" size={14} />
                </a>
              ))}
            </nav>
          </section>
        </div>
        <footer className="dw-footer"><span>Illustrative season and sample circuit values · no Career save changed</span><span>TKDL Career · Darts World</span></footer>
      </div>
    </main>
  );
}
