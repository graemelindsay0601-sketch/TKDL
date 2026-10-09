import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Archive, Crown, Plus, Star } from "lucide-react";
import { useCareerSaves, useSaveLifecycle, saveInitialShirt, errorMessage, errorStatus } from "../api";
import {CareerShirt,type ShirtIdentity} from "../identity";
import {CareerKitCustomizer} from "../kit-customizer";
import { slotLines, ageOnDate, careerStartDateForToday, HOME_REGIONS, MINIMUM_CAREER_START_AGE } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, ConfirmButton, Label, OSWALD, StatusBadge } from "../components";
import type { CareerSave } from "../types";

/**
 * Career entry: the three A1 slots plus the retired archive. Lifecycle actions are
 * exactly A1's (create / restart / retire / delete); destructive ones need a second
 * confirmation. Nothing here touches the league profile, coins, M501 or Classic Tour.
 */
export function SavesPage() {
  const saves = useCareerSaves();
  const life = useSaveLifecycle();
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const status = errorStatus(saves.error);

  return (
    <div className="career-root space-y-4 pb-10">
      <header className="pdc-card px-4 py-4 md:px-6 md:py-5">
        <div className="flex items-center gap-2 mb-1"><Crown className="w-3.5 h-3.5" style={{ color: "#ff005c" }} aria-hidden /><Label color="#ff005c">TKDL Career</Label></div>
        <h1 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: "clamp(1.6rem, 5vw, 2.4rem)", color: "#fff" }}>Your Career saves</h1>
        <p className="text-sm mt-2 max-w-xl" style={{ color: "rgba(255,255,255,0.7)" }}>
          A persistent darts career: real calendar, real rankings, Tour Cards and money. Three slots, separate from the{" "}
          <Link href="/tour" className="underline decoration-dotted" style={{ color: "#ffd24a" }}>Classic Tour / Trophy Hunt</Link>.
        </p>
      </header>

      {error && <div role="alert" className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff8fb4" }}>{error}</div>}

      {saves.isLoading ? <CareerLoading label="Loading saves" /> : status === 401 ? (
        <div className="pdc-card"><CareerEmptyState title="Sign in to play Career">Career saves belong to your TKDL account. <Link href="/login" className="underline">Sign in</Link></CareerEmptyState></div>
      ) : status === 404 ? (
        <div className="pdc-card"><CareerEmptyState title="Career is not available yet" icon={<Star className="w-6 h-6" />}>Career mode is switched off for this account. The Classic Tour is still available.</CareerEmptyState></div>
      ) : saves.error || !saves.data ? <CareerError error={saves.error} onRetry={() => saves.refetch()} /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {saves.data.slots.map(slot => slot.career
              ? <SlotCard key={slot.slotNumber} save={slot.career} busy={life.retire.isPending || life.restart.isPending || life.remove.isPending}
                  onContinue={() => navigate(`/career/${slot.career!.id}`)}
                  onRestart={() => life.restart.mutate(slot.career!.id, { onSuccess: s => navigate(`/career/${s.id}`), onError: e => setError(errorMessage(e)) })}
                  onRetire={() => life.retire.mutate(slot.career!.id, { onError: e => setError(errorMessage(e)) })}
                  onDelete={() => life.remove.mutate(slot.career!.id, { onError: e => setError(errorMessage(e)) })} />
              : <EmptySlot key={slot.slotNumber} slot={slot.slotNumber} busy={life.create.isPending}
                  onCreate={(name, difficulty, dateOfBirth, homeLocality,shirt,nickname) => { setError(null); life.create.mutate({ slot: slot.slotNumber, careerName: name || undefined, difficulty, dateOfBirth, homeLocality },
                    { onSuccess: async s => {try {await saveInitialShirt(s.id,{...shirt,nickname:nickname.trim()||null});navigate(`/career/${s.id}`);}catch {navigate(`/career/${s.id}/presentation?setup=needed`);}}, onError: e => setError(errorMessage(e)) }); }} />)}
          </div>
          <section className="pdc-card overflow-hidden" aria-label="Retired Careers">
            <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}><Archive className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} aria-hidden /><Label>Retired archive</Label></div>
            {saves.data.archived.length === 0 ? <CareerEmptyState title="No retired Careers">Retired Careers stay here, readable but no longer playable.</CareerEmptyState> : (
              <ul>
                {saves.data.archived.map(s => (
                  <li key={s.id} className="px-4 py-2.5 border-b last:border-b-0 flex items-center gap-3 flex-wrap" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-black uppercase truncate" style={{ ...OSWALD, color: "#fff", fontSize: "0.85rem" }}>{s.careerName ?? `Slot ${s.slotNumber} Career`}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Retired after season {s.currentSeason}, week {s.currentWeek}</div>
                    </div>
                    <Link href={`/career/${s.id}`} className="career-btn career-btn-ghost">View record</Link>
                    <ConfirmButton label="Delete" confirmLabel="Delete permanently" danger busy={life.remove.isPending} description="This permanently deletes this retired Career and all of its history. It cannot be undone."
                      onConfirm={() => life.remove.mutate(s.id, { onError: e => setError(errorMessage(e)) })} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SlotCard({ save, onContinue, onRestart, onRetire, onDelete, busy }: { save: CareerSave; onContinue: () => void; onRestart: () => void; onRetire: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <article className="pdc-card p-4 flex flex-col gap-3" aria-label={`Slot ${save.slotNumber}`}>
      <div className="flex items-center justify-between gap-2">
        <Label>Slot {save.slotNumber}</Label>
        <StatusBadge label={save.status === "ACTIVE" ? "Active" : "Retired"} tone={save.status === "ACTIVE" ? "success" : "muted"} />
      </div>
      <div className="font-black uppercase leading-tight truncate" style={{ ...OSWALD, fontSize: "1.2rem", color: "#fff" }}>{save.careerName ?? "My Career"}</div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {slotLines(save).map(l => (
          <div key={l.label} className="min-w-0"><dt><Label color="rgba(255,255,255,0.35)">{l.label}</Label></dt><dd className="text-sm truncate" style={{ ...OSWALD, color: "#fff" }}>{l.value}</dd></div>
        ))}
        <div className="col-span-2"><dt><Label color="rgba(255,255,255,0.35)">Last played</Label></dt><dd className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{new Date(save.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
      </dl>
      <button className="career-btn career-btn-primary w-full" onClick={onContinue}>Continue</button>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton label="Restart" confirmLabel="Restart Career" busy={busy} description="Restarting deletes this Career's world, results, money and history and starts a fresh Career in the same slot." onConfirm={onRestart} />
        <ConfirmButton label="Retire" confirmLabel="Retire Career" busy={busy} description="Retiring ends this Career. It moves to the archive, stays readable, and frees this slot. It cannot be resumed." onConfirm={onRetire} />
        <ConfirmButton label="Delete" confirmLabel="Delete permanently" danger busy={busy} description="This permanently deletes the Career and all of its history. It cannot be undone." onConfirm={onDelete} />
      </div>
    </article>
  );
}

function EmptySlot({ slot, onCreate, busy }: { slot: number; onCreate: (name: string, difficulty: string, dateOfBirth: string, homeLocality: string,shirt:ShirtIdentity,nickname:string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState("STANDARD");
  const [dob, setDob] = useState("");
  const [home, setHome] = useState("ayrshire");
  const [step,setStep]=useState(0),[nickname,setNickname]=useState("");
  const [shirt,setShirt]=useState<ShirtIdentity>({shirtTemplate:"CLASSIC",kitDesignId:"kit-50-01",primaryColour:"#20334A",secondaryColour:"#FFFFFF",accentColour:"#C8A050"});
  const start = careerStartDateForToday();
  const startAge = dob ? ageOnDate(dob, start) : null;
  const tooYoung = startAge !== null && startAge < MINIMUM_CAREER_START_AGE;
  return (
    <article className="pdc-card p-4 flex flex-col gap-3 justify-between" aria-label={`Slot ${slot} — empty`} style={{ borderStyle: "dashed" }}>
      <div><Label>Slot {slot}</Label><div className="font-black uppercase mt-1" style={{ ...OSWALD, color: "rgba(255,255,255,0.62)" }}>Empty slot</div></div>
      {!open ? <button className="career-btn career-btn-ghost w-full" onClick={() => setOpen(true)}><Plus className="w-4 h-4" aria-hidden /> New Career</button> : (
        <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); if (!dob || tooYoung) return;if(step<2){setStep(step+1);return;}onCreate(name.trim(), difficulty, dob, home,shirt,nickname); }}>
          <p>Build a darts career your way. Professional darts is optional. Career cash and fictional-world achievements are separate from your real TKDL league profile and coins.</p>
          <div hidden={step!==0} className="space-y-2">
          <label className="flex flex-col gap-1"><Label>Career name (optional)</Label>
            <input value={name} maxLength={80} onChange={e => setName(e.target.value)} className="rounded-lg px-3 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]" placeholder="My Career" />
          </label>
          <label className="flex flex-col gap-1"><Label>Date of birth</Label>
            <input type="date" required value={dob} max={start} onChange={e => setDob(e.target.value)} aria-describedby={`dob-help-${slot}`} aria-invalid={tooYoung || undefined}
              className="rounded-lg px-3 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]" />
            <span id={`dob-help-${slot}`} className="text-xs" style={{ color: tooYoung ? "#ff8fb4" : "rgba(255,255,255,0.62)" }}>
              {startAge === null ? `Career time starts on ${start}. You must be at least ${MINIMUM_CAREER_START_AGE}. This cannot be changed later.`
                : tooYoung ? `You would be ${startAge} when the Career starts — the minimum is ${MINIMUM_CAREER_START_AGE}.`
                : `You start the Career aged ${startAge}${startAge < 18 ? " — junior events are open to you until you turn 18" : ""}. This cannot be changed later.`}
            </span>
          </label>
          <label className="flex flex-col gap-1"><Label>Home region</Label>
            <select value={home} onChange={e => setHome(e.target.value)} className="rounded-lg px-3 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
              {HOME_REGIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Used for travel costs to events.</span>
          </label>
          <label className="flex flex-col gap-1"><Label>Opposition difficulty</Label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="rounded-lg px-3 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
              <option value="ACCESSIBLE">Accessible</option><option value="STANDARD">Standard</option><option value="CHALLENGING">Challenging</option>
            </select>
          </label>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Difficulty only tunes simulated opponents. Sporting rules are identical on every setting.</p>
          </div>
          {step===1&&<><CareerKitCustomizer identity={shirt} playerName={name||"Your player"} onChange={patch=>setShirt(current=>({...current,...patch}))}/>
            <label>Nickname (optional) <input maxLength={32} value={nickname} onChange={e=>setNickname(e.target.value)}/></label><p>Appearance only. No ability, seeding, sponsorship or results effect.</p></>}
          {step===2&&<><h3>Confirm Career</h3><p>{name||"My Career"} · Born {dob} · {HOME_REGIONS.find(r=>r.key===home)?.label} · {difficulty}</p><CareerShirt name={name||"Your player"} identity={shirt}/><p>{nickname||"No nickname"} · DOB is permanent once created. Shirt colours can be edited during the supported opening-week window.</p></>}
          <div className="flex gap-2">{step>0&&<button type="button" className="career-btn" onClick={()=>setStep(step-1)} disabled={busy}>Back</button>}<button type="submit" className="career-btn career-btn-primary flex-1" disabled={busy || !dob || tooYoung}>{busy ? "Creating world…" : step===2?"Start Career":step===0?"Choose shirt":"Review Career"}</button>
            <button type="button" className="career-btn career-btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </article>
  );
}
