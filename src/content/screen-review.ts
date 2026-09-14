import { z } from "zod";
import raw from "./screen-review.json";

const text = z.string().trim().min(1);
const media = z
  .string()
  .regex(/^\/media\/[a-z0-9/_.-]+$/i)
  .refine((value) => !value.includes(".."));
export const screenReviewSchema = z
  .object({
    title: text,
    eyebrow: text,
    description: text,
    originalLabel: text,
    compositeLabel: text,
    original: media,
    composite: media,
    poster: media,
    compositePoster: media,
    notice: text,
    play: text,
    pause: text,
    scrub: text,
    replay: text,
    back: text,
    error: text,
    loading: text,
    detailsTitle: text,
    details: z.array(text).min(1),
    duration: z.number().positive().max(120),
    initialTime: z.number().nonnegative(),
    entranceTime: z.number().nonnegative(),
    seekStep: z.number().positive().max(1),
    synchronizationTolerance: z.number().positive().max(0.2),
    endTolerance: z.number().positive().max(0.2),
  })
  .refine(
    (value) =>
      value.original !== value.composite &&
      value.initialTime < value.duration &&
      value.entranceTime < value.duration,
  );
export const screenReview = screenReviewSchema.parse(raw);
