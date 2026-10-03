import { db } from "@workspace/db";
import { createCareerService } from "../career/service.ts";
import { createCareerRouter } from "../career/router.ts";

export default createCareerRouter(createCareerService(db));
