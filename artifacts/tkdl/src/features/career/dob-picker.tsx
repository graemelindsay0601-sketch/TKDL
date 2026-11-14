import { useEffect, useState } from "react";

import { MONTHS, composeDob, daysIn } from "./dob";

/**
 * Date of birth as three dropdowns. A native date input opens a month-by-month calendar on phones and tablets, so
 * picking a birth year means paging back hundreds of months; selects open the device's own scroll wheel instead.
 * Years run from the youngest allowed age at `start` back `span` years.
 */
export function DobPicker({ value, onChange, start, minAge, span = 80, invalid, describedBy, idPrefix }: {
  value: string; onChange: (dob: string) => void; start: string; minAge: number; span?: number; invalid?: boolean; describedBy?: string; idPrefix: string;
}) {
  const [y0, m0, d0] = value ? value.split("-") : ["", "", ""];
  const [year, setYear] = useState(y0), [month, setMonth] = useState(m0 ? String(Number(m0)) : ""), [day, setDay] = useState(d0 ? String(Number(d0)) : "");
  useEffect(() => { onChange(composeDob(day, month, year)); }, [day, month, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = Number(start.slice(0, 4)) - minAge;
  const years = Array.from({ length: span + 1 }, (_, i) => latest - i);
  const days = year && month ? daysIn(Number(year), Number(month)) : 31;
  // A shorter month (or 29 February in a non-leap year) moves the chosen day to the month's last, so the box shows what is stored.
  useEffect(() => { if (day && Number(day) > days) setDay(String(days)); }, [day, days]);
  const cls = "rounded-lg px-2 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]";
  const common = { required: true, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, className: cls };
  return <div className="career-dob" role="group" aria-labelledby={`${idPrefix}-label`} style={{ display: "grid", gridTemplateColumns: "minmax(0,0.8fr) minmax(0,1.6fr) minmax(0,1fr)", gap: 6 }}>
    <select {...common} aria-label="Day" value={day} onChange={e => setDay(e.target.value)} data-testid={`${idPrefix}-day`}>
      <option value="">Day</option>{Array.from({ length: days }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
    </select>
    <select {...common} aria-label="Month" value={month} onChange={e => setMonth(e.target.value)} data-testid={`${idPrefix}-month`}>
      <option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
    <select {...common} aria-label="Year" value={year} onChange={e => setYear(e.target.value)} data-testid={`${idPrefix}-year`}>
      <option value="">Year</option>{years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  </div>;
}
