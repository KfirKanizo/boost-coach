import { describe, expect, it } from 'vitest';

import type { LandmarkPoint } from './visionProtocol';
import {
  analyzeSquatFrame,
  angleAt,
  computeKneeAngles,
  createInitialSquatState,
  detectKneeValgus,
  LANDMARKS,
  SQUAT_THRESHOLD_DEG,
} from './squatKinematics';

const lm = (
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): LandmarkPoint => ({ x, y, z, visibility });

/** 33-point pose; the six leg joints are what the kinematics actually use. */
function pose33(
  overrides: Partial<Record<number, LandmarkPoint>> = {},
): LandmarkPoint[] {
  const points: LandmarkPoint[] = [];
  for (let i = 0; i < 33; i += 1) points.push(lm(0.5, 0.5));
  for (const indexStr of Object.keys(overrides)) {
    const index = Number(indexStr);
    const point = overrides[index];
    if (point) points[index] = point;
  }
  return points;
}

/** Legs straight (180° at the knees). */
const STANDING = pose33({
  [LANDMARKS.leftHip]: lm(0.42, 0.35),
  [LANDMARKS.rightHip]: lm(0.58, 0.35),
  [LANDMARKS.leftKnee]: lm(0.42, 0.65),
  [LANDMARKS.rightKnee]: lm(0.58, 0.65),
  [LANDMARKS.leftAnkle]: lm(0.42, 1.0),
  [LANDMARKS.rightAnkle]: lm(0.58, 1.0),
});

/** Deep squat: knees ~74° (well past the 110° flex threshold), tracking over the toes. */
const SQUAT = pose33({
  [LANDMARKS.leftHip]: lm(0.35, 0.72),
  [LANDMARKS.rightHip]: lm(0.65, 0.72),
  [LANDMARKS.leftKnee]: lm(0.42, 0.7),
  [LANDMARKS.rightKnee]: lm(0.58, 0.7),
  [LANDMARKS.leftAnkle]: lm(0.42, 1.0),
  [LANDMARKS.rightAnkle]: lm(0.58, 1.0),
});

describe('angleAt', () => {
  it('returns 90° for a right angle', () => {
    expect(angleAt(lm(0.3, 0.6), lm(0.5, 0.6), lm(0.5, 1.0))).toBeCloseTo(90, 5);
  });

  it('returns 180° for a straight line', () => {
    expect(angleAt(lm(0, 0), lm(0, 0.5), lm(0, 1))).toBeCloseTo(180, 5);
  });

  it('returns 0° for overlapping segments', () => {
    expect(angleAt(lm(0, 0), lm(0, 0), lm(0, 0))).toBeCloseTo(180, 5);
  });
});

describe('computeKneeAngles', () => {
  it('measures ~180° for standing legs', () => {
    const angles = computeKneeAngles(STANDING);
    expect(angles).not.toBeNull();
    expect(angles?.left).toBeCloseTo(180, 1);
    expect(angles?.right).toBeCloseTo(180, 1);
  });

  it('measures a deep squat well under the flex threshold', () => {
    const angles = computeKneeAngles(SQUAT);
    expect(angles).not.toBeNull();
    expect(angles?.left).toBeLessThan(SQUAT_THRESHOLD_DEG);
    expect(angles?.right).toBeLessThan(SQUAT_THRESHOLD_DEG);
  });

  it('returns null when key landmarks are not visible', () => {
    const occluded = pose33({
      [LANDMARKS.leftKnee]: lm(0.42, 0.65, 0, 0.1),
      [LANDMARKS.rightKnee]: lm(0.58, 0.65, 0, 0.1),
    });
    expect(computeKneeAngles(occluded)).toBeNull();
  });
});

describe('analyzeSquatFrame state machine', () => {
  it('counts a full squat cycle and resets for the next rep', () => {
    let state = createInitialSquatState();

    const warmup = analyzeSquatFrame(STANDING, state);
    expect(warmup.phase).toBe('get_ready');
    expect(warmup.repCount).toBe(0);
    state = warmup.nextState;

    const descend = analyzeSquatFrame(SQUAT, state);
    expect(descend.phase).toBe('squat');
    expect(descend.repCount).toBe(0);
    state = descend.nextState;

    const ascend = analyzeSquatFrame(STANDING, state);
    expect(ascend.phase).toBe('stand_up');
    expect(ascend.repCount).toBe(1);
    state = ascend.nextState;

    const descendAgain = analyzeSquatFrame(SQUAT, state);
    expect(descendAgain.phase).toBe('squat');
    expect(descendAgain.repCount).toBe(1);
    state = descendAgain.nextState;

    const secondRep = analyzeSquatFrame(STANDING, state);
    expect(secondRep.repCount).toBe(2);
    expect(secondRep.phase).toBe('stand_up');
  });

  it('freezes the counter when the pose is lost mid-squat', () => {
    const descend = analyzeSquatFrame(SQUAT, createInitialSquatState());
    const lost = analyzeSquatFrame(null, descend.nextState);

    expect(lost.detected).toBe(false);
    expect(lost.warning).toBe('pose_lost');
    expect(lost.repCount).toBe(0);
    expect(lost.nextState).toBe(descend.nextState);
  });

  it('ignores truncated landmark arrays', () => {
    const partial = STANDING.slice(0, 20);
    const analysis = analyzeSquatFrame(partial, createInitialSquatState());
    expect(analysis.detected).toBe(false);
    expect(analysis.repCount).toBe(0);
  });

  it('reports a knee-valgus warning when the knee bows laterally', () => {
    const valgus = pose33({
      [LANDMARKS.leftHip]: lm(0.42, 0.35),
      [LANDMARKS.rightHip]: lm(0.58, 0.35),
      [LANDMARKS.leftKnee]: lm(0.62, 0.65),
      [LANDMARKS.rightKnee]: lm(0.58, 0.65),
      [LANDMARKS.leftAnkle]: lm(0.42, 1.0),
      [LANDMARKS.rightAnkle]: lm(0.58, 1.0),
    });

    expect(detectKneeValgus(valgus)).toBe(true);
    const analysis = analyzeSquatFrame(valgus, createInitialSquatState());
    expect(analysis.detected).toBe(true);
    expect(analysis.warning).toBe('knee_valgus');
  });

  it('produces no warning for a well-aligned squat', () => {
    const analysis = analyzeSquatFrame(SQUAT, createInitialSquatState());
    expect(analysis.warning).toBeNull();
  });
});
