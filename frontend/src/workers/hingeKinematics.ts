/**
 * Deterministic hinge kinematics — pure math, no DOM, no MediaPipe imports.
 *
 * Handles hip-hinge exercises: barbell deadlift, Romanian deadlift, kettlebell
 * swing, good morning, hip thrust. The primary motion is flexion/extension at
 * the hip joint, tracked via the shoulder–hip–knee angle.
 *
 * State machine (rep counted on hinged -> standing edge):
 *
 *   get_ready  ──(hip angle <100°)──►  hinged
 *   hinged     ──(hip angle >160°)──►  standing  (+1 rep)
 *   standing   ──(hip angle <100°)──►  hinged
 *
 * A `back_round` warning is emitted when the shoulder deviates significantly
 * from the plane defined by the hip and knee, indicating spinal flexion
 * instead of a proper hip hinge.
 */

import type {
  LandmarkPoint,
  ExercisePhase,
  ExerciseWarning,
} from './visionProtocol';
import { angleAt, isVisible } from './kinematicsUtils';
import type { KinematicsEngine, ExerciseAnalysis } from './kinematicsEngine';

/** COCO 33-landmark pose indices relevant to hinge analysis. */
export const HINGE_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
} as const;

/**
 * Angle thresholds (degrees) for the hinge state machine.
 *
 * Standing upright → shoulder–hip–knee ≈ 180°.
 * Hinged forward (bottom of deadlift) → shoulder–hip–knee ≈ 80–120°.
 */
export const HINGE_BOTTOM_DEG = 100;
export const HINGE_STAND_DEG = 160;

/**
 * Perpendicular deviation threshold for back-round detection.
 *
 * Normalised by the shoulder–hip distance (upper-body length). When the
 * shoulder drops significantly below the hip (positive Y-offset in image
 * space), the back is rounding instead of hinging at the hips.
 *
 * In a proper hinge the shoulder stays roughly level with the hip; a
 * rounded back causes it to drop, producing a positive deviation.
 */
const BACK_ROUND_THRESHOLD = 0.15;

export interface HingeState {
  phase: ExercisePhase;
  repCount: number;
}

export interface HingeAnalysis {
  detected: boolean;
  repCount: number;
  phase: ExercisePhase;
  warning: ExerciseWarning | null;
  nextState: HingeState;
}

export function createInitialHingeState(): HingeState {
  return { phase: 'get_ready', repCount: 0 };
}

/**
 * Compute the average shoulder–hip–knee angle across both sides.
 * Returns null when fewer than one side has all three landmarks visible.
 */
export function computeHipAngle(
  points: LandmarkPoint[],
): number | null {
  const sides: ReadonlyArray<[number, number, number]> = [
    [HINGE_LANDMARKS.leftShoulder, HINGE_LANDMARKS.leftHip, HINGE_LANDMARKS.leftKnee],
    [HINGE_LANDMARKS.rightShoulder, HINGE_LANDMARKS.rightHip, HINGE_LANDMARKS.rightKnee],
  ];

  let totalAngle = 0;
  let count = 0;

  for (const [sIdx, hIdx, kIdx] of sides) {
    const shoulder = points[sIdx];
    const hip = points[hIdx];
    const knee = points[kIdx];
    if (!isVisible(shoulder) || !isVisible(hip) || !isVisible(knee)) continue;

    totalAngle += angleAt(shoulder, hip, knee);
    count += 1;
  }

  if (count === 0) return null;
  return totalAngle / count;
}

/**
 * Detect back rounding by measuring how far the shoulder has dropped below
 * the hip, normalised by the shoulder–hip distance (upper-body length).
 *
 * In a proper hinge, the torso rotates around the hip joint and the shoulder
 * stays roughly level with (or above) the hip.  When the back rounds, the
 * shoulder drops forward and down, producing a positive Y-offset relative to
 * the hip.
 *
 * @returns Normalised deviation (positive = shoulder below hip = bad).
 *          Returns null when landmarks are untrusted.
 */
