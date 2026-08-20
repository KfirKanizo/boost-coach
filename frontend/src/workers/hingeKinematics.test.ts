import { describe, expect, it } from 'vitest';

import type { LandmarkPoint } from './visionProtocol';
import {
  analyzeHingeFrame,
  computeHipAngle,
  createInitialHingeState,
  detectBackRound,
  HINGE_LANDMARKS,
  HINGE_BOTTOM_DEG,
} from './hingeKinematics';

const lm = (
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): LandmarkPoint => ({ x, y, z, visibility });

/** 33-point pose; the six key joints are what hinge kinematics use. */
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

/**
 * Standing upright: shoulder–hip–knee ≈ 180° (straight line).
 * Side view simulation: shoulder directly above hip, hip directly above knee.
 */
const STANDING = pose33({
  [HINGE_LANDMARKS.leftShoulder]: lm(0.4, 0.2),
  [HINGE_LANDMARKS.rightShoulder]: lm(0.6, 0.2),
  [HINGE_LANDMARKS.leftHip]: lm(0.4, 0.5),
  [HINGE_LANDMARKS.rightHip]: lm(0.6, 0.5),
  [HINGE_LANDMARKS.leftKnee]: lm(0.4, 0.8),
  [HINGE_LANDMARKS.rightKnee]: lm(0.6, 0.8),
});

/**
 * Hinged forward (bottom of deadlift): shoulder–hip–knee ≈ 94°.
 * Simulated by moving shoulders well forward and slightly below hips.
 */
const HINGED = pose33({
  [HINGE_LANDMARKS.leftShoulder]: lm(0.8, 0.48),
  [HINGE_LANDMARKS.rightShoulder]: lm(1.0, 0.48),
  [HINGE_LANDMARKS.leftHip]: lm(0.5, 0.5),
  [HINGE_LANDMARKS.rightHip]: lm(0.7, 0.5),
  [HINGE_LANDMARKS.leftKnee]: lm(0.5, 0.8),
  [HINGE_LANDMARKS.rightKnee]: lm(0.7, 0.8),
});

/**
 * Rounded back: shoulders dropped forward relative to the hip-knee plane.
 * The perpendicular deviation of the shoulder from the hip-knee line is
 * larger than in a proper hinge.
 */
const ROUNDED_BACK = pose33({
  [HINGE_LANDMARKS.leftShoulder]: lm(0.6, 0.55),
  [HINGE_LANDMARKS.rightShoulder]: lm(0.8, 0.55),
  [HINGE_LANDMARKS.leftHip]: lm(0.4, 0.5),
  [HINGE_LANDMARKS.rightHip]: lm(0.6, 0.5),
  [HINGE_LANDMARKS.leftKnee]: lm(0.4, 0.8),
  [HINGE_LANDMARKS.rightKnee]: lm(0.6, 0.8),
});

describe('computeHipAngle', () => {
  it('measures ~180° for standing upright', () => {
    const angle = computeHipAngle(STANDING);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(180, 0);
  });

  it('measures well under the bottom threshold for a deep hinge', () => {
    const angle = computeHipAngle(HINGED);
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(HINGE_BOTTOM_DEG);
  });

  it('returns null when key landmarks are not visible', () => {
    const occluded = pose33({
      [HINGE_LANDMARKS.leftShoulder]: lm(0.4, 0.2, 0, 0.1),
      [HINGE_LANDMARKS.leftHip]: lm(0.4, 0.5, 0, 0.1),
      [HINGE_LANDMARKS.leftKnee]: lm(0.4, 0.8, 0, 0.1),
      [HINGE_LANDMARKS.rightShoulder]: lm(0.6, 0.2, 0, 0.1),
      [HINGE_LANDMARKS.rightHip]: lm(0.6, 0.5, 0, 0.1),
      [HINGE_LANDMARKS.rightKnee]: lm(0.6, 0.8, 0, 0.1),
    });
    expect(computeHipAngle(occluded)).toBeNull();
  });
});

