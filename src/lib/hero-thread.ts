/**
 * Pure rules for the homepage hero: how far the care thread has travelled, and how a change of
 * position is sequenced so the line appears to move through the moments one after another.
 */

import { z } from "zod";

export type MomentState = "ahead" | "reached" | "current";

/** WCAG 2.2.2: motion that starts by itself must end within five seconds. */
export const AUTOPLAY_LIMIT_MS = 5000;
/** Position before the thread has reached the first moment. */
export const THREAD_START = -1;

export function momentState(index: number, active: number): MomentState {
  if (index > active) return "ahead";
  return index === active ? "current" : "reached";
}

/**
 * Place of moment `index` in the animation when the thread moves from `from` to `to`.
 * Moving forward lights the nearest moment first; moving back dims the farthest first.
 * Moments that do not change return 0.
 */
export function changeOrder(index: number, from: number, to: number): number {
  if (to > from && index > from && index <= to) return index - from - 1;
  if (to < from && index > to && index <= from) return from - index;
  return 0;
}

/**
 * Timing for the hero load sequence, validated against the number of moments it visits:
 * `startDelayMs` before it begins, `stepMs` between moments, `segmentMs` to travel one connector,
 * `revealMs` for a moment to light once the thread arrives. The stylesheet receives these values.
 */
const heroMotionShape = z.object({
  startDelayMs: z.number().int().min(0).max(2000),
  stepMs: z.number().int().min(200).max(2000),
  segmentMs: z.number().int().min(100).max(1500),
  revealMs: z.number().int().min(200).max(1500),
});
export type HeroMotion = z.infer<typeof heroMotionShape>;

/** Share of a connector's travel time after which the moment it leads to starts to light. */
export const ARRIVAL_FRACTION = 0.6;

/** Delay between the thread setting off along a connector and its moment starting to light. */
export function arrivalMs(motion: HeroMotion): number {
  return Math.round(motion.segmentMs * ARRIVAL_FRACTION);
}

/**
 * Time from page load until the load sequence has fully settled on the last moment: the last step
 * starts, then the connector finishes drawing or the moment finishes lighting, whichever is later.
 */
export function autoplayDurationMs(motion: HeroMotion, moments: number): number {
  const lastStep = motion.startDelayMs + Math.max(0, moments - 1) * motion.stepMs;
  return lastStep + Math.max(motion.segmentMs, arrivalMs(motion) + motion.revealMs);
}

export const heroMotionSchema = (moments: number) =>
  heroMotionShape
    .refine((value) => value.stepMs >= value.segmentMs, {
      message: "Each step must leave time for the thread to arrive",
    })
    .refine((value) => autoplayDurationMs(value, moments) <= AUTOPLAY_LIMIT_MS, {
      message: "The load sequence must finish within five seconds",
    });
