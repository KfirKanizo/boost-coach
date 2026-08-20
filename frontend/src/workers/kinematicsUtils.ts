/**
 * Shared helpers for all kinematics modules.
 *
 * Extracted from the per-exercise modules to eliminate duplication of
 * `angleAt`, `isVisible`, and `MIN_VISIBILITY` across squat, push-up,
 * plank, and future kinematics.
 */

import type { LandmarkPoint } from './visionProtocol';

/** Min visibility for a landmark to be trusted by kinematic analysis. */
export const MIN_VISIBILITY = 0.5;

/** Guard: a landmark is visible when its visibility score meets the threshold. */
export function isVisible(
  point: LandmarkPoint | undefined,
): point is LandmarkPoint {
  if (!point) return false;
  return (point.visibility ?? 1) >= MIN_VISIBILITY;
}

/** Internal angle (degrees, 0..180) at vertex `b` of triangle a–b–c. */
export function angleAt(
  a: LandmarkPoint,
  b: LandmarkPoint,
  c: LandmarkPoint,
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);

  if (magAB === 0 || magCB === 0) return 180;

  const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cosine) * 180) / Math.PI;
}
