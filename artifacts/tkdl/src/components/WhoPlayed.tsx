import { Check } from "lucide-react";

export type RosterPerson = { id: number; name: string };

/**
 * Tap-to-pick list of who actually threw for a team. Team stats don't
 * change — this only feeds each player's own "games for the team" record.
 */
export function WhoPlayed({ label, color, roster, value, onChange }: {
  label: string;
  color: string;
  roster: RosterPerson[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  const missing = value.length === 0;
  return (
    <div className="who-played" style={{ ["--c" as any]: color }}>
      <div className="who-played-head">
        <span className="who-played-label">{label}</span>
        <span className={missing ? "who-played-hint need" : "who-played-hint"}>
          {missing ? "Tap who played" : `${value.length} played`}
        </span>
      </div>
      {roster.length === 0 ? (
        <p className="who-played-empty">No players on this team yet.</p>
      ) : (
        <div className="who-played-chips">
          {roster.map(p => {
            const on = value.includes(p.id);
            return (
              <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)}
                className={on ? "who-chip on" : "who-chip"}>
                {on && <Check className="w-3.5 h-3.5" />}
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
