/** Remaining score after each dart (index 0 = before any dart), replaying X01 visits: a visit ends after three darts,
 *  on a finish, or on a bust (which puts the score back to where the visit started). */
export function remainingTimeline(values: number[], mults: number[], start: number, doubleOut = true): number[] {
  const out = [start]; let rem = start, visitStart = start, inVisit = 0;
  for (let i = 0; i < values.length; i++) {
    const next = rem - values[i];
    const bust = next < 0 || (doubleOut && next === 1) || (doubleOut && next === 0 && mults[i] !== 2);
    if (bust) { rem = visitStart; inVisit = 0; visitStart = rem; out.push(rem); continue; }
    rem = next; inVisit++;
    if (rem === 0 || inVisit === 3) { inVisit = 0; visitStart = rem; }
    out.push(rem);
  }
  return out;
}

