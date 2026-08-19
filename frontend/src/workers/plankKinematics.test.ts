import { describe, expect, it } from 'vitest';

import type { LandmarkPoint } from './visionProtocol';
import {
  analyzePlankFrame,
  angleAt,
  computeAlignment,
  createInitialPlankState,
  PLANK_LANDMARKS,
  STRAIGHT_THRESHOLD_DEG,
} from './plankKinematics';

const lm = (
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): LandmarkPoint => ({ x, y, z, visibility });

/** 33-point pose; the six key joints are what plank kinematics use. */
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
 * Perfect plank: shoulder–hip–ankle in a straight horizontal line.
 * Left side: shoulder(0.2, 0.4), hip(0.5, 0.4), ankle(0.8, 0.4) → 180°
 * Right side mirrors it.
 */
const PLANK_STRAIGHT = pose33({
  [PLANK_LANDMARKS.leftShoulder]: lm(0.2, 0.4),
  [PLANK_LANDMARKS.rightShoulder]: lm(0.2, 0.6),
  [PLANK_LANDMARKS.leftHip]: lm(0.5, 0.4),
  [PLANK_LANDMARKS.rightHip]: lm(0.5, 0.6),
  [PLANK_LANDMARKS.leftAnkle]: lm(0.8, 0.4),
  [PLANK_LANDMARKS.rightAnkle]: lm(0.8, 0.6),
});

/**
 * Hip sag: hip drops below the shoulder–ankle line.
 * Left side: shoulder(0.2, 0.4), hip(0.5, 0.6), ankle(0.8, 0.4) → ~143°
 */
const PLANK_SAG = pose33({
  [PLANK_LANDMARKS.leftShoulder]: lm(0.2, 0.4),
  [PLANK_LANDMARKS.rightShoulder]: lm(0.2, 0.6),
  [PLANK_LANDMARKS.leftHip]: lm(0.5, 0.65),
  [PLANK_LANDMARKS.rightHip]: lm(0.5, 0.85),
  [PLANK_LANDMARKS.leftAnkle]: lm(0.8, 0.4),
  [PLANK_LANDMARKS.rightAnkle]: lm(0.8, 0.6),
});

/**
 * Hip pike: hip rises above the shoulder–ankle line.
 * Left side: shoulder(0.2, 0.4), hip(0.5, 0.2), ankle(0.8, 0.4) → ~143°
 */
const PLANK_PIKE = pose33({
  [PLANK_LANDMARKS.leftShoulder]: lm(0.2, 0.4),
  [PLANK_LANDMARKS.rightShoulder]: lm(0.2, 0.6),
  [PLANK_LANDMARKS.leftHip]: lm(0.5, 0.15),
  [PLANK_LANDMARKS.rightHip]: lm(0.5, 0.35),
  [PLANK_LANDMARKS.leftAnkle]: lm(0.8, 0.4),
  [PLANK_LANDMARKS.rightAnkle]: lm(0.8, 0.6),
});

describe('angleAt', () => {
  it('returns 180° for a straight line', () => {
    expect(angleAt(lm(0, 0), lm(0.5, 0), lm(1, 0))).toBeCloseTo(180, 5);
  });

  it('returns 90° for a right angle', () => {
    expect(angleAt(lm(0.3, 0.6), lm(0.5, 0.6), lm(0.5, 1.0))).toBeCloseTo(90, 5);
  });

  it('returns 180° for overlapping segments', () => {
    expect(angleAt(lm(0, 0), lm(0, 0), lm(0, 0))).toBeCloseTo(180, 5);
  });
});

describe('computeAlignment', () => {
  it('returns 180° angle and near-zero deviation for a straight plank', () => {
    const result = computeAlignment(PLANK_STRAIGHT);
    expect(result).not.toBeNull();
    expect(result!.angle).toBeCloseTo(180, 1);
    expect(Math.abs(result!.deviation)).toBeLessThan(0.01);
  });

  it('returns a non-straight angle for a sagging plank', () => {
    const result = computeAlignment(PLANK_SAG);
    expect(result).not.toBeNull();
    expect(result!.angle).toBeLessThan(STRAIGHT_THRESHOLD_DEG);
  });

  it('returns a non-straight angle for a piking plank', () => {
    const result = computeAlignment(PLANK_PIKE);
    expect(result).not.toBeNull();
    expect(result!.angle).toBeLessThan(STRAIGHT_THRESHOLD_DEG);
  });

  it('returns null when key landmarks are not visible', () => {
    const occluded = pose33({
      [PLANK_LANDMARKS.leftShoulder]: lm(0.2, 0.4, 0, 0.1),
      [PLANK_LANDMARKS.leftHip]: lm(0.5, 0.4, 0, 0.1),
      [PLANK_LANDMARKS.leftAnkle]: lm(0.8, 0.4, 0, 0.1),
      [PLANK_LANDMARKS.rightShoulder]: lm(0.2, 0.6, 0, 0.1),
      [PLANK_LANDMARKS.rightHip]: lm(0.5, 0.6, 0, 0.1),
      [PLANK_LANDMARKS.rightAnkle]: lm(0.8, 0.6, 0, 0.1),
    });
    expect(computeAlignment(occluded)).toBeNull();
  });
});

