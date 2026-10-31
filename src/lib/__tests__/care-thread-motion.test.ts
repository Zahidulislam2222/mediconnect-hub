import { describe, expect, it } from "vitest";
import { cameraAt, fovForAspect, threadReveal, type CameraStop } from "../care-thread-motion";
import { journey } from "@/content/journey";

const stop = (n: number): CameraStop => ({ position: [n, n, n], target: [-n, 0, 0] });
const ats = [0, 0.12, 0.46, 0.8];
const stops = [stop(0), stop(10), stop(20), stop(30)];

describe("care-thread scroll motion", () => {
  it("rests exactly on each chapter's camera at its start", () => {
    ats.forEach((at, index) => expect(cameraAt(at, ats, stops)).toEqual(stops[index]));
  });

  it("eases between chapters and holds after the last", () => {
    const halfway = cameraAt((0.12 + 0.46) / 2, ats, stops);
    expect(halfway.position[0]).toBeCloseTo(15);
    expect(cameraAt(0.95, ats, stops)).toEqual(stops[3]);
  });

  it("clamps out-of-range and non-finite progress", () => {
    expect(cameraAt(-1, ats, stops)).toEqual(stops[0]);
    expect(cameraAt(Number.NaN, ats, stops)).toEqual(stops[0]);
    expect(cameraAt(5, ats, stops)).toEqual(stops[3]);
  });

  it("rejects mismatched chapter and camera counts", () => {
    expect(() => cameraAt(0.5, ats, stops.slice(1))).toThrow();
  });

  it("is the same pose for the same scroll position after reversing", () => {
    expect(cameraAt(0.3, ats, stops)).toEqual(cameraAt(0.3, ats, stops));
  });

  it("grows the thread monotonically from empty to complete", () => {
    const window = [0.14, 0.86] as const;
    expect(threadReveal(0, window)).toBe(0);
    expect(threadReveal(0.14, window)).toBe(0);
    expect(threadReveal(0.86, window)).toBe(1);
    expect(threadReveal(1, window)).toBe(1);
    let previous = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const value = threadReveal(p, window);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("widens the view on narrow screens without exceeding the cap", () => {
    expect(fovForAspect(38, 1.78, 1.6, 64)).toBe(38);
    const tablet = fovForAspect(38, 1, 1.6, 64);
    expect(tablet).toBeGreaterThan(38);
    expect(tablet).toBeLessThan(64);
    expect(fovForAspect(38, 0.4, 1.6, 64)).toBe(64);
    expect(fovForAspect(38, 0, 1.6, 64)).toBe(38);
  });

  it("works with the shipped chapter and camera configuration", () => {
    const shippedAts = journey.stages.map(stage => stage.at);
    for (let p = 0; p <= 1; p += 0.05)
      cameraAt(p, shippedAts, journey.scene.cameras).position.forEach(value => expect(Number.isFinite(value)).toBe(true));
  });
});
