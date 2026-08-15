/**
 * Deterministic squat kinematics — pure math, no DOM, no MediaPipe imports.
 *
 * Runs inside the vision worker on the normalized 33-landmark pose output of
 * `PoseLandmarker` (COCO topology). Keeping this a pure module makes the rep
 * counter fully unit-testable in isolation.
 */

import type {
  LandmarkPoint,
  SquatPhase,
  SquatWarning,
} from './visionProtocol';

/** COCO 33-landmark pose indices relevant to squat analysis. */
export const LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/**
 * Angle thresholds (degrees) for the squat state machine.
 * Hysteresis between the two avoids jitter around a single cutoff.
 */
export const STAND_THRESHOLD_DEG = 160;
export const SQUAT_THRESHOLD_DEG = 100;

/** Min visibility for a landmark to be trusted by the kinematic analysis. */
const MIN_VISIBILITY = 0.5;

/** Max normalized lateral knee deviation (from the hip–ankle line) that is tolerated. */
const VALGUS_THRESHOLD = 0.3;

export interface SquatState {
  phase: SquatPhase;
  repCount: number;
}

export interface SquatAnalysis {
  /** Whether a full, visible pose was available this frame. */
  detected: boolean;
  repCount: number;
  phase: SquatPhase;
  warning: SquatWarning | null;
  nextState: SquatState;
}

export function createInitialSquatState(): SquatState {
  return { phase: 'get_ready', repCount: 0 };
}

function isVisible(point: LandmarkPoint | undefined): point is LandmarkPoint {
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

export interface KneeAngles {
  left: number;
  right: number;
}

/** Knee flexion angles for both legs, or null when landmarks are untrusted. */
export function computeKneeAngles(
  points: LandmarkPoint[],
): KneeAngles | null {
  const hip = points[LANDMARKS.leftHip];
  const rHip = points[LANDMARKS.rightHip];
  const knee = points[LANDMARKS.leftKnee];
  const rKnee = points[LANDMARKS.rightKnee];
  const ankle = points[LANDMARKS.leftAnkle];
  const rAnkle = points[LANDMARKS.rightAnkle];

  if (
    !isVisible(hip) ||
    !isVisible(rHip) ||
    !isVisible(knee) ||
    !isVisible(rKnee) ||
    !isVisible(ankle) ||
    !isVisible(rAnkle)
  ) {
    return null;
  }

  return {
    left: angleAt(hip, knee, ankle),
    right: angleAt(rHip, rKnee, rAnkle),
  };
}

/**
 * Knee-valgus heuristic: the perpendicular distance of a knee from its
 * hip–ankle line, normalized by leg length. A bow > `VALGUS_THRESHOLD`
 * signals a warning joint (rendered crimson on the HUD).
 */
export function detectKneeValgus(points: LandmarkPoint[]): boolean {
  const legs: ReadonlyArray<[number, number, number]> = [
    [LANDMARKS.leftHip, LANDMARKS.leftKnee, LANDMARKS.leftAnkle],
    [LANDMARKS.rightHip, LANDMARKS.rightKnee, LANDMARKS.rightAnkle],
  ];

  for (const [hipIdx, kneeIdx, ankleIdx] of legs) {
    const hip = points[hipIdx];
    const knee = points[kneeIdx];
    const ankle = points[ankleIdx];
    if (!isVisible(hip) || !isVisible(knee) || !isVisible(ankle)) continue;

    const abx = ankle.x - hip.x;
    const aby = ankle.y - hip.y;
    const legLength = Math.hypot(abx, aby);
    if (legLength === 0) continue;

    // Perpendicular distance from knee to the hip–ankle line (image plane).
    const px = knee.x - hip.x;
    const py = knee.y - hip.y;
    const lateral = Math.abs(px * aby - py * abx) / legLength;

    if (lateral / legLength > VALGUS_THRESHOLD) return true;
  }
  return false;
}

/**
 * Advance the squat state machine from a frame's knee angles.
 *
 * - get_ready → squat: both knees flexed past `SQUAT_THRESHOLD_DEG`.
 * - squat     → stand_up: both knees extended past `STAND_THRESHOLD_DEG`
 *               (counts one rep on this edge).
 * - stand_up  → squat: both knees flexed again (next rep begins).
 *
 * When the pose is untrusted the state is frozen — no false counts.
 */
export function analyzeSquatFrame(
  points: LandmarkPoint[] | null,
  state: SquatState,
): SquatAnalysis {
  if (!points || points.length < 33) {
    return {
      detected: false,
      repCount: state.repCount,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const knees = computeKneeAngles(points);
  if (!knees) {
    return {
      detected: false,
      repCount: state.repCount,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const bothFlexed = Math.max(knees.left, knees.right) < SQUAT_THRESHOLD_DEG;
  const bothExtended =
    Math.min(knees.left, knees.right) > STAND_THRESHOLD_DEG;

  let { phase, repCount } = state;

  switch (phase) {
    case 'get_ready':
      if (bothFlexed) phase = 'squat';
      break;
    case 'squat':
      if (bothExtended) {
        repCount += 1;
        phase = 'stand_up';
      }
      break;
    case 'stand_up':
      if (bothFlexed) phase = 'squat';
      break;
  }

  const nextState: SquatState = { phase, repCount };
  const warning: SquatWarning | null = detectKneeValgus(points)
    ? 'knee_valgus'
    : null;

  return { detected: true, repCount, phase, warning, nextState };
}
