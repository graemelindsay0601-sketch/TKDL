import { Router } from "express";
import { db } from "@workspace/db";
import { createCareerService } from "../career/service.ts";
import { createCareerRouter } from "../career/router.ts";
import { createCareerCalendarRouter } from "../career/calendar/router.ts";
import { createCareerFinanceService } from "../career/finance/service.ts";
import { createCareerFinanceRouter } from "../career/finance/router.ts";

const saves = createCareerService(db);
// A4: the calendar service is constructed with the finance hooks, so A3 entry/withdraw/advance carry their financial effects atomically.
const finance = createCareerFinanceService(db);
const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
const router = Router();
router.use(createCareerFinanceRouter(finance, available));
router.use(createCareerCalendarRouter(finance.calendar, available));
router.use(createCareerRouter(saves));
export default router;
