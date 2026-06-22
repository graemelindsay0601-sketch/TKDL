# TKDL Stats System — API Contracts & Data Structures

## API Response Formats

### 1. GET `/api/players/:id/stats/categories?window=all`

**Purpose:** Get breakdown of all game types, grouped by category (M501, Tour, Practice, League)

**Response:**
```json
[
  {
    "gameType": "501",
    "gameTypeName": "501 - League",
    "category": "League",
    "matches": 45,
    "wins": 28,
    "losses": 17,
    "winRate": 0.6222,
    "totalDarts": 2850,
    "total180s": 12,
    "checkoutHits": 87,
    "checkoutAttempts": 156,
    "checkoutRate": 0.5577
  },
  {
    "gameType": "master_501",
    "gameTypeName": "Master 501",
    "category": "M501",
    "matches": 18,
    "wins": 9,
    "losses": 9,
    "winRate": 0.5,
    "totalDarts": 1080,
    "total180s": 4,
    "checkoutHits": 35,
    "checkoutAttempts": 62,
    "checkoutRate": 0.5645
  },
  {
    "gameType": "tour_event",
    "gameTypeName": "Tour Event",
    "category": "Tour",
    "matches": 3,
    "wins": 2,
    "losses": 1,
    "winRate": 0.6667,
    "totalDarts": 180,
    "total180s": 1,
    "checkoutHits": 8,
    "checkoutAttempts": 12,
    "checkoutRate": 0.6667
  }
]
```

---

### 2. GET `/api/players/:id/stats/category/League?window=90days`

**Purpose:** Get detailed stats for one category (competitive or practice)

**Response (Competitive - League, M501, Tour):**
```json
{
  "category": "League",
  "source": "competitive",
  "matches": 28,
  "wins": 17,
  "losses": 11,
  "winRate": 0.6071,
  "totalDarts": 1680,
  "avgDartsPerMatch": 60.0,
  "total180s": 8,
  "checkoutHits": 52,
  "checkoutAttempts": 94,
  "checkoutRate": 0.5532
}
```

**Response (Practice):**
```json
{
  "category": "Practice",
  "source": "practice",
  "sessions": 42,
  "totalDarts": 5250,
  "avgDartsPerSession": 125.0,
  "total180s": 18,
  "checkoutHits": 142
}
```

---

### 3. GET `/api/players/:id/stats/category/League/trends`

**Purpose:** Monthly trend data for a category

**Response:**
```json
[
  {
    "month": "Apr 2026",
    "matches": 8,
    "wins": 5,
    "winRate": 0.625
  },
  {
    "month": "May 2026",
    "matches": 12,
    "wins": 8,
    "winRate": 0.6667
  },
  {
    "month": "Jun 2026",
    "matches": 7,
    "wins": 4,
    "winRate": 0.5714
  }
]
```

---

### 4. GET `/api/players/:id/stats/category/Practice/darts`

**Purpose:** Hit frequency for dart targets (for targeting pattern analysis)

**Response:**
```json
{
  "mostFrequentTargets": [
    { "target": 20, "hits": 1842, "frequency": 23.4 },
    { "target": 19, "hits": 1205, "frequency": 15.3 },
    { "target": 18, "hits": 987, "frequency": 12.5 },
    { "target": 17, "hits": 654, "frequency": 8.3 },
    { "target": 16, "hits": 502, "frequency": 6.4 }
  ],
  "allTargetFrequencies": [
    { "target": 20, "hits": 1842, "frequency": 23.4 },
    { "target": 19, "hits": 1205, "frequency": 15.3 },
    { "target": 18, "hits": 987, "frequency": 12.5 },
    // ... 25, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
  ]
}
```

---

### 5. GET `/api/players/:id/stats/category/Practice/sessions?limit=50`

**Purpose:** Recent practice/competitive sessions in this category

**Response:**
```json
[
  {
    "id": 452,
    "gameType": "Solo X01 (501)",
    "category": "Practice",
    "dartsThrown": 186,
    "durationSeconds": 1440,
    "p1Score": 0,
    "p1_180s": 2,
    "p1CheckoutHits": 1,
    "p1CheckoutAttempts": 3,
    "createdAt": "2026-06-22T14:30:00Z",
    "detail": null
  },
  {
    "id": 451,
    "gameType": "Solo X01 (501)",
    "category": "Practice",
    "dartsThrown": 165,
    "durationSeconds": 1200,
    "p1Score": 0,
    "p1_180s": 1,
    "p1CheckoutHits": 2,
    "p1CheckoutAttempts": 2,
    "createdAt": "2026-06-21T18:45:00Z",
    "detail": null
  }
]
```

