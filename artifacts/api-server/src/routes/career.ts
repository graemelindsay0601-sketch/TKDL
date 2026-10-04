import { Router } from "express";
import { db } from "@workspace/db";
import { createCareerService } from "../career/service.ts";
import { createCareerRouter } from "../career/router.ts";
import { createCareerCalendarRouter } from "../career/calendar/router.ts";
import { createCareerFinanceRouter } from "../career/finance/router.ts";
import { createCareerSportingService } from "../career/sporting/service.ts";
import { createCareerSportingRouter } from "../career/sporting/router.ts";

const saves = createCareerService(db);
// A5 composes the Career: A3 calendar with A4 finance hooks and A5 sporting status/seeding/hooks,
// and A4 sponsorship reading A5 sporting facts. Every Career route uses this one composition.
const sporting = createCareerSportingService(db);
const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
const router = Router();
router.use(createCareerSportingRouter(sporting, available));
router.use(createCareerFinanceRouter(sporting.finance, available));
router.use(createCareerCalendarRouter(sporting.calendar, available));
router.use(createCareerRouter(saves));
export default router;
