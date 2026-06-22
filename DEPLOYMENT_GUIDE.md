# TKDL Stats Build — Post-Deployment Guide

## Current Status

✅ **Code Complete** — All changes committed to main branch  
✅ **TypeScript Compiles** — No type errors  
⏳ **Awaiting:** Git push to GitHub + Render deploy

---

## How to Deploy

### Step 1: Push to GitHub

```bash
cd /tmp/TKDL  # or your local repo directory
git push origin main
```

**Verify push succeeded:**
```bash
git ls-remote origin main
# Should show: HEAD reference pointing to your latest commit hash
```

### Step 2: Render Auto-Deploy Starts

- Render automatically deploys on main push
- Watch https://dashboard.render.com for build progress
- Expected time: 3-5 minutes
- Service: `srv-d8i44sq8qa3s73e2fri0` (TKDL API backend)

**Render Dashboard Path:** Services → TKDL → Deploys → Latest (should be "In Progress" then "Live")

### Step 3: Live Testing

After "Deployed" status shows green:

```
https://tkdl-wt7y.onrender.com
```

---

## Testing Plan (After Deployment Live)

### Test 1: Account Stats Tab ✅

1. Log in with your account
2. Go to Account → Stats tab
3. Verify you see 4 category buttons:
   - [ ] League (red #ff005c)
   - [ ] M501 (yellow #ffd24a)
   - [ ] Tour (teal #00e5a0)
   - [ ] Practice (purple #a855f7)
4. Click League → Should load stats for your league matches
   - [ ] Shows "Matches" count
   - [ ] Shows "Win Rate" percentage
   - [ ] Shows "Avg Darts" per match
   - [ ] Shows "180s" count
   - [ ] Shows "Checkout %" with hits/attempts
5. Click M501 → Should load M501 stats
6. Click Practice → Should load practice session stats
7. For Practice, should show:
   - [ ] "Sessions" count (not "Matches")
   - [ ] "Total Darts" across all sessions
   - [ ] "Avg Per Session"
   - [ ] "180s" count

**Expected Behavior:** Each category loads independently and quickly

**What Could Go Wrong:**
- ❌ "Network error" → API endpoint not responding
  - **Fix:** Check Render build logs for errors
- ❌ Empty stats for categories → No data in database
  - **Expected:** If you haven't played many M501 games, M501 tab will be empty
  - **Check:** Are there matches in the database for that game type?
- ❌ Checkout % shows "NaN" → No checkout data
  - **Fix:** Ensure matches have checkout_attempts/checkout_hits populated

### Test 2: Stats Subtabs ✅

**On any category (e.g., League):**

1. Click "Overall" subtab
   - [ ] Should show stat cards as above
2. Click "Trends" subtab
   - [ ] Should show monthly breakdown (Apr, May, Jun 2026, etc.)
   - [ ] Each month shows: games count, wins, win rate
3. Click "Darts" subtab
   - [ ] Should show top 5 target frequencies (20, 19, 18, 17, 16)
   - [ ] Each shows percentage hit
   - [ ] ⚠️ If all say "No dart data available" → Practice sessions don't have dartLog
4. Click "Sessions" subtab
   - [ ] Should show list of recent sessions/matches
   - [ ] Each shows date, darts thrown, 180s count

**What Could Go Wrong:**
- ❌ Darts tab always empty → dartLog not populated in practice sessions
  - **Check:** Your practice session recording — does it save dartLog?
  - **Temporary Fix:** Create a quick test session and verify dartLog in database
- ❌ Trends show wrong months → Database clock issue
  - **Fix:** Should auto-correct after deploy

### Test 3: Time Window Filter ✅

**On League category:**

1. Click "7d" button
   - [ ] Stats update to last 7 days only
   - [ ] Numbers should be ≤ "All" numbers
2. Click "30d" button
   - [ ] Stats update to last 30 days
3. Click "90d" button
   - [ ] Stats update to last 90 days
4. Click "All" button
   - [ ] Returns to all-time stats

**What Could Go Wrong:**
- ❌ Numbers don't change → Time window not being applied
  - **Fix:** Check stats-detailed routes for window parameter handling

### Test 4: Player-Detail Stats Tab ✅

1. Go to any player detail page (click a player)
2. Look for tab bar: Matches | H2H | Practice | Bot | **Stats** (new)
3. Click "Stats" tab
   - [ ] New tab should slide/show in view
   - [ ] Should see same CategoryStats component
   - [ ] Load their stats (not yours)
4. Verify it shows their data
   - [ ] Different player should have different numbers
5. Test all subtabs on their stats

**What Could Go Wrong:**
- ❌ Stats tab not showing → Render or TypeScript compile error
  - **Fix:** Check Render build logs
- ❌ Shows your stats instead of their stats → playerId not passed correctly
  - **Fix:** Check player-detail code for CategoryStats playerId prop

### Test 5: Coach Integration Check ✅

1. Go to Account → Coach tab
2. Should still see "Personalised Drill Plan" as before
3. Verify drills still load correctly
4. **New connection:** Go to Account → Stats → Practice tab
5. Note the checkout % shown in stats
6. Go back to Coach tab
7. If checkout % is low in stats, coach should recommend "Double Assassin" drill
   - [ ] Coach tab shows "Double Assassin" drill

**Expected:** Coach drills now have stats context behind them

**What Could Go Wrong:**
- ❌ Coach tab shows "No routine yet" → Coach endpoint broken
  - **Fix:** Coach endpoint is separate, shouldn't be affected
  - **Verify:** `/api/players/:id/practice-routine` still works
- ❌ Stats don't match between stats tab and coach → They're calculated separately
  - **Note:** Stats and coach use same data but coach may round differently

---

## Debugging Steps

### If Stats Tab Shows Empty/Error

1. **Check browser console (F12):**
   - Look for network errors
   - Look for JavaScript errors
   - Copy full error message

2. **Check Render logs:**
   ```
   Dashboard → Services → TKDL → Logs
   # Search for "stats" or "error"
   ```

3. **Test API directly in browser console:**
   ```javascript
   const playerId = 16; // Your ID
   const result = await fetch(`/api/players/${playerId}/stats/categories`).then(r => r.json());
   console.log(result);
   // Should show array of game types
   ```

4. **Check if stats routes registered:**
   ```javascript
   // In api-server/src/routes/index.ts, should have:
   // import statsDetailedRouter from './stats-detailed';
   // app.use(statsDetailedRouter);
   ```

### If Darts Tab Always Empty

1. **Check practice session dartLog:**
   ```sql
   -- In Neon console, run:
   SELECT id, session_data->'dartLog' as dartlog 
   FROM practice_sessions 
   LIMIT 1;
   -- Should see array like: [{"val":20,...}, {"val":19,...}, ...]
   ```

2. **If dartLog is null/empty:** Practice session recording not capturing darts
   - **Fix:** Ensure practice mode is saving dartLog to session_data

### If Time Window Not Working

1. **Test API with window param:**
   ```javascript
   const result = await fetch(`/api/players/16/stats/category/League?window=7days`).then(r => r.json());
   console.log(result); // Should only show recent stats
   ```

2. **Check if window parameter is passed:**
   - Open Network tab (F12)
   - Click stats category
   - Look at requests
   - Should see `?window=all` (or selected window) in URL

---

## Commit Status

**Branch:** main  
**Latest Commits:**
```
b61a5cc - feat: Add comprehensive stats to player-detail page
dccdd6a - feat: Integrate new CategoryStats component into account page
c2c5eaf - feat: Rebuild stats system with game-type segmentation
```

**To revert if needed:**
```bash
git revert HEAD~2  # Revert last 2 stats commits
git push origin main
```

---

## Monitoring Post-Deploy

### Performance

- Stats tab should load in **<1 second** for categories with data
- Empty categories should show "No data available" instantly
- Trends queries might take **1-2 seconds** (they calculate 12 months)

**If slow:**
1. Check Render CPU usage (might be overloaded)
2. Check database query times in Neon console
3. Consider adding indexes if queries are slow

### Data Correctness

- **Sample test:** Go to Account > Stats > League tab
- Compare "Matches" count to your actual played games
- Should match exactly (or be within 1-2 if new games added during load)

**If mismatched:**
1. Check matches table has correct winner_id/loser_id
2. Verify game_type field is populated
3. Confirm played_at timestamps are reasonable

---

## Next Enhancements (After Validation)

### 1. Coach Stat Display (High Priority)
Integrate stats callback to show recommendations:
```typescript
// In CategoryStats, when checkoutRate < 30%:
onCoachWeakness("Practice", "checkoutRate", 28.5);

// Parent (account.tsx) listens:
const [coachRecommendations, setCoachRecommendations] = useState([]);
const handleCoachWeakness = (cat, metric, value) => {
  setCoachRecommendations([...coachRecommendations, { cat, metric, value }]);
  // Display banner: "Coach says: Your checkout rate is low. Try Double Assassin drill"
};
```

### 2. Game Type Icons
Add visual icons to categories:
```typescript
const CategoryIcon = { M501: "🎯", Tour: "🏆", Practice: "💪", League: "⚡" };
// Display in category button as: "🎯 M501"
```

### 3. Session Detail Modal
Click a session to expand full dart log:
```typescript
// Click session → opens modal showing:
// - Full dart log (all darts, not just first 100)
// - Checkout analysis (if applicable)
// - Duration and performance metrics
```

### 4. Advanced Filtering
- Date range picker (not just 7d/30d/90d)
- Head-to-head: "vs Player X" stats
- Game variant: "501 Double Out" vs "501 Open In"

### 5. Admin Dashboard
- League-wide stats (most improved, highest rated, etc.)
- Player tier distribution
- Game type popularity

---

## Questions Checklist Before Testing

- [ ] Render service ID correct? (srv-d8i44sq8qa3s73e2fri0)
- [ ] GitHub repo connected to Render? (should auto-deploy on main push)
- [ ] Have you played matches/practice recently? (so there's test data)
- [ ] Know your player_id? (should be 16 for Graeme)
- [ ] Have Neon database credentials if you need to debug? (check Render env)

---

## Quick Reference: File Changes

| File | Change | Lines |
|------|--------|-------|
| `stats-service.ts` | Rewrite with game-type methods | ~300 new |
| `stats-detailed.ts` | Rewrite routes for categories | ~140 new |
| `category-stats.tsx` | New component (MAIN) | 380 new |
| `account.tsx` | Integrate CategoryStats | -50, +5 |
| `player-detail/index.tsx` | Add stats tab | +18 |
| `stats/index.ts` | Export CategoryStats | +1 |

---

## Support

If something breaks after deploy:

1. **Check error message** → Copy full error
2. **Check Render logs** → Dashboard → Logs tab
3. **Test API directly** → Browser console with `fetch()`
4. **Revert if critical** → `git revert` and push

**Most likely issues:**
- ❌ Build failed → Check Render build logs (usually TypeScript error)
- ❌ API 500 error → Check database connection in Neon
- ❌ No data shown → Check if player has matches/sessions

---

## Deployment Checklist

- [ ] All code committed to main
- [ ] Local tests pass (no TS errors)
- [ ] Ready to push to GitHub
- [ ] Monitor Render deploy (3-5 min)
- [ ] Test live site (5-10 min)
- [ ] Verify stats show correct data (5 min)
- [ ] Check coach integration (2 min)
- [ ] Document any issues found

**Total time:** ~20-30 minutes

---

**Last Updated:** June 22, 2026  
**Ready for Deployment:** YES ✅  
**Estimated Live Time:** 5 minutes after push  

Good luck! Let me know what you find during testing.
