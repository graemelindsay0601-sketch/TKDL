import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { BellOff, Bell, CheckCircle2, Clock, Inbox as InboxIcon, Sparkles, Trophy, X } from "lucide-react";
import { useInbox, useUpdateInbox, useMilestones, useCareerLife, errorMessage, type InboxView } from "./api";
import { milestoneLabel } from "./model";
import { UNLOCKS, useUnlocks } from "./unlocks";
import type { CareerSave } from "./types";
import "./inbox.css";

type Item = InboxView["items"][number] & { local?: boolean };
const ICON = { QUALIFIED: Trophy, OPEN: Sparkles, WAITING: InboxIcon, CLOSING: Clock, MILESTONE: CheckCircle2 } as const;

/** The inbox items, plus pages that have just unlocked (those are tracked on this device by the unlock rules). */
function useItems(save: Pick<CareerSave, "id" | "currentSeason" | "status" | "currentWeek">) {
  const q = useInbox(save.id), unlocks = useUnlocks(save);
  const items = useMemo<Item[]>(() => {
    const local: Item[] = UNLOCKS.filter(u => unlocks.isNew(u.key)).map(u => ({ key: `unlock:${u.key}`, category: "OPEN", title: `${u.label[0].toUpperCase()}${u.label.slice(1)}: now open`,
      body: `You've played enough events to open ${u.label}. Have a look when you're ready.`, action: { label: "Open", href: `/career/${save.id}/${u.key}` },
      week: save.currentWeek, expiresWeek: null, from: q.data?.manager?.name ?? "Career", isNew: true, muted: false, local: true }));
    return [...local, ...(q.data?.items ?? [])];
  }, [q.data, unlocks, save.id, save.currentWeek]);
  return { q, items, unread: items.filter(i => i.isNew && !i.muted).length };
}

/** The number for the Home tab's badge. */
export function useInboxUnread(save: Pick<CareerSave, "id" | "currentSeason" | "status" | "currentWeek"> | undefined) {
  const q = useInbox(save?.id ?? "", !!save), unlocks = useUnlocks(save ?? { id: "", currentSeason: 99, status: "ACTIVE" });
  return save ? (q.data?.unread ?? 0) + UNLOCKS.filter(u => unlocks.isNew(u.key)).length : 0;
}

/** The unread inbox items (for the Attention panel). */
export function useInboxFresh(save: Pick<CareerSave, "id" | "currentSeason" | "status" | "currentWeek">) {
  const { items } = useItems(save);
  return items.filter(i => i.isNew && !i.muted);
}

/** Home: the newest few things, and the way in to the full inbox. */
export function InboxStrip({ save }: { save: CareerSave }) {
  const { items, unread } = useItems(save);
  const fresh = items.filter(i => i.isNew && !i.muted).slice(0, 3);
  if (!fresh.length) return null;
  return <section className="career-inbox-strip" aria-label="What's new">
    <div className="career-inbox-strip__head"><b><InboxIcon aria-hidden /> What's new</b><Link href={`/career/${save.id}/inbox`}>Open inbox ({unread})</Link></div>
    <ul>{fresh.map(i => <Row key={i.key} item={i} saveId={save.id} compact />)}</ul>
  </section>;
}

function Row({ item, saveId, compact, onDismiss }: { item: Item; saveId: string; compact?: boolean; onDismiss?: () => void }) {
  const Icon = ICON[item.category];
  return <li className="career-inbox-item" data-category={item.category} data-new={item.isNew || undefined}>
    <span className="career-inbox-item__icon" aria-hidden><Icon /></span>
    <div className="career-inbox-item__body">
      <b>{item.title}{item.isNew && <i>New</i>}</b>
      {!compact && <small className="career-inbox-item__from">{item.from}</small>}
      <p>{item.body}</p>
    </div>
    <div className="career-inbox-item__actions">
      {item.action && <Link href={item.action.href} className="career-btn career-btn-gold">{item.action.label}</Link>}
      {onDismiss && !item.local && <button type="button" className="career-btn career-btn-ghost" aria-label={`Dismiss ${item.title}`} onClick={onDismiss}><X aria-hidden /></button>}
    </div>
  </li>;
}

/** The full inbox: grouped, with mute per category; opening it marks what's shown as seen. */
export function InboxPage({ save }: { save: CareerSave }) {
  const { q, items } = useItems(save), update = useUpdateInbox(save.id);
  const unseen = items.filter(i => i.isNew && !i.local).map(i => i.key).join("|");
  useEffect(() => { if (!unseen) return undefined; const t = setTimeout(() => update.mutate({ seen: unseen.split("|") }), 1500); return () => clearTimeout(t); }, [unseen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading) return <p className="career-inbox__note">Checking what's new…</p>;
  if (q.isError) return <p role="alert">{errorMessage(q.error)}</p>;
  const cats = Object.entries(q.data!.categories) as [keyof InboxView["categories"], string][];
  return <section className="career-inbox" aria-labelledby="inbox-title">
    <header><h1 id="inbox-title"><InboxIcon aria-hidden /> Inbox</h1>
      <p>{q.data!.manager ? `${q.data!.manager.name} keeps you posted: what` : "What"} you've qualified for, what's opened up, offers waiting for an answer and your milestones. Nothing here changes your darts.</p></header>
    {cats.map(([key, label]) => {
      const list = items.filter(i => i.category === key), muted = q.data!.muted.includes(key);
      return <div className="career-inbox__group" key={key} data-muted={muted || undefined}>
        <div className="career-inbox__group-head"><h2>{label} <small>{list.length}</small></h2>
          <button type="button" className="career-btn career-btn-ghost" disabled={update.isPending} onClick={() => update.mutate(muted ? { unmute: key } : { mute: key })}>
            {muted ? <><Bell aria-hidden /> Unmute</> : <><BellOff aria-hidden /> Mute</>}</button></div>
        {list.length ? <ul>{list.map(i => <Row key={i.key} item={i} saveId={save.id} onDismiss={() => update.mutate({ dismiss: [i.key] })} />)}</ul>
          : <p className="career-inbox__note">Nothing here right now.</p>}
      </div>;
    })}
    <RecentElsewhere saveId={save.id} />
    {update.error && <p role="alert">{errorMessage(update.error)}</p>}
  </section>;
}

/** Your recent career milestones and darts-world news (these used to sit in the Attention bell). */
function RecentElsewhere({ saveId }: { saveId: string }) {
  const milestones = useMilestones(saveId, 4), life = useCareerLife(saveId);
  const ms = milestones.data?.milestones.slice(0, 4) ?? [], news = life.data?.news.slice(0, 4) ?? [];
  if (!ms.length && !news.length) return null;
  return <div className="career-inbox__group">
    {ms.length > 0 && <><div className="career-inbox__group-head"><h2>Your milestones</h2></div>
      <ul>{ms.map((m, i) => <li key={`${m.kind}-${m.season}-${i}`} className="career-inbox-item"><span className="career-inbox-item__icon" aria-hidden><Trophy /></span>
        <div className="career-inbox-item__body"><b>{milestoneLabel(m).title}</b><p>Season {m.season}{m.week ? `, week ${m.week}` : ""}</p></div></li>)}</ul></>}
    {news.length > 0 && <><div className="career-inbox__group-head"><h2>Darts world news</h2><Link href={`/career/${saveId}/stories`}>All stories</Link></div>
      <ul>{news.map(n => <li key={n.id} className="career-inbox-item"><span className="career-inbox-item__icon" aria-hidden><Sparkles /></span>
        <div className="career-inbox-item__body"><b>{n.title}</b></div></li>)}</ul></>}
  </div>;
}