---

### 6. GET `/api/players/:id/stats/sessions/:sessionId`

**Purpose:** Detailed view of a single practice session with dart log

**Response:**
```json
{
  "id": 452,
  "gameType": "Solo X01 (501)",
  "category": "Practice",
  "dartsThrown": 186,
  "durationSeconds": 1440,
  "p1Score": 0,
  "p1_180s": 2,
  "p1CheckoutHits": 1,
  "p1CheckoutAttempts": 3,
  "createdAt": "2026-06-22T14:30:00Z",
  "dartLog": [
    20, 20, 20,  // First visit: 60
    19, 18, 17,  // Second visit: 54
    // ... truncated to first 100 darts
  ],
  "avgDartValue": 18.6
}
```

---

### 7. GET `/api/players/:id/stats/coach-feed`

**Purpose:** Metrics extracted for coach system integration

**Response:**
```json
{
  "totalDarts": 5250,
  "checkoutAttempts": 94,
  "checkoutHits": 52,
  "checkoutRate": 55.32,
  "totalSessions": 42,
  "avgThreeDart": 71.4
}
```

**Coach uses this for drill generation:**
- If `checkoutRate < 30%` → "Double Assassin" drill (critical or high priority)
- If `checkoutRate < 28%` and `totalDarts > 200` → high priority doubles work
- If `avgThreeDart < 72` and `treblePct < 24%` → "Treble Zone" drill
- If `totalSessions < 5` → needs more data

---

## CategoryStats Component Props & Behavior

### Props Interface
```typescript
interface CategoryStatsProps {
  playerId: number;
  onCoachWeakness?: (category: GameTypeCategory, metric: string, value: number) => void;
}
```

### Internal State
```typescript
type GameTypeCategory = "M501" | "Tour" | "Practice" | "League";
type StatTab = "overall" | "trends" | "darts" | "sessions";

// Managed by component:
- selectedCategory: GameTypeCategory  // M501, Tour, Practice, or League
- selectedTab: StatTab                // Overall, Trends, Darts, or Sessions
- window: TimeWindow                  // 7days, 30days, 90days, or all
- breakdown: CategoryBreakdown[]       // All game types by category
- categoryStats: CategoryStats | null  // Current category's stats
- trends: array                        // Monthly breakdown
- dartProfile: object                  // Hit frequencies
- sessions: array                      // Recent sessions
- loading: boolean
```

### User Interactions
1. **Select Category:** Click League/M501/Tour/Practice → fetches new data
2. **Select Subtab:** Click Overall/Trends/Darts/Sessions → shows different view
3. **Time Window:** Click 7d/30d/90d/All → refetches all data with new window
4. **Session Expand:** (Future) Click session to see full dart log

---

## CategoryStats Render Output

### When selectedTab = "overall"

