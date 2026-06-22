# PUSH NOTIFICATIONS - IMPLEMENTATION PLAN

**Scope:** Mobile push notifications with smart batching, notification history, analytics, and admin controls  
**Estimated Time:** 6-8 hours (split into phases)  
**Status:** Ready to build  

---

## 📋 **FEATURES TO BUILD**

### **Phase 1: Core Notifications** (2-3 hours)
- [ ] Database schema for notifications
- [ ] API endpoints (create, get, mark read)
- [ ] Web Push notification sending
- [ ] Smart batching logic
- [ ] Quiet hours (11pm-8am)

### **Phase 2: Player Profile Integration** (1-2 hours)
- [ ] Notification history in player profile
- [ ] Notification preferences UI (per-type toggles)
- [ ] Mark as read/unread
- [ ] Delete old notifications

### **Phase 3: Admin Features** (1.5-2 hours)
- [ ] Admin announcement feature
- [ ] Send to all players or specific player
- [ ] Admin notification preview/test
- [ ] View sent announcements

### **Phase 4: Analytics** (1-2 hours)
- [ ] Track notification opens/clicks
- [ ] Track if notification led to login
- [ ] Dashboard showing engagement metrics
- [ ] Which notification types work best

### **Phase 5: Rate Limiting Override** (0.5 hours)
- [ ] Critical announcement flag
- [ ] Override quiet hours if critical
- [ ] Override daily limit if critical

---

## 🗄️ **DATABASE SCHEMA**

```sql
-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'match_result', 'rank_change', 'coach_tip', 'announcement'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,  -- { "match_id": 123, "opponent": "Sean", "rank_change": +1, etc }
  read BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences per player
CREATE TABLE notification_preferences (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT true,
  match_results BOOLEAN DEFAULT true,
  rank_changes BOOLEAN DEFAULT true,
  coach_tips BOOLEAN DEFAULT true,
  announcements BOOLEAN DEFAULT true,
  private_mode BOOLEAN DEFAULT false,  -- Don't share notifications publicly
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web Push subscriptions
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

-- Notification batches (for batching multiple rank changes)
CREATE TABLE notification_batches (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'rank_changes', 'match_results'
  notifications JSONB,  -- [ { id: 123, title: "..." }, ... ]
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification analytics
CREATE TABLE notification_analytics (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  clicked_link TEXT,
  logged_in_within_1hr BOOLEAN DEFAULT false,
  logged_in_within_24hr BOOLEAN DEFAULT false
);

-- Admin announcements
CREATE TABLE admin_announcements (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES players(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_players JSONB,  -- null = all players, or { "player_ids": [1,2,3] }
  critical BOOLEAN DEFAULT false,  -- Override quiet hours
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔌 **API ENDPOINTS**

```
POST /api/notifications/subscribe
  - Register for push notifications
  - Body: { endpoint, auth, p256dh }
  - Returns: { ok: true }

GET /api/notifications
  - Get notification history
  - Query: ?limit=20&offset=0
  - Returns: [ { id, title, body, read, created_at, data }, ... ]

PATCH /api/notifications/:id/read
  - Mark notification as read
  - Returns: { ok: true }

DELETE /api/notifications/:id
  - Delete notification
  - Returns: { ok: true }

PATCH /api/players/:id/notification-prefs
  - Update notification preferences
  - Body: { match_results: true, rank_changes: true, ... }
  - Returns: { ok: true }

GET /api/players/:id/notification-prefs
  - Get notification preferences
  - Returns: { match_results: true, rank_changes: true, ... }

POST /api/admin/announcements
  - Create announcement (admin only)
  - Body: { title, body, target_players, critical }
  - Returns: { id, created_at }

GET /api/admin/announcements
  - Get announcement history (admin only)
  - Returns: [ { id, title, body, sent, sent_at }, ... ]

POST /api/admin/announcements/:id/preview
  - Send test announcement to admin
  - Returns: { ok: true, sent_to: "your_device" }

GET /api/admin/notifications/analytics
  - Get notification analytics (admin only)
  - Returns: { total_sent, total_opened, open_rate, click_rate, ... }
```

---

## 🎯 **NOTIFICATION TRIGGERS**

**1. Match Result Notification**
- When: Match completed
- Who: The player who played
- What: "Beat [Opponent] • ±ELO • Now [Rank]"
- Batching: Send immediately

**2. Rank Change Notification**
- When: After each match
- Who: Anyone whose rank changed
- What: "You're now [Rank]. [Opponent] passed you" or "You passed [Player]"
- Batching: Batch multiple changes per day, send once at end of day

**3. Threat Alert Notification**
- When: Someone gets within 15 points of you
- Who: Threatened player
- What: "[Player] is [X] points away from [Your Rank]"
- Batching: Max 1 per day

**4. Coach Tip Notification**
- When: Sunday 12pm
- Who: All players
- What: Personalized coaching message
- Batching: Scheduled, not batched

**5. Admin Announcement**
- When: Admin sends it
- Who: All players (or selected)
- What: Admin text
- Batching: Send immediately (critical flag overrides quiet hours)

---

## 🔧 **IMPLEMENTATION ORDER**

1. **Database & Schema** ← Start here
2. **Web Push Setup** ← Service worker updates
3. **Notification Creation** ← API to create/send notifications
4. **Player Profile UI** ← History + preferences
5. **Admin Dashboard** ← Send announcements + test
6. **Analytics** ← Track engagement
7. **Batching Logic** ← Smart grouping of notifications
8. **Testing** ← Verify on mobile

---

## ✅ **WHEN COMPLETE**

Players will:
- Get push notification when they play a match
- Get notification if their rank changes
- Get threat alert if someone is close
- Get coach tip every Sunday
- Be able to see notification history in their profile
- Be able to turn off notification types
- Not get spammed (batched, quiet hours, rate limited)

Admins will:
- Send announcements to players
- Test announcements before sending
- See analytics on which notifications work
- Override quiet hours for critical announcements

---

**Ready to build?** Let me know and I'll start with Phase 1! 🚀
