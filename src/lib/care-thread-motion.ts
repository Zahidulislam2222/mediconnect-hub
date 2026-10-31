/** Pure scroll-to-scene math for the homepage care-thread scene (no WebGL, unit-testable). */

import type { CameraStop } from "./care-thread-config";

export type { CameraStop };
type Vec3 = readonly number[];

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: Vec3, b: Vec3, t: number): number[] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Camera pose for a scroll position. `stops[i]` is the pose that rests at chapter start `ats[i]`;
 * motion eases between neighbouring chapters and holds after the last one.
 */
export function cameraAt(progress: number, ats: readonly number[], stops: readonly CameraStop[]): CameraStop {
  if (!stops.length || stops.length !== ats.length) throw new Error("Each chapter needs one camera stop");
  const p = clamp01(progress);
  let index = 0;
  while (index < ats.length - 1 && p >= ats[index + 1]) index++;
  if (index === ats.length - 1) return stops[index];
  const t = smooth(clamp01((p - ats[index]) / (ats[index + 1] - ats[index])));
  return {
    position: mix(stops[index].position, stops[index + 1].position, t),
    target: mix(stops[index].target, stops[index + 1].target, t),
  };
}

/** Fraction of the care thread drawn, from 0 before `start` to 1 after `end`. */
export function threadReveal(progress: number, [start, end]: readonly number[]): number {
  return smooth(clamp01((clamp01(progress) - start) / (end - start)));
}

/**
 * Vertical field of view that keeps the reference horizontal framing on narrow screens,
 * capped so portrait phones do not get a fisheye view.
 */
export function fovForAspect(fov: number, aspect: number, referenceAspect: number, maxFov: number): number {
  if (!(aspect > 0) || aspect >= referenceAspect) return fov;
  const half = (degrees: number) => (degrees * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(half(fov)) * referenceAspect);
  const vertical = (Math.atan(Math.tan(horizontal) / aspect) * 360) / Math.PI;
  return Math.min(maxFov, vertical);
}
