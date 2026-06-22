# Push Notifications Feature — Planning & Options

**Goal:** Keep players engaged with timely, relevant notifications  
**Complexity:** Medium (3-4 hours to build)  
**Impact:** High engagement boost  

---

## 📋 **NOTIFICATION TYPES TO CONSIDER**

### **Type 1: Match Notifications** ⚡
**When:** Player completes a match

**Options:**
- ✅ **A) Basic** — "You won vs Sean! +28 ELO"
- ✅ **B) Detailed** — "You won vs Sean! +28 ELO • 2x 180s • Checkout: 20"
- ✅ **C) Comparison** — "You beat Sean for the 3rd time • Now 3-1 vs him"

**Frequency:** Every match (high frequency)

---

### **Type 2: Streak Notifications** 🔥
**When:** Player hits milestones

**Options:**
- ✅ **A) Simple** — "🔥 3-match win streak!"
- ✅ **B) Achievement** — "🔥 3-match win streak! Next: 5 in a row"
- ✅ **C) Leaderboard** — "🔥 3-match streak • You're #2 on the leaderboard"

**Trigger Points:**
- [ ] Every 3 wins in a row?
- [ ] Every 5 wins?
- [ ] Milestones only (3, 5, 10, 20)?
- [ ] Personal records?

**Frequency:** Low-medium (a few per season)

---

### **Type 3: ELO Milestone Notifications** 📈
**When:** Player reaches ELO thresholds

**Options:**
- ✅ **A) Simple** — "You reached 1100 ELO!"
- ✅ **B) Tier** — "🏅 Gold Tier! (1100 ELO)"
- ✅ **C) Progress** — "Gold Tier! • 50 ELO to Platinum (1150)"

**Milestones:**
- [ ] Every 50 ELO?
- [ ] Every tier (Bronze 950, Silver 1000, Gold 1100, Platinum 1250, Diamond 1400)?
- [ ] Personal records?
- [ ] Both?

**Frequency:** Low (1-2 per season per player)

---

### **Type 4: Coach/Drill Notifications** 🎯
**When:** Coach recommends action

**Options:**
- ✅ **A) Simple** — "Coach recommends: Practice 180s (2x/week)"
- ✅ **B) Actionable** — "Coach: Your 180 rate is 12%. Try: Daily 180 drills"
- ✅ **C) Progress** — "Coach: Great work! 180 rate up to 14% 📈"

**When to Send:**
- [ ] Daily (if enabled)?
- [ ] Weekly summary?
- [ ] Only on significant changes?
- [ ] On request only?

**Frequency:** Configurable (0-7 per week)

---

### **Type 5: Achievement Notifications** 🏆
**When:** Player unlocks achievement

**Options:**
- ✅ **A) Simple** — "Achievement: "Unstoppable" unlocked!"
- ✅ **B) Details** — "Achievement: "Unstoppable" (5-match streak) unlocked!"
- ✅ **C) Rarity** — "🌟 Rare Achievement unlocked: "Unstoppable""

**Frequency:** Variable (depends on player activity)

---

### **Type 6: League Announcements** 📣
**When:** Admin sends announcement

**Options:**
- ✅ **A) Simple** — "New tournament season starts tomorrow"
- ✅ **B) Actionable** — "New tournament season starts tomorrow • Register now"
- ✅ **C) Personalized** — "New tournament: Spring 2026 • You're registered"

**Who Sends:** Admin only

**Frequency:** Low (a few per season)

---

### **Type 7: Head-to-Head Notifications** ⚔️
**When:** Player plays someone they compete with frequently

**Options:**
- ✅ **A) Simple** — "You're 2-1 vs Sean"
- ✅ **B) Prediction** — "vs Sean: You're 2-1 (60% win rate)"
- ✅ **C) Streak** — "vs Sean: 2-1 • Sean's on a 2-match streak vs you"

**Frequency:** Optional (every match vs frequent opponent?)

---

## 🎚️ **HOW TO DELIVER NOTIFICATIONS**

### **Option 1: Web Push Notifications** (Recommended)
**What:** Browser notifications (pops up on desktop/mobile)

**Pros:**
- ✅ Instant delivery
- ✅ Works even if app is closed
- ✅ High engagement
- ✅ Easy to implement (Web Push API)

**Cons:**
- ❌ Requires permission from user
- ❌ Users can disable
- ❌ Only works in modern browsers

**Implementation:** ~2 hours

---

### **Option 2: In-App Notifications** (Easy)
**What:** Notification bell icon with list

**Pros:**
- ✅ No permissions needed
- ✅ Easy to implement
- ✅ Full control over styling
- ✅ Players always see them

**Cons:**
- ❌ Only visible when app is open
- ❌ Lower engagement
- ❌ Polling required (every 30 seconds?)

**Implementation:** ~1.5 hours

---

