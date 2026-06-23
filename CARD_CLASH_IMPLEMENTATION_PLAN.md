# Card Clash Implementation Plan - Safe & Methodical

**Created:** June 23, 2026  
**Target Completion:** June 28, 2026 (5 days)  
**Current Status:** 70% complete, ready for scoring integration  
**Deployment Strategy:** Avoid cascading failures through careful testing

---

## 🎯 What Remains (The 30%)

### CRITICAL BLOCKER
**File:** `artifacts/tkdl/src/lib/scorers.tsx`
- Cards must appear during X01 matches
- Cards must appear during Cricket matches
- Card activation must trigger and apply effects
- Match completion must award coins with card usage tracked

**Estimate:** 20-24 hours focused work

---

## 📋 Implementation Phases (SAFE APPROACH)

### PHASE 1: Foundation & Testing Setup (2 hours)
**Goal:** Set up ability to test without deploying to production

**1.1 Create test configuration**
- [ ] Create `CARD_CLASH_DEV_MODE` feature flag in code
- [ ] Add dev-only logging for card effects
- [ ] Set up console debug mode to inspect card state
- **File:** `artifacts/tkdl/src/lib/card-debug.ts` (NEW)
- **Commit message:** "SETUP: Add Card Clash dev debugging tools"

**1.2 Verify test data**
- [ ] Check admin panel can seed test player with 100 coins
- [ ] Check admin panel can inject test cards into player inventory
- [ ] Verify equipment selector shows cards correctly
- **Testing:** Run locally, don't commit changes, just verify it works
- **No commit needed**

**1.3 Create safety checklist**
- [ ] Before each deploy, verify:
  - `package*.json` files list is correct (no package-lock.json)
  - No corrupted files in pip/node_modules
  - Service worker cache version incremented (if needed)
  - Git status is clean
  - Last 3 commits are documented
- **File:** Pre-commit hook or manual checklist

---

### PHASE 2: X01 Scorer Integration (8 hours)

**Goal:** Cards appear in X01 matches and can be activated

**2.1 Add CardActivationOverlay to X01Scorer**
- [ ] Import `CardActivationOverlay` into scorers.tsx
- [ ] Add state: `equippedCards: EquippedCard[]`
- [ ] Add state: `cardsUsed: Card[]`
- [ ] Pass to CardActivationOverlay component
- [ ] Component renders above score display
- **File:** `artifacts/tkdl/src/lib/scorers.tsx` (X01Scorer section)
- **Test:** Cards visible in X01 match, no crash
- **Commit message:** "FEAT: Add CardActivationOverlay to X01Scorer - visual only"

