import { z } from "zod";
import { CAREER_DEFAULTS, CAREER_DIFFICULTIES, CAREER_SLOTS } from "./config.ts";

export const createCareerSchema = z.object({
  slot: z.number().int().refine(value => CAREER_SLOTS.some(slot => slot === value), "Slot must be 1, 2 or 3"),
  difficulty: z.enum(CAREER_DIFFICULTIES).default(CAREER_DEFAULTS.difficulty),
  careerName: z.string().trim().min(1).max(80).optional(),
}).strict();

export const careerIdSchema = z.string().uuid();
export const emptyCareerBodySchema = z.object({}).strict();
export type CreateCareerInput = z.infer<typeof createCareerSchema>;
