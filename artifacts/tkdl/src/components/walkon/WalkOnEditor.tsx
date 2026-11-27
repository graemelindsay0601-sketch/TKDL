import { useState } from "react";
import { WalkOnCard } from "./WalkOnFx";
import { WALKON_COLOURS, WALKON_STYLES, saveWalkOn, type WalkOn, type WalkOnStyle } from "./walkon";

/** Set up your walk-on: nickname, two colours and an entrance, with a live preview. */
export function WalkOnEditor({ name, current, onClose, onSaved }: { name: string; current: WalkOn | null; onClose: () => void; onSaved: (w: WalkOn) => void }) {
  const [nickname, setNickname] = useState(current?.nickname ?? "");
  const [colourA, setA] = useState(current?.colourA ?? "pink");
  const [colourB, setB] = useState(current?.colourB ?? "gold");
  const [style, setStyle] = useState<WalkOnStyle>((current?.style as WalkOnStyle) ?? "spotlights");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { onSaved(await saveWalkOn({ nickname, colourA, colourB, style })); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const swatches = (val: string, set: (k: string) => void) => (
    <div className="wo-swatches">{Object.entries(WALKON_COLOURS).map(([k, c]) => <button key={k} aria-label={c.label} className={val === k ? "on" : ""} style={{ background: c.hex }} onClick={() => set(k)} />)}</div>
  );
  return (
    <div className="wo-sheet" role="dialog" aria-label="Your walk-on">
      <h3>Your walk-on</h3>
      <WalkOnCard name={name} nickname={nickname.trim()} style={style} colourA={colourA} colourB={colourB} />
      <label htmlFor="wo-nick">Nickname</label>
      <input id="wo-nick" type="text" maxLength={24} placeholder="e.g. The Hammer" value={nickname} onChange={e => setNickname(e.target.value)} />
      <label>Main colour</label>{swatches(colourA, setA)}
      <label>Second colour</label>{swatches(colourB, setB)}
      <label>Entrance</label>
      <div className="wo-styles">{WALKON_STYLES.map(s => <button key={s.key} className={style === s.key ? "on" : ""} onClick={() => setStyle(s.key)}><b>{s.label}</b><span>{s.blurb}</span></button>)}</div>
      {err && <div className="wo-err">{err}</div>}
      <div className="wo-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="gold" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save walk-on"}</button></div>
      <small style={{ color: "#8e8aa0", fontSize: 11 }}>Plays on the walk-on screen before your league matches. No sound yet.</small>
    </div>
  );
}
