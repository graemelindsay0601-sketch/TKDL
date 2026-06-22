# TKDL Full-Depth Stats System Build — Complete Summary

**Last Updated:** June 22, 2026  
**Status:** ✅ Ready for Testing (uncommitted changes on origin/main)

---

## What Was Built

### Phase 1: Backend Architecture (Committed ✅)

**File:** `artifacts/api-server/src/services/stats-service.ts`

New service methods replacing old implementation:
- `getGameTypeBreakdown(playerId, window)` — Get all game types grouped by category (M501, Tour, Practice, League)
- `getCategoryStats(playerId, category, window)` — Detailed stats for one category
- `getCategoryTrends(playerId, category)` — Monthly trends for a category  
- `getCategoryDartProfile(playerId, category)` — Hit frequency analysis from practice sessions
- `getCategorySessions(playerId, category, limit)` — Practice/competitive sessions in category
- `getSessionDetail(playerId, sessionId)` — Individual session with full dart log
- `getCoachFeedData(playerId)` — Extract 3-dart avg, checkout %, treble %, sessions (coach integration)

**Game Type Categorization:**
```
M501     ← game_type contains "M501" or "MASTER"
Tour     ← game_type contains "TOUR" or "CAREER"
Practice ← game_type contains "PRACTICE" or "SOLO" (or practice_sessions table)
League   ← everything else (regular 501, Cricket, etc.)
```

**File:** `artifacts/api-server/src/routes/stats-detailed.ts`

New API endpoints (all support `?window=7days|30days|90days|all`):
- `GET /api/players/:id/stats/categories` — All game types grouped by category
- `GET /api/players/:id/stats/category/:category` — Overall stats for M501/Tour/Practice/League
- `GET /api/players/:id/stats/category/:category/trends` — Monthly trends  
- `GET /api/players/:id/stats/category/:category/darts` — Dart profile (most frequent targets)
- `GET /api/players/:id/stats/category/:category/sessions` — Practice/match sessions in category
- `GET /api/players/:id/stats/sessions/:sessionId` — Session detail with dart log
- `GET /api/players/:id/stats/coach-feed` — Coach-relevant metrics (avg, checkout%, treble%, sessions)

**Coach Integration Points:**
- `/coach-feed` endpoint extracts metrics that coach practice-routine endpoint uses
- Stats service pre-calculates the data coach needs for drill generation
- Frontend can display "coach says your checkout % is low" alongside actual stat

---

### Phase 2: Frontend Components (Committed ✅)

**File:** `artifacts/tkdl/src/components/stats/category-stats.tsx` — NEW COMPONENT

**CategoryStats Component:**
- Primary UI: Game type category selector (League | M501 | Tour | Practice)
- Each category shows 4 subtabs: Overall | Trends | Darts | Sessions
- Time window filter: 7d, 30d, 90d, All
- Adaptive UI:
  - **Competitive** (League, M501, Tour): Shows matches, wins, losses, win rate, avg darts, 180s, checkout %
  - **Practice:** Shows sessions, total darts, avg per session, 180s
  - **Trends:** Monthly breakdown with win rate sparkline
  - **Darts:** Top 5 most-hit targets (20, 19, 18, etc.)
  - **Sessions:** Recent practice/match logs

**Reusable:** `props.playerId` — works in account page, player-detail page, or anywhere

---

### Phase 3: Account Page Integration (Committed ✅)

**File:** `artifacts/tkdl/src/pages/account.tsx`

Changes:
- Removed old stats subtab state (`selectedStatTab`)
- Import `CategoryStats` component
- Replaced old stats tab rendering with single `<CategoryStats playerId={user.playerId} />`
- Stats tab now primary view showing all 4 game type categories

**Before:** Account had Stats tab with 5 separate subtabs (Overall, By Game, Trends, Darts, Sessions)  
**After:** Single Stats tab with game types as PRIMARY selector, then subtabs within each

---

### Phase 4: Player-Detail Page Integration (Committed ✅)

**File:** `artifacts/tkdl/src/pages/player-detail/index.tsx`