### **Option 3: Email Notifications** (Optional)
**What:** Email summaries

**Pros:**
- ✅ Reaches players even if app never opens
- ✅ Good for weekly summaries

**Cons:**
- ❌ Slow (doesn't feel real-time)
- ❌ Requires email config
- ❌ Email fatigue risk

**Implementation:** ~3 hours

---

### **Option 4: SMS Notifications** (Advanced)
**What:** Text messages

**Pros:**
- ✅ Very high engagement

**Cons:**
- ❌ Requires Twilio/SMS service ($)
- ❌ High spam risk
- ❌ Complex

**Implementation:** ~5 hours + cost

---

## 🎯 **MY RECOMMENDATION**

**Start with:**
1. **Web Push Notifications** (primary) ← Most engaging
2. **In-App Notifications** (fallback) ← Works always

**Keep simple:**
- Match results (every match)
- Streaks (milestones)
- ELO tiers (thresholds)
- Achievements (auto-triggered)

**Don't include yet:**
- Coach recommendations (too complex)
- Announcements (needs admin UI)
- Head-to-head (too granular)
- Email/SMS (add later if needed)

---

## 🔧 **IMPLEMENTATION APPROACH**

### **Database Schema**
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  type TEXT NOT NULL,  -- 'match', 'streak', 'elo_tier', 'achievement'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,  -- {"match_id": 123, "opponent": "Sean", etc}
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  player_id INTEGER PRIMARY KEY,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  match_results BOOLEAN DEFAULT true,
  streaks BOOLEAN DEFAULT true,
  elo_tiers BOOLEAN DEFAULT true,
  achievements BOOLEAN DEFAULT true,
  -- Frequency settings
  batch_mode BOOLEAN DEFAULT false,  -- Get daily summary instead of real-time?
);
```

### **API Endpoints**
```
POST /api/notifications/subscribe
  - Register for push notifications (saves subscription token)

GET /api/notifications
  - Get notification history

PATCH /api/notifications/:id/read
  - Mark as read

PATCH /api/players/:id/notification-prefs
  - Update notification settings
```

### **Triggers**
```
1. Match Completion
   - Create notification
   - Send push if enabled
   - Add to in-app inbox

2. Streak Check
   - After each match, check if milestone hit
   - Send notification if yes

3. ELO Tier
   - After match ELO change, check tiers
   - Send notification if crossed threshold

4. Achievement Unlock
   - When achievement unlocked
   - Send immediately
```

---

## 📊 **QUESTIONS FOR YOU**

**Before we build, decide:**

### **1. Which notification types?**
- ✅ Match results (essential)
- ✅ Streaks (nice)
- ✅ ELO tiers (nice)
- ✅ Achievements (nice)
- ❓ Coach recommendations?
- ❓ Head-to-head?
- ❓ Admin announcements?

### **2. Which delivery methods?**
- **Web Push** (recommended) + **In-App** ← Full coverage
- **Web Push only** ← Simpler, higher engagement
- **In-App only** ← Easiest to build
- **All three** (Web Push + In-App + Email) ← Most coverage

### **3. Notification frequency?**
- **Real-time** — Instant on every event (match, streak, etc)
- **Batched** — Daily/weekly summary instead
- **Hybrid** — Real-time for major events, daily summary for others

### **4. User control?**
- **Simple toggle** — All on/off
- **Per-type control** — Enable/disable each type
- **Granular control** — Per-type + frequency + delivery method

### **5. Streak milestones?**
- **Every 3** (3, 6, 9, 12...)
- **Every 5** (5, 10, 15, 20...)
- **Major milestones** (3, 5, 10, 20)
- **Personal record** (if it's their personal best)

### **6. ELO tier notifications?**
- **Every 50 ELO** (detailed progress)
- **Tier boundaries** (Bronze→Silver→Gold, etc)
- **Both?**

---

## ⏱️ **BUILD TIME ESTIMATE**

**Minimal (In-App Only):** 1-2 hours
- In-app notification inbox
- Simple notification creation
- Mark as read

**Standard (Web Push + In-App):** 3-4 hours
- Web Push subscription
- Service Worker updates
- Both delivery methods

**Full Featured:** 5-6 hours
- All of above
- User preference panel
- Email (optional)
- Admin announcement feature

---

## 🚀 **NEXT STEPS**

**Answer these questions:**

1. What notification types? (match, streaks, ELO, achievements, +?)
2. Web Push + In-App or just In-App?
3. Real-time or batched?
4. How much user control?
5. Streak milestones (3/5/10/mixed)?
6. ELO thresholds (50/tier/both)?

**Then I'll:**
1. ✅ Build the backend (API + database)
2. ✅ Implement Web Push (if chosen)
3. ✅ Build in-app notification inbox
4. ✅ Add notification preferences UI
5. ✅ Test on tablet

---

**Ready to decide? What do you want?** 🎯