describe('detectBackRound', () => {
  it('returns near-zero for a proper hinge (shoulder level with hip)', () => {
    const deviation = detectBackRound(HINGED);
    expect(deviation).not.toBeNull();
    expect(deviation!).toBeLessThan(0.15);
  });

  it('returns a positive deviation for a rounded back (shoulder below hip)', () => {
    const deviation = detectBackRound(ROUNDED_BACK);
    expect(deviation).not.toBeNull();
    expect(deviation!).toBeGreaterThan(0.15);
  });

  it('returns null when landmarks are untrusted', () => {
    const occluded = pose33({
      [HINGE_LANDMARKS.leftShoulder]: lm(0.4, 0.2, 0, 0.1),
      [HINGE_LANDMARKS.leftHip]: lm(0.4, 0.5, 0, 0.1),
      [HINGE_LANDMARKS.leftKnee]: lm(0.4, 0.8, 0, 0.1),
    });
    expect(detectBackRound(occluded)).toBeNull();
  });
});

describe('analyzeHingeFrame state machine', () => {
  it('counts a full deadlift cycle and resets for the next rep', () => {
    let state = createInitialHingeState();

    // Start: standing upright
    const warmup = analyzeHingeFrame(STANDING, state);
    expect(warmup.phase).toBe('get_ready');
    expect(warmup.repCount).toBe(0);
    state = warmup.nextState;

    // Hinge forward
    const descend = analyzeHingeFrame(HINGED, state);
    expect(descend.phase).toBe('hinged');
    expect(descend.repCount).toBe(0);
    state = descend.nextState;

    // Return to standing — rep counted
    const lockout = analyzeHingeFrame(STANDING, state);
    expect(lockout.phase).toBe('standing');
    expect(lockout.repCount).toBe(1);
    state = lockout.nextState;

    // Second hinge
    const secondDescend = analyzeHingeFrame(HINGED, state);
    expect(secondDescend.phase).toBe('hinged');
    expect(secondDescend.repCount).toBe(1);
    state = secondDescend.nextState;

    // Second lockout
    const secondLockout = analyzeHingeFrame(STANDING, state);
    expect(secondLockout.repCount).toBe(2);
    expect(secondLockout.phase).toBe('standing');
  });

  it('freezes the counter when the pose is lost mid-hinge', () => {
    const hinge = analyzeHingeFrame(HINGED, createInitialHingeState());
    const lost = analyzeHingeFrame(null, hinge.nextState);

    expect(lost.detected).toBe(false);
    expect(lost.warning).toBe('pose_lost');
    expect(lost.repCount).toBe(0);
    expect(lost.nextState).toBe(hinge.nextState);
  });

  it('ignores truncated landmark arrays', () => {
    const partial = STANDING.slice(0, 20);
    const analysis = analyzeHingeFrame(partial, createInitialHingeState());
    expect(analysis.detected).toBe(false);
    expect(analysis.repCount).toBe(0);
  });

  it('reports back_round warning when the back is rounded during a hinge', () => {
    const analysis = analyzeHingeFrame(ROUNDED_BACK, createInitialHingeState());
    expect(analysis.detected).toBe(true);
    expect(analysis.warning).toBe('back_round');
  });

  it('produces no warning for a well-aligned hinge', () => {
    const analysis = analyzeHingeFrame(HINGED, createInitialHingeState());
    expect(analysis.detected).toBe(true);
    expect(analysis.warning).toBeNull();
  });

  it('does not warn about back rounding when standing upright', () => {
    // Standing has no meaningful deviation to measure
    const analysis = analyzeHingeFrame(STANDING, createInitialHingeState());
    expect(analysis.detected).toBe(true);
    // Standing is above HINGE_STAND_DEG, so back_round check is skipped
    expect(analysis.warning).toBeNull();
  });
});

describe('hingeEngine adapter', () => {
  it('exports the correct pattern and initialState', async () => {
    const { hingeEngine } = await import('./hingeKinematics');
    expect(hingeEngine.pattern).toBe('hinge');
    expect(hingeEngine.initialState()).toEqual({ phase: 'get_ready', repCount: 0 });
    expect(hingeEngine.warningJoints).toContain(HINGE_LANDMARKS.leftShoulder);
    expect(hingeEngine.warningJoints).toContain(HINGE_LANDMARKS.leftHip);
  });
});
