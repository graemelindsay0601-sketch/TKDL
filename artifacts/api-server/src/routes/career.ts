import { Router } from "express";
import { db } from "@workspace/db";
import { createCareerService } from "../career/service.ts";
import { createCareerRouter } from "../career/router.ts";
import { createCareerCalendarRouter } from "../career/calendar/router.ts";
import { createCareerFinanceRouter } from "../career/finance/router.ts";
import { createCareerSportingService } from "../career/sporting/service.ts";
import { createCareerSportingRouter } from "../career/sporting/router.ts";
import { createCareerLiveMatchService } from "../career/live/service.ts";
import { createCareerLiveRouter } from "../career/live/router.ts";
import { createCareerIdentityService, createCareerIdentityRouter } from "../career/identity/service.ts";

import { createCareerFactsService } from "../career/facts/service.ts";
import { createCareerFactsRouter } from "../career/facts/router.ts";
import { createCareerRelationshipsService } from "../career/relationships/service.ts";
import { createCareerRelationshipsRouter } from "../career/relationships/router.ts";
import { createCareerGoalsService } from "../career/goals/service.ts";
import { createCareerGoalsRouter } from "../career/goals/router.ts";

const saves = createCareerService(db);
// A5 composes the Career: A3 calendar with A4 finance hooks and A5 sporting status/seeding/hooks,
// and A4 sponsorship reading A5 sporting facts. Every Career route uses this one composition.
const sporting = createCareerSportingService(db);
const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
// A6.5: live Career matches through the real scorer; results enter via A3's human-result boundary.
const live = createCareerLiveMatchService(db, sporting.calendar);
const router = Router();
router.use(createCareerFactsRouter(createCareerFactsService(db)));
router.use(createCareerRelationshipsRouter(createCareerRelationshipsService(db)));
router.use(createCareerGoalsRouter(createCareerGoalsService(db)));
// A6.5: Career identity endpoints + PROFILE_INCOMPLETE gate (first, so it guards sporting routes).
router.use(createCareerIdentityRouter(createCareerIdentityService(db), available));
router.use(createCareerLiveRouter(live, available));
router.use(createCareerSportingRouter(sporting, available));
router.use(createCareerFinanceRouter(sporting.finance, available));
router.use(createCareerCalendarRouter(sporting.calendar, available));
router.use(createCareerRouter(saves));
export default router;