export function detectBackRound(points: LandmarkPoint[]): number | null {
  const sides: ReadonlyArray<[number, number, number]> = [
    [HINGE_LANDMARKS.leftShoulder, HINGE_LANDMARKS.leftHip, HINGE_LANDMARKS.leftKnee],
    [HINGE_LANDMARKS.rightShoulder, HINGE_LANDMARKS.rightHip, HINGE_LANDMARKS.rightKnee],
  ];

  let totalDeviation = 0;
  let count = 0;

  for (const [sIdx, hIdx] of sides) {
    const shoulder = points[sIdx];
    const hip = points[hIdx];
    if (!isVisible(shoulder) || !isVisible(hip)) continue;

    // Upper-body reference length for normalisation.
    const shoulderHipDist = Math.hypot(
      shoulder.x - hip.x,
      shoulder.y - hip.y,
    );
    if (shoulderHipDist === 0) continue;

    // Vertical offset: positive = shoulder below hip (rounding), negative = above (good).
    const verticalOffset = shoulder.y - hip.y;
    const deviation = verticalOffset / shoulderHipDist;
    totalDeviation += deviation;
    count += 1;
  }

  if (count === 0) return null;
  return totalDeviation / count;
}

/**
 * Advance the hinge state machine from a frame's hip angle.
 *
 * - get_ready → hinged: hip angle drops below `HINGE_BOTTOM_DEG`.
 * - hinged → standing: hip angle rises above `HINGE_STAND_DEG`
 *             (counts one rep on this edge — the lockout completes the rep).
 * - standing → hinged: hip angle drops again (next rep begins).
 *
 * When the pose is untrusted the state is frozen — no false counts.
 */
export function analyzeHingeFrame(
  points: LandmarkPoint[] | null,
  state: HingeState,
): HingeAnalysis {
  if (!points || points.length < 33) {
    return {
      detected: false,
      repCount: state.repCount,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const hipAngle = computeHipAngle(points);
  if (hipAngle === null) {
    return {
      detected: false,
      repCount: state.repCount,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const isHinged = hipAngle < HINGE_BOTTOM_DEG;
  const isStanding = hipAngle > HINGE_STAND_DEG;

  // Back-round check: only evaluate when the hinge is deep enough to
  // meaningfully distinguish rounding from upright posture.
  let warning: ExerciseWarning | null = null;
  if (hipAngle < HINGE_STAND_DEG) {
    const deviation = detectBackRound(points);
    if (deviation !== null && deviation > BACK_ROUND_THRESHOLD) {
      warning = 'back_round';
    }
  }

  let { phase, repCount } = state;

  switch (phase) {
    case 'get_ready':
      if (isHinged) phase = 'hinged';
      break;
    case 'hinged':
      if (isStanding) {
        repCount += 1;
        phase = 'standing';
      }
      break;
    case 'standing':
      if (isHinged) phase = 'hinged';
      break;
    // Phases belonging to other exercise patterns — kept for exhaustive TS.
    case 'squat':
    case 'stand_up':
    case 'down':
    case 'up':
    case 'holding':
    case 'ascending':
    case 'descending':
      break;
  }

  const nextState: HingeState = { phase, repCount };
  return { detected: true, repCount, phase, warning, nextState };
}

// ── Engine adapter ──────────────────────────────────────────────────

/** Hinge kinematics engine — wraps the pure functions above. */
export const hingeEngine: KinematicsEngine = {
  pattern: 'hinge',
  warningJoints: [
    HINGE_LANDMARKS.leftShoulder,
    HINGE_LANDMARKS.leftHip,
    HINGE_LANDMARKS.rightShoulder,
    HINGE_LANDMARKS.rightHip,
  ],
  initialState: createInitialHingeState,
  analyzeFrame(points, state): ExerciseAnalysis {
    const result = analyzeHingeFrame(points, state as HingeState);
    return {
      detected: result.detected,
      repCount: result.repCount,
      phase: result.phase,
      warning: result.warning,
      nextState: result.nextState,
    };
  },
};