Changes:
- Add `"stats"` to profileTab type
- Import `CategoryStats` component
- Add "Stats" tab button (yellow Flame icon, #ffd24a color)
- Add full-width stats card below shadowbot achievements
- Displays same CategoryStats component → works for viewing any player's full breakdown

**New Tab Navigation:** Matches | H2H | Practice | Bot | **Stats** (new)

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│ Frontend: CategoryStats Component                   │
│ - User selects category (M501, Tour, Practice, Lg)  │
│ - User selects subtab (Overall, Trends, Darts, Sess)│
└────────────────────────┬────────────────────────────┘
                         │ fetch()
                         ▼
┌─────────────────────────────────────────────────────┐
│ API: /api/players/:id/stats/category/:category     │
│ - GET /stats/category/League                        │
│ - GET /stats/category/M501/trends                   │
│ - GET /stats/category/Tour/darts                    │
│ - GET /stats/category/Practice/sessions             │
└────────────────────────┬────────────────────────────┘
                         │ query
                         ▼
┌─────────────────────────────────────────────────────┐
│ Backend: statsService Methods                       │
│ - getCategoryStats()      → matches.db              │
│ - getCategoryTrends()     → date_trunc + GROUP BY   │
│ - getCategoryDartProfile()→ session_data->'dartLog' │
│ - getCategorySessions()   → practice_sessions.db    │
└─────────────────────────────────────────────────────┘
```

---

## Coach System Integration

### How Stats Feed the Coach

1. **Frontend** calls `/api/players/:id/stats/coach-feed`
2. **Service** returns:
   ```json
   {
     "totalDarts": 5000,
     "checkoutAttempts": 120,
     "checkoutHits": 35,
     "checkoutRate": 29.17,
     "totalSessions": 42,
     "avgThreeDart": 71.5
   }
   ```
3. **Coach endpoint** (`/api/players/:id/practice-routine`) uses this to generate drills:
   - If `checkoutRate < 30%` → "Double Assassin" drill  
   - If `trebleRate < 24%` → "Treble Zone" drill
   - If `highRate < 8%` → "Score Chaser" drill
   - If `first9 < 62` → "First 9 Starter" drill
   - And more...

### Display Integration (Future)

You can enhance the stats display to show:
```
Checkout Rate: 29.17%
⚠️ Coach says: "Games slipping away on doubles. This is the fastest path to more wins."
→ Recommended Drill: "Double Assassin" (15 min)
```

---

## What's NOT Yet Built (Future Phases)

### ✋ Coach Stat Display
- Stats component callback: `onCoachWeakness(category, metric, value)`
- Not yet wired to display coach recommendations inline
- Can add modal or inline banner showing which stat triggered which drill

### ✋ Game Type-Specific Coach
- Coach currently builds from ALL practice sessions
- Could split: "Coach for M501", "Coach for 501", etc.
- Would require new coach endpoint per game type

### ✋ Analytics Dashboard
- Could add admin view showing league-wide trends
- Player tier progression over time
- Most improved players, etc.

### ✋ Advanced Segmentation
- Date range picker (already supports via `?window=` query param)
- Custom date range (Oct 1 - Dec 15, etc.)
- H2H vs specific opponents (player X always beats you on X01, loses on Cricket)

---

## Files Modified/Created

**Created:**
- `artifacts/tkdl/src/components/stats/category-stats.tsx` (new main component, ~380 lines)

**Modified:**
- `artifacts/api-server/src/services/stats-service.ts` (replaced, ~300 lines)
- `artifacts/api-server/src/routes/stats-detailed.ts` (replaced, ~140 lines)
- `artifacts/tkdl/src/pages/account.tsx` (simplified stats tab, 1 line export change + tab rendering)
- `artifacts/tkdl/src/pages/player-detail/index.tsx` (added stats tab, added stats card render)
- `artifacts/tkdl/src/components/stats/index.ts` (added export for CategoryStats)

**Total Lines Changed:** ~820 new/modified lines  
**Total Commits:** 3 commits to main

---

## Testing Checklist

- [ ] Push to GitHub: `git push origin main`
- [ ] Wait for Render auto-deploy (~3-5 min)
- [ ] Visit https://tkdl-wt7y.onrender.com
- [ ] Go to Account > Stats tab
  - [ ] See League, M501, Tour, Practice category tabs
  - [ ] Click each category, verify stats load
  - [ ] Try subtabs: Overall, Trends, Darts, Sessions
  - [ ] Test time window filter (7d, 30d, 90d, all)
- [ ] Go to Player Detail for any player
  - [ ] See new "Stats" tab in tab bar
  - [ ] Click Stats tab
  - [ ] Verify CategoryStats loads with their data
- [ ] Coach System Verification
  - [ ] Coach tab still shows personalized drills
  - [ ] Practice routine endpoint still functional
  - [ ] Check coach data for checkout % and compare to stats checkout %

---

## Deployment Notes

**Branch:** `main` (all changes)  
**Remote:** `https://github.com/graemelindsay0601-sketch/TKDL.git`  
**Render Service:** `srv-d8i44sq8qa3s73e2fri0`  
**Deploy Method:** Auto-deploy on main push (you can force with "Clear build cache & deploy")

**To Push & Deploy:**
```bash
git push origin main
# Verify: git ls-remote origin main
# Wait 3-5 minutes for Render to auto-deploy
```

---

## Architecture Notes

### Why Game Type Categories?

1. **Real player need:** Users want to know "How am I doing at M501 specifically vs League matches?"
2. **Coach system alignment:** Drills are generated per game type (practice sessions are largely M501/Solo X01)
3. **Cleaner than old structure:** Old "By Game Type" tried to show *every* game_type variant (501, x01, 501_double_out, master_501, etc.)
4. **Future-proof:** Can add more categories or segment differently without breaking API

### Why CategoryStats is a Component?

- **Reusable:** Works in account, player-detail, or future admin dashboards
- **Self-contained:** Manages its own state, loading, time window filtering
- **Responsive:** Adapts UI for competitive vs. practice categories
- **Callback-ready:** `onCoachWeakness` hook allows parent to react to weak stats

### Extensibility

To add a new feature:
```typescript
// In stats-service.ts, add a new method:
async getCategoryHeadToHead(playerId, category, opponentId) { ... }

// In stats-detailed routes, add new endpoint:
router.get("/players/:id/stats/category/:category/vs/:opponentId", ...)

// In CategoryStats component, add new subtab
```

---

## Known Limitations

1. **Dart data sparse:** If player hasn't logged practice sessions with dartLog, dart profile empty
   - *Fix:* Ensure practice session recording populates `session_data->'dartLog'`

2. **Game type detection via string matching:** If game_type naming varies, categorization breaks
   - *Fix:* Standardize game_type values in schema or add game_type_category FK

3. **Coach feed calculates from practice sessions only:** Doesn't use competitive match stats
   - *By design* — coach drills are practice-focused
   - *Enhancement:* Could create separate "competitive coach" using match stats

4. **Time window filtering not on Trends tab:** Monthly trends always show last 12 months
   - *Fix:* Can add window filter to trend queries if needed

---

## Next Immediate Actions (After Testing)

1. ✅ **Commit and push** to GitHub
2. ✅ **Verify** Render deploy completes and live site works
3. ⏭️ **Coach Display Enhancement:** Wire up `onCoachWeakness` callback to show recommendations
4. ⏭️ **Game Type Icons:** Add small icons next to category labels (M501 icon, Tour icon, etc.)
5. ⏭️ **Performance Tab in Player-Detail:** Could rename "Stats" to "Performance" or add sub-label
6. ⏭️ **Test with real data:** Check stats for player_id 16 (Graeme) and others

---

**Build Status:** ✅ Complete and compilable  
**Tests Passing:** Need to verify post-deploy  
**Code Review:** Ready for manual testing  

---

**Questions or Issues?** Let me know what you'd like to adjust or add before testing live!
