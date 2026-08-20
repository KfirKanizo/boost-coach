import { describe, expect, it } from 'vitest';

import type { LandmarkPoint } from './visionProtocol';
import {
  analyzePullFrame,
  computeElbowAngles,
  createInitialPullState,
  PULL_LANDMARKS,
  FLEX_THRESHOLD_DEG,
} from './pullKinematics';

const lm = (
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): LandmarkPoint => ({ x, y, z, visibility });

/** 33-point pose; the six arm joints are what pull kinematics use. */
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

/** Arms fully extended (180° at the elbows) — starting position. */
const ARMS_EXTENDED = pose33({
  [PULL_LANDMARKS.leftShoulder]: lm(0.35, 0.3),
  [PULL_LANDMARKS.rightShoulder]: lm(0.65, 0.3),
  [PULL_LANDMARKS.leftElbow]: lm(0.35, 0.6),
  [PULL_LANDMARKS.rightElbow]: lm(0.65, 0.6),
  [PULL_LANDMARKS.leftWrist]: lm(0.35, 0.9),
  [PULL_LANDMARKS.rightWrist]: lm(0.65, 0.9),
});

/** Arms fully flexed (~70° at the elbows) — peak contraction. */
const ARMS_FLEXED = pose33({
  [PULL_LANDMARKS.leftShoulder]: lm(0.35, 0.3),
  [PULL_LANDMARKS.rightShoulder]: lm(0.65, 0.3),
  [PULL_LANDMARKS.leftElbow]: lm(0.35, 0.6),
  [PULL_LANDMARKS.rightElbow]: lm(0.65, 0.6),
  [PULL_LANDMARKS.leftWrist]: lm(0.25, 0.35),
  [PULL_LANDMARKS.rightWrist]: lm(0.75, 0.35),
});

describe('computeElbowAngles', () => {
  it('measures ~180° for fully extended arms', () => {
    const angles = computeElbowAngles(ARMS_EXTENDED);
    expect(angles).not.toBeNull();
    expect(angles?.left).toBeCloseTo(180, 1);
    expect(angles?.right).toBeCloseTo(180, 1);
  });

  it('measures well under the flex threshold for fully flexed arms', () => {
    const angles = computeElbowAngles(ARMS_FLEXED);
    expect(angles).not.toBeNull();
    expect(angles?.left).toBeLessThan(FLEX_THRESHOLD_DEG);
    expect(angles?.right).toBeLessThan(FLEX_THRESHOLD_DEG);
  });

  it('returns null when key landmarks are not visible', () => {
    const occluded = pose33({
      [PULL_LANDMARKS.leftElbow]: lm(0.35, 0.6, 0, 0.1),
      [PULL_LANDMARKS.rightElbow]: lm(0.65, 0.6, 0, 0.1),
    });
    expect(computeElbowAngles(occluded)).toBeNull();
  });
});

describe('analyzePullFrame state machine', () => {
  it('counts a full curl cycle and resets for the next rep', () => {
    let state = createInitialPullState();

    // Start: arms extended, waiting for first rep
    const warmup = analyzePullFrame(ARMS_EXTENDED, state);
    expect(warmup.phase).toBe('get_ready');
    expect(warmup.repCount).toBe(0);
    state = warmup.nextState;

    // Curl up: elbows flex past 90°
    const curlUp = analyzePullFrame(ARMS_FLEXED, state);
    expect(curlUp.phase).toBe('ascending');
    expect(curlUp.repCount).toBe(0);
    state = curlUp.nextState;

    // Lower: elbows extend past 160° — rep counted
    const lowerDown = analyzePullFrame(ARMS_EXTENDED, state);
    expect(lowerDown.phase).toBe('descending');
    expect(lowerDown.repCount).toBe(1);
    state = lowerDown.nextState;

    // Second curl up
    const secondCurl = analyzePullFrame(ARMS_FLEXED, state);
    expect(secondCurl.phase).toBe('ascending');
    expect(secondCurl.repCount).toBe(1);
    state = secondCurl.nextState;

    // Second lower — second rep
    const secondLower = analyzePullFrame(ARMS_EXTENDED, state);
    expect(secondLower.repCount).toBe(2);
    expect(secondLower.phase).toBe('descending');
  });

  it('freezes the counter when the pose is lost mid-curl', () => {
    const curlUp = analyzePullFrame(ARMS_FLEXED, createInitialPullState());
    const lost = analyzePullFrame(null, curlUp.nextState);

    expect(lost.detected).toBe(false);
    expect(lost.warning).toBe('pose_lost');
    expect(lost.repCount).toBe(0);
    expect(lost.nextState).toBe(curlUp.nextState);
  });

  it('ignores truncated landmark arrays', () => {
    const partial = ARMS_EXTENDED.slice(0, 20);
    const analysis = analyzePullFrame(partial, createInitialPullState());
    expect(analysis.detected).toBe(false);
    expect(analysis.repCount).toBe(0);
  });

  it('does not report any posture warning (pull has no warning yet)', () => {
    const analysis = analyzePullFrame(ARMS_FLEXED, createInitialPullState());
    expect(analysis.detected).toBe(true);
    expect(analysis.warning).toBeNull();
  });

  it('stays in get_ready when arms are neither flexed nor extended', () => {
    // Partially flexed arms (~135°) — between thresholds
    // Wrists below elbows but arms bent (mid-curl position)
    const partiallyFlexed = pose33({
      [PULL_LANDMARKS.leftShoulder]: lm(0.35, 0.3),
      [PULL_LANDMARKS.rightShoulder]: lm(0.65, 0.3),
      [PULL_LANDMARKS.leftElbow]: lm(0.35, 0.6),
      [PULL_LANDMARKS.rightElbow]: lm(0.65, 0.6),
      [PULL_LANDMARKS.leftWrist]: lm(0.2, 0.75),
      [PULL_LANDMARKS.rightWrist]: lm(0.8, 0.75),
    });

    const analysis = analyzePullFrame(partiallyFlexed, createInitialPullState());
    expect(analysis.phase).toBe('get_ready');
    expect(analysis.repCount).toBe(0);
  });
});

describe('pullEngine adapter', () => {
  it('exports the correct pattern and initialState', async () => {
    const { pullEngine } = await import('./pullKinematics');
    expect(pullEngine.pattern).toBe('pull');
    expect(pullEngine.initialState()).toEqual({ phase: 'get_ready', repCount: 0 });
  });
});
