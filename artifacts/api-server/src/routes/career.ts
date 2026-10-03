import { Router } from "express";
import { db } from "@workspace/db";
import { createCareerService } from "../career/service.ts";
import { createCareerRouter } from "../career/router.ts";
import { createCareerCalendarService } from "../career/calendar/service.ts";
import { createCareerCalendarRouter } from "../career/calendar/router.ts";

const saves = createCareerService(db);
const router = Router();
router.use(createCareerCalendarRouter(createCareerCalendarService(db), isAdmin => saves.isAvailable(isAdmin)));
router.use(createCareerRouter(saves));
export default router;
