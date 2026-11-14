import { useState } from "react";
import { Globe2, Shield, Sparkles, Star, UserMinus, Users } from "lucide-react";
import { errorMessage, useNameEmote, useSetRegularRole, type StreamingView } from "../api";
import "./stream-community.css";

const REGIONS: Record<string, string> = { UK: "United Kingdom", IE: "Ireland", NL: "Netherlands", DE: "Germany", BE: "Belgium", AU: "Australia" };
const RELATIONSHIP: Record<string, string> = { NEW: "Not met yet", KNOWN: "Know each other", FRIEND: "Friends", BESTIE: "Best mates", RIVAL: "Friendly rival ⚔️" };

/** Your community: the regulars who keep coming back, and the mods and VIPs you trust with the room. */
export function CommunitySection({ saveId, d, retired }: { saveId: string; d: StreamingView; retired: boolean }) {
  const role = useSetRegularRole(saveId), [message, setMessage] = useState("");
  const c = d.community;
  if (!c) return null;
  const set = (key: string, next: "NONE" | "MOD" | "VIP") => role.mutate({ key, role: next }, { onSuccess: () => setMessage(""), onError: e => setMessage(errorMessage(e)) });
  return <section className="sc-panel" id="community" aria-labelledby="community-title">
    <div className="sc-head">
      <div><span className="sc-eyebrow">YOUR COMMUNITY</span><h2 id="community-title">The regulars</h2>
        <p>Viewers who come back show after show. Each has their own personality in chat. They grow loyal when they catch your streams and drift away if you go quiet for weeks.</p></div>
      <div className="sc-stats">
        <span><Users aria-hidden /> <span><b>{c.size}</b> of {c.target} regulars</span></span>
        {c.modSlots > 0 && <span><Shield aria-hidden /> <span><b>{c.mods}</b>/{c.modSlots} mods</span></span>}
        {c.vipSlots > 0 && <span><Star aria-hidden /> <span><b>{c.vips}</b>/{c.vipSlots} VIPs</span></span>}
        {c.viewerBonusPercent > 0 && <span className="sc-good">+{c.viewerBonusPercent}% opening viewers</span>}
      </div>
    </div>
    {c.members.length === 0 ? <p className="sc-empty">No regulars yet. Go live and the first faces will start coming back.</p> :
      <ul className="sc-regulars">{c.members.map(m => <li key={m.key} className="sc-regular" data-role={m.role}>
        <span className="sc-avatar" aria-hidden>{m.emoji}</span>
        <div className="sc-who">
          <b>{m.name}{m.role !== "NONE" && <i className="sc-badge" data-role={m.role}>{m.role === "MOD" ? "MOD" : "VIP"}</i>}</b>
          <small>{m.personaName} · {m.streams} show{m.streams === 1 ? "" : "s"} · since S{m.joinedSeason} wk {m.joinedWeek}{m.subMonths !== null && m.subMonths !== undefined ? ` · subbed ${m.subMonths} month${m.subMonths === 1 ? "" : "s"}` : ""}</small>
          <span className="sc-loyalty" role="meter" aria-label={`${m.name}'s loyalty`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.loyalty}><span style={{ width: `${m.loyalty}%` }} /></span>
        </div>
        {!retired && <div className="sc-actions">
          {m.role !== "NONE" ? <button type="button" disabled={role.isPending} onClick={() => set(m.key, "NONE")}><UserMinus aria-hidden /> Remove {m.role === "MOD" ? "mod" : "VIP"}</button> : <>
            {m.canMod && <button type="button" disabled={role.isPending} onClick={() => set(m.key, "MOD")}><Shield aria-hidden /> Make mod</button>}
            {m.canVip && <button type="button" disabled={role.isPending} onClick={() => set(m.key, "VIP")}><Star aria-hidden /> Make VIP</button>}
          </>}
        </div>}
      </li>)}</ul>}
    <p className="sc-note">{c.modSlots === 0 ? "Moderators and VIPs open up at Affiliate." :
      `Mods need ${c.modLoyalty} loyalty and keep more of the audience watching (+3% each). VIPs need ${c.vipLoyalty} and get a badge in chat. Slots grow with your tier.`}</p>
    <EmoteSlots saveId={saveId} d={d} retired={retired} />
    {c.recentlyLeft.length > 0 && <p className="sc-note">Drifted away: {c.recentlyLeft.map(r => r.name).join(", ")}. Stream regularly to keep people coming back.</p>}
    {message && <p className="sc-error" role="alert">{message}</p>}
  </section>;
}