**2.2 Wire up card activation clicks**
- [ ] Add click handler in CardActivationOverlay
- [ ] Track which card was clicked
- [ ] Pass card ID to effect calculator
- [ ] Add safe error handling (card effect fails → log, don't crash)
- **File:** `artifacts/tkdl/src/lib/scorers.tsx` + component
- **Test:** Click card, see debug log in console
- **Commit message:** "FEAT: Wire up X01 card activation handlers"

**2.3 Integrate card effects into X01 scoring**
- [ ] Call `card-effects.ts` with GOOD/BAD card type
- [ ] Apply effect to player score or opponent score
- [ ] Update score display immediately
- [ ] Mark card as used in `cardsUsed` array
- [ ] Show visual feedback (card grayed out, confetti, etc.)
- **File:** `artifacts/tkdl/src/lib/scorers.tsx`
- **Test:** 
  - GOOD card → player score decreases correctly
  - BAD card → opponent score affected correctly
  - Card disappears from hand after use
- **Commit message:** "FEAT: Implement X01 card effect application"

**2.4 Test end-to-end for X01**
- [ ] Play full X01 match with cards
- [ ] Finish match
- [ ] Check coins awarded in results screen
- [ ] Verify formula: win 50 + (10 × cards_used)
- **Testing:** Manual only, sign in as test player
- **No commit** - just verification

**2.5 Deploy Phase 2**
- [ ] Verify checklist before deploy
- [ ] Monitor Render build logs for errors
- [ ] Test website loads
- [ ] Uninstall/reinstall PWA app
- [ ] Test on mobile
- **If error:** Immediately revert using `git revert HEAD`
- **Commit:** "DEPLOY: X01 Card Clash phase complete"

---

### PHASE 3: Cricket Scorer Integration (8 hours)

**Goal:** Cards work in Cricket matches (similar to X01)

**3.1 Add CardActivationOverlay to CricketScorer**
- [ ] Repeat steps 2.1 for CricketScorer
- [ ] Different UI layout (cards above cricket board)
- **File:** `artifacts/tkdl/src/lib/scorers.tsx` (CricketScorer section)
- **Test:** Cards visible, no crash
- **Commit message:** "FEAT: Add CardActivationOverlay to CricketScorer"

**3.2 Wire up Cricket card activation**
- [ ] Add click handlers for Cricket-specific cards
- [ ] Cards affect marks (0-3 per number), not score
- [ ] Apply GOOD cards to player, BAD to opponent
- **File:** `artifacts/tkdl/src/lib/scorers.tsx`
- **Test:** Click card, see debug log
- **Commit message:** "FEAT: Wire up Cricket card activation handlers"

**3.3 Integrate Cricket-specific effects**
- [ ] GOOD card effects: reopen closed (if allowed), add marks, etc.
- [ ] BAD card effects: remove marks, close numbers, etc.
- [ ] Handle Cricket rules strictly:
  - Marks can only be 0-3 (no over-marking)
  - Only 15-20 and 25/50 numbers exist
  - Closed numbers stay closed (can't reopen except by card)
- **File:** `artifacts/tkdl/src/lib/card-effects.ts` + scorers.tsx
- **Test:**
  - GOOD card → player marks increase/correct
  - BAD card → opponent marks affected
  - Never violates Cricket rules
- **Commit message:** "FEAT: Implement Cricket card effect application"

**3.4 Test end-to-end for Cricket**
- [ ] Play full Cricket match with cards
- [ ] Finish match
- [ ] Check coins awarded
- [ ] Verify no rule violations
- **Testing:** Manual only, test player
- **No commit**

**3.5 Deploy Phase 3**
- [ ] Run full checklist
- [ ] Monitor logs
- [ ] Test both website and PWA
- **Commit:** "DEPLOY: Cricket Card Clash phase complete"

---

### PHASE 4: Polish & Testing (4 hours)

**Goal:** Card Clash is fully functional and polished

**4.1 Error handling & edge cases**
- [ ] What if effect calculation fails mid-match?
- [ ] What if player has no cards equipped?
- [ ] What if card effect doesn't match game type?
- [ ] What if coins fail to award?
- **Add try-catch blocks** with proper logging
- **File:** `artifacts/tkdl/src/lib/scorers.tsx`
- **Commit message:** "FEAT: Add robust error handling for card effects"

**4.2 Visual polish**
- [ ] Card animations when played
- [ ] Smooth transitions
- [ ] Visual feedback on match completion
- [ ] Mobile responsiveness check
- **File:** CSS/component styling
- **Commit message:** "STYLE: Polish Card Clash UI and animations"

**4.3 Comprehensive testing**
- [ ] Test all card types (X01 GOOD/BAD, Cricket GOOD/BAD, Wildcards)
- [ ] Test edge cases
- [ ] Test on desktop and mobile
- [ ] Test offline (PWA mode)
- [ ] Test with different players
- **No code changes** - just testing

**4.4 Final documentation**
- [ ] Update BUILD_STATUS with completion notes
- [ ] Document any known issues or limitations
- [ ] Create user-facing documentation (how cards work)
- **Commit message:** "DOCS: Complete Card Clash documentation"

---

## 🛡️ Safety Guardrails to Prevent Failures

### Before Every Commit
```bash
✓ git status — must be clean
✓ ls package*.json — should only show package.json (or none)
✓ git log --oneline -1 — confirm last commit message is clear
✓ No console.errors or warnings (check locally first)
```

### Before Every Deploy
```bash
✓ Run checklist above
✓ Verify no corrupted files (no =version files, etc.)
✓ Verify service worker cache version if changed
✓ Check Render build command is correct
✓ Verify environment variables are set
✓ Monitor first 5 minutes of logs after deploy
✓ Test website loads without blank page
✓ Test PWA loads without blank page
```

### If Deploy Fails
```bash
1. STOP immediately
2. Check Render logs for error
3. Do NOT make more changes
4. Revert last commit: git revert HEAD
5. Push: git push origin main
6. Investigate root cause before next attempt
7. Document what went wrong
```

---

## 📊 Daily Progress Checklist

Use this to track work and update BUILD_STATUS daily:

```
DAY 1: Phase 1 Foundation
- [ ] Debug tools created
- [ ] Test data setup verified
- [ ] Safety checklist documented
- BUILD_STATUS: "Phase 1 complete"

DAY 2: Phase 2.1-2.2 X01 Visual + Activation
- [ ] CardActivationOverlay added to X01Scorer
- [ ] Cards render without crash
- [ ] Click handlers wired up
- BUILD_STATUS: "X01 cards visual, activation ready"

DAY 3: Phase 2.3-2.5 X01 Effects + Deploy
- [ ] Card effects applied to X01 scoring
- [ ] End-to-end test passed locally
- [ ] Deployed to Render
- [ ] PWA tested on mobile
- BUILD_STATUS: "X01 Card Clash working!"

DAY 4: Phase 3.1-3.3 Cricket Integration
- [ ] CardActivationOverlay in CricketScorer
- [ ] Cricket-specific effects implemented
- [ ] Tested locally
- BUILD_STATUS: "Cricket phase in progress"

DAY 5: Phase 3.4-4.4 Final Testing + Deploy
- [ ] End-to-end Cricket tests passed
- [ ] Error handling complete
- [ ] Polish complete
- [ ] Deployed and verified
- BUILD_STATUS: "CARD CLASH COMPLETE ✅"
```

---

## 🔍 How to Test Safely (Without Deploying)

### Local Testing Before Commit
```bash
1. Start dev server: pnpm dev
2. Login as test player (Player 16, admin)
3. Go to Card Clash
4. Seed coins: Use admin panel (100 coins)
5. Seed cards: Use admin panel inject
6. Equipment selector: Select 2 good + 2 bad
7. Start match: Play X01 or Cricket
8. Cards should appear on screen
9. Click card: Should apply effect
10. Finish match: Should award coins
11. Check console: No errors
12. If all pass → make commit
```

### Deployment Testing
```bash
1. Make commit with card changes
2. Push to GitHub
3. Monitor Render build for 5-10 minutes
4. Check website loads: https://tkdl-wt7y.onrender.com
5. Uninstall app from home screen
6. Hard refresh website
7. Reinstall app
8. Test feature on mobile
9. If issue: git revert HEAD && git push
10. If OK: Celebrate! Move to next phase
```

---

## ⚡ Quick Reference: What Each File Does

**Core Scoring (WHERE CARDS INTEGRATE):**
- `artifacts/tkdl/src/lib/scorers.tsx` — X01Scorer + CricketScorer components
- Cards render here, clicks handled here, effects applied here

**Card System:**
- `artifacts/api-server/src/lib/card-effects.ts` — Effect calculation logic
- `artifacts/tkdl/src/components/CardActivationOverlay.tsx` — Visual card UI
- `artifacts/tkdl/src/components/CardEquipmentSelector.tsx` — Selection before match

**Database & API:**
- `artifacts/api-server/src/routes/card-clash.ts` — API endpoints
- `lib/db/src/schema/card-definitions.ts` — Card data

**Don't Touch:**
- Service worker files (unless cache busting needed)
- Database schema (all tables exist)
- API routes (all endpoints exist)
- Card definitions (all 100 cards exist)

---

## 🎯 Definition of "Done"

Card Clash is complete when:
- ✅ Cards appear during X01 matches
- ✅ Cards appear during Cricket matches
- ✅ Clicking cards activates them
- ✅ Effects modify scores/marks correctly
- ✅ Match ends and coins awarded (win: 50 + 10×cards used, loss: 25 + 10×cards used)
- ✅ No console errors on desktop or mobile
- ✅ Works on PWA and website
- ✅ All rules enforced (Cricket marks 0-3, only 15-20+25/50, etc.)

---

## 📝 Commit Message Template

For this work, all commits should follow this pattern:

```
FEAT: [Feature name] - Card Clash phase X.Y

Description of what was added/changed/fixed.

Testing done:
- [What was tested]
- [How it was tested]
- [Any limitations]

Files changed:
- [Main files affected]

Next step:
- [What's next in the plan]
```

Example:
```
FEAT: Add CardActivationOverlay to X01Scorer - Phase 2.1

Added visual card display to X01 scoring screen. Cards render
above score display and are interactive.

Testing done:
- Verified cards render without crash in X01 match
- Confirmed no errors in console
- Tested on desktop and mobile PWA

Files changed:
- artifacts/tkdl/src/lib/scorers.tsx
- artifacts/tkdl/src/components/CardActivationOverlay.tsx

Next step:
- Wire up click handlers for card activation
```

---

## 🚀 How to Resume If Interrupted

If you get interrupted mid-work:

1. **Check BUILD_STATUS.md** for current phase
2. **Check last commit** to see what was done
3. **Read commit message** to understand context
4. **Continue from next step** in the plan
5. **Update progress** in BUILD_STATUS before moving on

For example, if Phase 2.1 is done but 2.2 isn't:
```bash
git log --oneline -3  # See what's done
cat TKDL_CARD_CLASH_BUILD_STATUS.md  # Check progress
# Continue with Phase 2.2 implementation
```

---

## ⚠️ Common Mistakes to Avoid

1. **Don't skip testing locally before deploying**
   - "It should work" is not testing
   - Always play a full match locally first

2. **Don't make 10 changes then test**
   - Make ONE change
   - Test it
   - Commit it
   - Move to next change

3. **Don't change multiple files without committing**
   - Each logical change = one commit
   - Easier to revert if something breaks

4. **Don't deploy without checking checklist**
   - "Seems fine" is not a checklist
   - Follow the safety guardrails
   - 5 minutes of checklist saves 5 hours of debugging

5. **Don't remove service worker cache version**
   - Installed PWAs won't update without it
   - Always increment cache version if files changed
   - Or add cache clearing logic like we did

---

**This plan is your blueprint. Follow it step-by-step, update BUILD_STATUS daily, and Card Clash will be done by end of week.**

**Current Stable Commit:** `e49a66c`  
**Ready to Start:** Phase 1, Day 1

Good luck! 🎯
