---
name: TKDL Season Data
description: Correct standings for completed seasons, derived from the match CSV
---

## May 2026 Final Standings (calculated from CSV)

Players started at 25pts, wager-based (winner gains stake, loser loses stake).

| Pos | Player | Points | W-L | Notes |
|-----|--------|--------|-----|-------|
| 1 | Richard | 81 | 10W-5L | Champion |
| 2 | Graeme | 71 | 8W-6L | |
| 3 | Sean | 69 | 8W-1L | |
| 4 | Scott | 25 | 0W-0L | No matches played |
| 5 | Robert | 15 | 2W-2L | |
| 6 | Cavan | 11 | 2W-3L | |
| 7 | Ryan | 0 | 3W-6L | ELIMINATED |
| 8 | Kyle | 0 | 2W-5L | ELIMINATED |
| 9 | Cameron | 0 | 0W-3L | ELIMINATED |
| 10 | Ronald Augustine | 0 | 0W-1L | ELIMINATED |
| 11 | Jamie | 0 | 0W-2L | ELIMINATED |

**Why:** Old data used non-wager legacy values. These were recalculated by summing stake gains/losses from the CSV for each player starting from 25pts.

**How to apply:** If standings ever get reset, re-derive from the attached CSV file in the workspace.

## February 2026

- Format: 301 round-robin
- playoffPending: true
- No champion yet (playoff match pending)
- Top league finishers: Robert(1st), Graeme(2nd), Richard(3rd), Scott(4th), Aiden(5th)

## Recoverable repository exports checked 2026-10-31

- The TKDL GitHub repository has two CSV export copies on older branches, each with 91 rows: 50 FEB_2026, 35 MAY_2026, and 6 JUNE_2026; the latest match timestamp is 2026-06-06.
- The separate `tkdl-broadcast` repository has a 50-row MARCH_2026 archived-match CSV and another 85-row career-match export, plus season/stat snapshots. These do not extend into the ongoing October season.
- The app's current development seed inserts 9 June matches, while the 91-row CSV has only 6 June-tagged rows; the CSV is therefore not complete even through June.
- No database dump or October match export was found in the checked repository branches/trees. The admin backup endpoint downloads a JSON file to the user's device; it does not commit backups into Git.

**Why:** Repository source files are not a complete ledger of the live league; treating them as complete would risk presenting stale or incomplete head-to-head records as current.

**How to apply:** For missing records, verify against the live production database or a newer user-held export before changing stats. Do not import repository CSVs as a complete history. The current Repl has no production database available to query.