/** The wider DartCast scene: every creator, by region, and how well you know them. */
export function SceneSection({ d }: { d: StreamingView }) {
  const [region, setRegion] = useState<string>("ALL"), [all, setAll] = useState(false);
  if (!d.scene) return null;
  const regions = [...new Set(d.scene.creators.map(c => c.region))];
  const shown = d.scene.creators.filter(c => region === "ALL" || c.region === region);
  return <section className="sc-panel" id="scene" aria-labelledby="scene-title">
    <div className="sc-head">
      <div><span className="sc-eyebrow">THE SCENE</span><h2 id="scene-title">DartCast creators</h2>
        <p>{d.scene.creators.length} channels across {regions.length} countries. New faces debut each season, and a few legends hang up the headset.</p></div>
      {(d.scene.rookies.length > 0 || d.scene.retired.length > 0) && <div className="sc-news">
        {d.scene.rookies.length > 0 && <span><Sparkles aria-hidden /> New this season: {d.scene.rookies.join(", ")}</span>}
        {d.scene.retired.length > 0 && <span>Retired: {d.scene.retired.join(", ")}</span>}
      </div>}
    </div>
    <div className="sc-filters" role="radiogroup" aria-label="Region">
      {["ALL", ...regions].map(r => <button type="button" key={r} role="radio" aria-checked={region === r} onClick={() => setRegion(r)}>{r === "ALL" ? <><Globe2 aria-hidden /> All</> : REGIONS[r] ?? r}</button>)}
    </div>
    <ul className="sc-scene">{shown.slice(0, all ? undefined : 8).map(c => <li key={c.key} className="sc-creator" data-rel={c.relationship}>
      <div className="sc-creator-top"><b>{c.handle}</b>{c.rookie && <i className="sc-rookie">ROOKIE</i>}</div>
      <small>{REGIONS[c.region] ?? c.region} · {c.style} · {c.followers.toLocaleString("en-GB")} followers · avg {c.avg}</small>
      <p>{c.blurb}</p>
      <q>{c.catchphrase}</q>
      <span className="sc-rel">{RELATIONSHIP[c.relationship]}{c.collabs > 0 ? ` · ${c.collabs} collab${c.collabs === 1 ? "" : "s"}` : ""}{c.raidsOut ? ` · raided ${c.raidsOut}×` : ""}{c.raidsIn ? ` · raided you ${c.raidsIn}×` : ""}{c.cupMeetings ? ` · met in ${c.cupMeetings} cup${c.cupMeetings === 1 ? "" : "s"}` : ""}</span>
    </li>)}</ul>
    {shown.length > 8 && <button type="button" className="sc-more" onClick={() => setAll(v => !v)}>{all ? "Show fewer" : `Show all ${shown.length} creators`}</button>}
  </section>;
}

/** Channel emotes: a slot opens at each sub count; name them and chat spams them on your big moments. */
function EmoteSlots({ saveId, d, retired }: { saveId: string; d: StreamingView; retired: boolean }) {
  const name = useNameEmote(saveId), [draft, setDraft] = useState<Record<number, string>>({}), [message, setMessage] = useState("");
  if (!d.emotes) return null;
  const save = (slot: number) => name.mutate({ slot, name: (draft[slot] ?? "").trim() }, {
    onSuccess: () => { setMessage(""); setDraft(x => ({ ...x, [slot]: "" })); }, onError: e => setMessage(errorMessage(e)) });
  return <div className="sc-emotes">
    <h3>Channel emotes <small>chat types them as <code>{d.emotes.prefix}Name</code></small></h3>
    <ul>{d.emotes.slots.map((slot, i) => ({ slot, i })).filter(({ slot, i }) => slot.unlocked || i === d.emotes.slots.findIndex(x => !x.unlocked)).map(({ slot, i }) => <li key={slot.threshold} data-unlocked={slot.unlocked || undefined}>
      <span className="sc-emote-face" aria-hidden>{slot.code ? slot.code.slice(d.emotes.prefix.length, d.emotes.prefix.length + 2) : "🔒"}</span>
      <div><b>{slot.code ?? (slot.unlocked ? "Unnamed" : "Locked")}</b><small>{slot.threshold.toLocaleString("en-GB")} subscribers</small></div>
      {slot.unlocked && !retired && <form onSubmit={e => { e.preventDefault(); save(i); }}>
        <input aria-label={`Name emote ${i + 1}`} value={draft[i] ?? ""} maxLength={12} placeholder={slot.name ? "Rename" : "Name it"} onChange={e => setDraft(x => ({ ...x, [i]: e.target.value.replace(/[^A-Za-z0-9]/g, "") }))} />
        <button type="submit" disabled={name.isPending || (draft[i] ?? "").length < 2}>Save</button>
      </form>}
    </li>)}</ul>
    {d.emotes.slots.filter(x => !x.unlocked).length > 1 && <p className="sc-note">More slots at {d.emotes.slots.filter(x => !x.unlocked).slice(1).map(x => x.threshold.toLocaleString("en-GB")).join(", ")} subscribers.</p>}
    {message && <p className="sc-error" role="alert">{message}</p>}
  </div>;
}