**Competitive (League/M501/Tour):**
```
┌─────────────────────────────────────────────────────────┐
│ [Window Selector: 7d | 30d | 90d | All]                │
├─────────────────────────────────────────────────────────┤
│ [League] [M501] [Tour] [Practice]  ← Category buttons   │
├─────────────────────────────────────────────────────────┤
│ Stats for: 501 (46G) | Master 501 (18G) | Cricket (8G) │
├─────────────────────────────────────────────────────────┤
│ [Overall] [Trends] [Darts] [Sessions]  ← Subtabs       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ MATCHES  │ │ WIN RATE │ │ AVG      │ │ 180s     │   │
│  │    45    │ │  62.2%   │ │ DARTS    │ │   12     │   │
│  │          │ │          │ │  60.0    │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌──────────┐                                            │
│  │CHECKOUT %│                                            │
│  │  55.8%   │                                            │
│  │ 87/156   │                                            │
│  └──────────┘                                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Practice:**
```
Similar layout but shows:
- Sessions (count)
- Total Darts
- Avg Per Session
- 180s (count)
```

### When selectedTab = "trends"

```
┌─────────────────────────────────────────────────────────┐
│ Apr 2026  8 games • 5W • 62.5%                           │
├─────────────────────────────────────────────────────────┤
│ May 2026  12 games • 8W • 66.7%                          │
├─────────────────────────────────────────────────────────┤
│ Jun 2026  7 games • 4W • 57.1%                           │
└─────────────────────────────────────────────────────────┘
```

### When selectedTab = "darts"

```
┌─────────────────────────────────────────────────────────┐
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│ │   20   │ │   19   │ │   18   │ │   17   │ │   16   │  │
│ │23.4%   │ │15.3%   │ │12.5%   │ │ 8.3%   │ │ 6.4%   │  │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
│                                                           │
│ Most common targets: 20, 19, 18, 17, 16                │
└─────────────────────────────────────────────────────────┘
```

### When selectedTab = "sessions"

```
┌─────────────────────────────────────────────────────────┐
│ Solo X01 (501)                                           │
│ 2026-06-22 • 186 darts • 2 × 180s                        │
├─────────────────────────────────────────────────────────┤
│ Solo X01 (501)                                           │
│ 2026-06-21 • 165 darts • 1 × 180s                        │
├─────────────────────────────────────────────────────────┤
│ ... up to 10 recent sessions                             │
└─────────────────────────────────────────────────────────┘
```

---

## Coach Integration Example

**Scenario:** Player views their Practice stats
1. Frontend loads CategoryStats for Practice category
2. Component calls `/api/players/:id/stats/coach-feed`
3. API returns: `{ checkoutRate: 28.5, totalSessions: 8, avgThreeDart: 68.2 }`
4. Component callback: `onCoachWeakness("Practice", "checkoutRate", 28.5)`
5. Parent (account.tsx) can then display:
   ```
   ⚠️ Coach identified: Your checkout rate is low in Practice.
   📖 Recommended Drill: Double Assassin (15 min focus on doubles)
   ```

---

## Time Window Behavior

All endpoints support `?window=7days|30days|90days|all`

- **7days:** Last 7 calendar days
- **30days:** Last 30 calendar days  
- **90days:** Last 90 calendar days
- **all:** All time (since player joined)

**Trends tab always shows:** Last 12 months (fixed, not affected by window)

---

## Error Handling

If a request fails, CategoryStats component:
1. Sets `loading = false`
2. Logs error to console
3. Renders "No data available" placeholder
4. User can click another category or try again

Example empty states:
- No matches in League for selected window → "No data available"
- No practice sessions logged → "No sessions in this category"
- No dartLog in practice sessions → "No dart data available"

---

## Testing Examples

### Quick Test 1: View Your Own Stats (Account Page)

```bash
# Login as your account
# Visit https://tkdl-wt7y.onrender.com
# Click Account → Stats tab
# Should see League stats first
# Click M501, Tour, Practice tabs to verify each loads
# Try time window filter buttons
```

### Quick Test 2: View Player Stats (Player Detail Page)

```bash
# Go to Players list
# Click on any player
# Click "Stats" tab (new yellow tab)
# Should see their stats breakdown by category
```

### Quick Test 3: Coach Data Integration

```bash
# In browser console:
await fetch('/api/players/16/stats/coach-feed').then(r => r.json()).then(d => console.log(d))

# Expected:
{
  totalDarts: 5250,
  checkoutAttempts: 94,
  checkoutHits: 52,
  checkoutRate: 55.32,
  totalSessions: 42,
  avgThreeDart: 71.4
}
```

---

## Performance Notes

- **CategoryBreakdown endpoint:** Queries all game types (fast, indexed on winner_id/loser_id)
- **Category stats:** Queries matches OR practice_sessions (filtered, indexed)
- **Trends:** Month-based grouping, fast with index on played_at
- **Dart profile:** Parses jsonb column, slower if many sessions (but limited to practice only)
- **Sessions:** Simple select with limit, very fast

**Caching opportunity:** Could cache trends/dart profiles for 1 hour if performance needed.

---

**Last Updated:** June 22, 2026 during stats rebuild  
**Component Version:** 1.0 (Initial Release)  
**API Version:** 2.0 (Game-type segmented)
