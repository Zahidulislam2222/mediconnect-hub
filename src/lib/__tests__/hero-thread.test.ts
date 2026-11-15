import { describe, expect, it } from "vitest";
import {
  ARRIVAL_FRACTION,
  AUTOPLAY_LIMIT_MS,
  THREAD_START,
  arrivalMs,
  autoplayDurationMs,
  changeOrder,
  heroMotionSchema,
  momentState,
} from "../hero-thread";
import { journey } from "@/content/journey";

describe("hero thread rules", () => {
  it("marks moments before, at and after the thread position", () => {
    expect([0, 1, 2, 3].map((index) => momentState(index, 2))).toEqual([
      "reached", "reached", "current", "ahead",
    ]);
    expect([0, 1, 2, 3].map((index) => momentState(index, THREAD_START))).toEqual([
      "ahead", "ahead", "ahead", "ahead",
    ]);
  });
  it("lights the nearest moment first when the thread moves forward", () => {
    expect([0, 1, 2, 3].map((index) => changeOrder(index, 0, 3))).toEqual([0, 0, 1, 2]);
    expect([0, 1, 2, 3].map((index) => changeOrder(index, THREAD_START, 0))).toEqual([0, 0, 0, 0]);
  });
  it("dims the farthest moment first when the thread moves back", () => {
    expect([0, 1, 2, 3].map((index) => changeOrder(index, 3, 0))).toEqual([0, 2, 1, 0]);
  });
  it("gives unchanged moments no delay", () => {
    expect([0, 1, 2, 3].map((index) => changeOrder(index, 2, 2))).toEqual([0, 0, 0, 0]);
    expect(changeOrder(0, 1, 3)).toBe(0);
    expect(changeOrder(3, 2, 1)).toBe(0);
  });
  it("counts the slower of the connector and the moment lighting when measuring the sequence", () => {
    const quickReveal = { startDelayMs: 400, stepMs: 700, segmentMs: 1000, revealMs: 200 };
    expect(arrivalMs(quickReveal)).toBe(1000 * ARRIVAL_FRACTION);
    // The connector (1000) outlasts arrival + reveal (600 + 200).
    expect(autoplayDurationMs(quickReveal, 4)).toBe(400 + 3 * 700 + 1000);
    const slowReveal = { startDelayMs: 400, stepMs: 700, segmentMs: 450, revealMs: 500 };
    // arrival + reveal (270 + 500) outlasts the connector (450).
    expect(autoplayDurationMs(slowReveal, 4)).toBe(400 + 3 * 700 + 270 + 500);
    expect(autoplayDurationMs(slowReveal, 1)).toBe(400 + 770);
  });
  it("keeps the shipped load sequence inside the five-second limit", () => {
    expect(autoplayDurationMs(journey.heroMotion, journey.moments.length)).toBeLessThanOrEqual(AUTOPLAY_LIMIT_MS);
  });
  it("rejects timing that only looks short until the moment's own fade is counted", () => {
    const schema = heroMotionSchema(4);
    expect(schema.safeParse({ startDelayMs: 400, stepMs: 700, segmentMs: 450, revealMs: 500 }).success).toBe(true);
    // Last step at 4800 ms plus a 60 ms arrival and 500 ms fade ends at 5360 ms.
    expect(schema.safeParse({ startDelayMs: 0, stepMs: 1600, segmentMs: 100, revealMs: 500 }).success).toBe(false);
    expect(schema.safeParse({ startDelayMs: 0, stepMs: 1400, segmentMs: 300, revealMs: 1500 }).success).toBe(false);
    expect(schema.safeParse({ startDelayMs: 400, stepMs: 700, segmentMs: 450 }).success).toBe(false);
  });
  it("measures the limit against the number of moments", () => {
    const motion = { startDelayMs: 400, stepMs: 900, segmentMs: 450, revealMs: 500 };
    expect(heroMotionSchema(4).safeParse(motion).success).toBe(true);
    expect(heroMotionSchema(6).safeParse(motion).success).toBe(false);
  });
});