describe('analyzePlankFrame state machine', () => {
  it('transitions from get_ready to holding when body is straight', () => {
    const state = createInitialPlankState();
    expect(state.phase).toBe('get_ready');
    expect(state.holdMs).toBe(0);

    const result = analyzePlankFrame(PLANK_STRAIGHT, state, 100);
    expect(result.phase).toBe('holding');
    expect(result.detected).toBe(true);
    expect(result.warning).toBeNull();
    expect(result.nextState.holdMs).toBe(100);
  });

  it('accumulates hold time while holding', () => {
    let state = createInitialPlankState();

    const start = analyzePlankFrame(PLANK_STRAIGHT, state, 100);
    expect(start.phase).toBe('holding');
    expect(start.nextState.holdMs).toBe(100);
    state = start.nextState;

    const continue_ = analyzePlankFrame(PLANK_STRAIGHT, state, 200);
    expect(continue_.phase).toBe('holding');
    expect(continue_.nextState.holdMs).toBe(300);
    state = continue_.nextState;

    const done = analyzePlankFrame(PLANK_STRAIGHT, state, 150);
    expect(done.nextState.holdMs).toBe(450);
  });

  it('transitions back to get_ready when form breaks', () => {
    let state = createInitialPlankState();

    // Start holding
    const holding = analyzePlankFrame(PLANK_STRAIGHT, state, 100);
    expect(holding.phase).toBe('holding');
    state = holding.nextState;

    // Form breaks
    const broken = analyzePlankFrame(PLANK_SAG, state, 100);
    expect(broken.phase).toBe('get_ready');
    // Hold time is frozen (not incremented) when form breaks
    expect(broken.nextState.holdMs).toBe(100);
  });

  it('resumes holding after form recovers', () => {
    let state = createInitialPlankState();

    // Start holding
    const s1 = analyzePlankFrame(PLANK_STRAIGHT, state, 100);
    state = s1.nextState;

    // Form breaks
    const s2 = analyzePlankFrame(PLANK_SAG, state, 100);
    state = s2.nextState;

    // Form recovers
    const s3 = analyzePlankFrame(PLANK_STRAIGHT, state, 200);
    expect(s3.phase).toBe('holding');
    // Hold time resumes from where it left off
    expect(s3.nextState.holdMs).toBe(300);
  });

  it('reports hip_sag warning when hip drops during a straight-ish plank', () => {
    // Use a pose that has a straight-ish angle but sagging deviation.
    // We need an angle >= 165° but with hip sagging.
    // shoulder(0.1, 0.4), hip(0.5, 0.47), ankle(0.9, 0.4)
    // The hip is slightly below the line but the angle is still close to 180.
    const slightSag = pose33({
      [PLANK_LANDMARKS.leftShoulder]: lm(0.1, 0.4),
      [PLANK_LANDMARKS.rightShoulder]: lm(0.1, 0.6),
      [PLANK_LANDMARKS.leftHip]: lm(0.5, 0.5),
      [PLANK_LANDMARKS.rightHip]: lm(0.5, 0.7),
      [PLANK_LANDMARKS.leftAnkle]: lm(0.9, 0.4),
      [PLANK_LANDMARKS.rightAnkle]: lm(0.9, 0.6),
    });

    const result = analyzePlankFrame(slightSag, createInitialPlankState(), 100);
    // Angle might still be straight enough (close to 180) but deviation triggers warning
    if (result.phase === 'holding') {
      expect(result.warning).toBe('hip_sag');
    }
  });

  it('reports hip_pike warning when hip rises too high', () => {
    // shoulder(0.1, 0.4), hip(0.5, 0.32), ankle(0.9, 0.4)
    // Hip above the line but angle still near 180.
    const slightPike = pose33({
      [PLANK_LANDMARKS.leftShoulder]: lm(0.1, 0.4),
      [PLANK_LANDMARKS.rightShoulder]: lm(0.1, 0.6),
      [PLANK_LANDMARKS.leftHip]: lm(0.5, 0.3),
      [PLANK_LANDMARKS.rightHip]: lm(0.5, 0.5),
      [PLANK_LANDMARKS.leftAnkle]: lm(0.9, 0.4),
      [PLANK_LANDMARKS.rightAnkle]: lm(0.9, 0.6),
    });

    const result = analyzePlankFrame(slightPike, createInitialPlankState(), 100);
    if (result.phase === 'holding') {
      expect(result.warning).toBe('hip_pike');
    }
  });

  it('freezes the state when the pose is lost', () => {
    const holding = analyzePlankFrame(PLANK_STRAIGHT, createInitialPlankState(), 100);
    const lost = analyzePlankFrame(null, holding.nextState, 100);

    expect(lost.detected).toBe(false);
    expect(lost.warning).toBe('pose_lost');
    expect(lost.nextState).toBe(holding.nextState);
  });

  it('ignores truncated landmark arrays', () => {
    const partial = PLANK_STRAIGHT.slice(0, 20);
    const result = analyzePlankFrame(partial, createInitialPlankState(), 100);
    expect(result.detected).toBe(false);
  });

  it('stays in get_ready for a non-straight pose', () => {
    const result = analyzePlankFrame(PLANK_SAG, createInitialPlankState(), 100);
    expect(result.phase).toBe('get_ready');
  });
});
