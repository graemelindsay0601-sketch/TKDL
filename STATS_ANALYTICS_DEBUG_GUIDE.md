# Stats/Analytics Debugging Guide

**Status:** Endpoints exist and are properly configured, but may return empty data for users with no match history

## Issue Summary
The Stats and Analytics tabs in player profile show loading UI but display "No data available" message instead of actual stats.

## Architecture Overview

### Frontend Components
- **Stats Tab:** `CategoryStatsEnhanced` component (`src/components/stats/category-stats-enhanced.tsx`)
- **Analytics Tab:** `AdvancedAnalyticsDashboard` component (`src/components/stats/advanced-analytics.tsx`)

### Backend Endpoints
All endpoints defined in `src/routes/stats-detailed.ts`:
- `GET /api/players/{playerId}/stats/categories` - Game type breakdown
- `GET /api/players/{playerId}/stats/category/{category}` - Detailed stats for category
- `GET /api/players/{playerId}/stats/category/{category}/trends` - Monthly trends
- `GET /api/players/{playerId}/stats/category/{category}/darts` - Dart profile
- `GET /api/players/{playerId}/stats/category/{category}/sessions` - Session history

### Backend Service
`statsService` in `src/services/stats-service.ts` implements the actual data queries against the PostgreSQL database.

## How Stats Data Flows

1. **User visits Stats tab** (account.tsx line 1995)
   - Calls `CategoryStatsEnhanced` component with `playerId`

2. **Component fetches categories** (useEffect at line 67)
   - Fetches `/api/players/{playerId}/stats/categories?window={window}`
   - Sets `breakdown` state

3. **Component fetches category details** (useEffect at line 80)
   - Fetches 5 endpoints in parallel when `selectedCategory` changes
   - Sets `categoryStats`, `trends`, `dartProfile`, `sessions`, `coachDrills`

4. **Component renders**
   - Shows loading state while fetching
   - Renders tabs for different views (overall, trends, darts, sessions)
   - Shows "No data available" if no data returned

## Debugging Steps

### 1. Check API Responses (Browser DevTools)
- Open the Stats tab in player profile
- Open DevTools → Network tab
- Look for requests to `/api/players/{playerId}/stats/categories`
- Check the response body:
  - **Empty array `[]`?** → User has no matches in that game type
  - **Error status (500)?** → Backend error (see logs)
  - **No requests at all?** → Component not calling API (check console)

### 2. Check Backend Logs (Render)
- Visit: https://dashboard.render.com
- Find the TKDL API service
- Scroll to "Logs"
- Search for:
  - `"Failed to get category breakdown"` - stats query error
  - `"stats service"` - any related errors
  - Check if any SQL errors are logged

### 3. Verify Database Connection
Run this query directly in Neon PostgreSQL dashboard:
```sql
SELECT COUNT(*) FROM matches WHERE winner_id = {playerId} OR loser_id = {playerId};
```
- If result is 0, user has never played
- If result is high but stats tab shows nothing, database connection might be failing

### 4. Check Component Rendering
In browser console:
```javascript
// Check if CategoryStatsEnhanced component is mounted
// Look for console.error messages from the component
```

## Common Issues & Solutions

### Issue: "No data available" for active users
**Cause:** User has matches but stats endpoint returns empty array

**Solution:**
- Check if `matches` table has records for the user
- Verify the `statsService.getGameTypeBreakdown()` query is correct
- Check if `game_type` column has values (could be NULL)

**Test Query:**
```sql
SELECT game_type, COUNT(*) FROM matches 
WHERE winner_id = {playerId} OR loser_id = {playerId}
GROUP BY game_type;
```

### Issue: Stats tab never loads (spinning forever)
**Cause:** API endpoint timing out or network error

**Solution:**
- Check backend logs for timeout errors
- Verify database connection pool isn't exhausted
- Check if query is taking too long (add LIMIT or optimize WHERE clause)

**Monitor:** Open DevTools → Network tab, wait 30+ seconds to see if request completes

### Issue: Wrong stats displayed
**Cause:** Logic error in `statsService` methods

**Solution:**
- Audit the SQL logic in `getCategoryStats()` at line 77
- Verify `winner_darts`, `loser_darts` columns exist in matches table
- Check rounding/calculation logic

## Manual Testing Checklist

- [ ] Create test player with some matches
- [ ] Visit player profile → Stats tab
- [ ] Verify categories load (breakdown should show)
- [ ] Select each category and verify detailed stats load
- [ ] Check that numbers make sense (win %, checkout rate, etc.)
- [ ] Try different time windows (7 days, 30 days, 90 days, all)
- [ ] Verify similar flow works in Analytics tab

## If All Else Fails

1. **Temporarily bypass the component** to isolate issue:
   - Comment out `<CategoryStatsEnhanced>` in account.tsx
   - Replace with a simple `<div>Stats disabled for debugging</div>`
   - Deploy and verify the rest of the page works
   - This confirms the component is the issue, not page structure

2. **Add comprehensive logging:**
   - Add `console.log()` statements in `CategoryStatsEnhanced` useEffect
   - Log API response before/after processing
   - Deploy temporary debug version to Render
   - Reproduce issue and check browser console

3. **Direct API testing:**
   - Use curl or Postman to test endpoint directly:
     ```bash
     curl "https://tkdl-wt7y.onrender.com/api/players/16/stats/categories"
     ```
   - Paste response here to analyze

## Related Files
- Frontend: `artifacts/tkdl/src/components/stats/category-stats-enhanced.tsx`
- Backend routes: `artifacts/api-server/src/routes/stats-detailed.ts`
- Backend service: `artifacts/api-server/src/services/stats-service.ts`
- DB schema: Check `matches` table structure for required columns
