/**
 * Deterministic plank kinematics — pure math, no DOM, no MediaPipe imports.
 *
 * Runs inside the vision worker on the normalized 33-landmark pose output of
 * `PoseLandmarker` (COCO topology). Keeping this a pure module makes the
 * duration tracker fully unit-testable in isolation.
 *
 * The plank is a duration-based exercise: no reps, just "holding" the position
 * with correct form. The worker reports the `holding` phase when the body is
 * aligned, and `get_ready` when it is not. The main-thread timer counts down
 * only while the phase is `holding`.
 */

import type {
  LandmarkPoint,
  ExercisePhase,
  ExerciseWarning,
} from './visionProtocol';

/** COCO 33-landmark pose indices relevant to plank analysis. */
export const PLANK_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/**
 * Angle thresholds (degrees) for the plank state machine.
 *
 * The shoulder–hip–ankle angle should be ≈180° for a straight plank.
 * We use a generous window around 180° to allow for natural body sway.
 */
export const STRAIGHT_THRESHOLD_DEG = 165;

/**
 * Perpendicular deviation thresholds (normalised by the shoulder–ankle line
 * length).  Positive = hip below the line (sag), negative = hip above (pike).
 */
export const HIP_SAG_THRESHOLD = 0.08;
export const HIP_PIKE_THRESHOLD = 0.08;

/** Min visibility for a landmark to be trusted. */
const MIN_VISIBILITY = 0.5;

export interface PlankState {
  phase: ExercisePhase;
  /** Accumulated holding time in milliseconds (reported to the main thread). */
  holdMs: number;
}

export interface PlankAnalysis {
  detected: boolean;
  repCount: number;
  phase: ExercisePhase;
  warning: ExerciseWarning | null;
  nextState: PlankState;
}

export function createInitialPlankState(): PlankState {
  return { phase: 'get_ready', holdMs: 0 };
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

/**
 * Compute the best-visibility shoulder–hip–ankle alignment angles for both
 * sides.  If both sides are visible, returns the average.  Returns null when
 * too few landmarks are visible.
 */
export function computeAlignment(points: LandmarkPoint[]): {
  angle: number;
  deviation: number;
} | null {
  const sides: ReadonlyArray<[number, number, number]> = [
    [PLANK_LANDMARKS.leftShoulder, PLANK_LANDMARKS.leftHip, PLANK_LANDMARKS.leftAnkle],
    [PLANK_LANDMARKS.rightShoulder, PLANK_LANDMARKS.rightHip, PLANK_LANDMARKS.rightAnkle],
  ];

  let totalAngle = 0;
  let totalDeviation = 0;
  let count = 0;

  for (const [sIdx, hIdx, aIdx] of sides) {
    const shoulder = points[sIdx];
    const hip = points[hIdx];
    const ankle = points[aIdx];
    if (!isVisible(shoulder) || !isVisible(hip) || !isVisible(ankle)) continue;

    totalAngle += angleAt(shoulder, hip, ankle);

    // Perpendicular deviation of hip from the shoulder–ankle line.
    // Positive = hip below line (sag), negative = hip above (pike).
    const abx = ankle.x - shoulder.x;
    const aby = ankle.y - shoulder.y;
    const lineLength = Math.hypot(abx, aby);
    if (lineLength === 0) continue;

    const px = hip.x - shoulder.x;
    const py = hip.y - shoulder.y;
    // Cross product sign determines which side of the line the hip falls on.
    const cross = px * aby - py * abx;
    const lateral = Math.abs(cross) / lineLength;
    // Normalise by line length and apply sign.
    const deviation = (cross > 0 ? lateral : -lateral) / lineLength;
    totalDeviation += deviation;
    count += 1;
  }

  if (count === 0) return null;

  return {
    angle: totalAngle / count,
    deviation: totalDeviation / count,
  };
}

/**
 * Advance the plank state machine from a frame's body alignment.
 *
 * - get_ready → holding: shoulder–hip–ankle angle crosses above
 *               `STRAIGHT_THRESHOLD_DEG` (body is straight).
 * - holding  → get_ready: angle drops below threshold (form broken).
 *
 * When the pose is untrusted the state is frozen — no false timing.
 */
export function analyzePlankFrame(
  points: LandmarkPoint[] | null,
  state: PlankState,
  frameDeltaMs: number,
): PlankAnalysis {
  if (!points || points.length < 33) {
    return {
      detected: false,
      repCount: 0,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const alignment = computeAlignment(points);
  if (!alignment) {
    return {
      detected: false,
      repCount: 0,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const { angle, deviation } = alignment;
  const isStraight = angle >= STRAIGHT_THRESHOLD_DEG;

  let { phase, holdMs } = state;

  switch (phase) {
    case 'get_ready':
      if (isStraight) {
        phase = 'holding';
        holdMs += frameDeltaMs;
      }
      break;
    case 'holding':
      if (!isStraight) {
        phase = 'get_ready';
      } else {
        holdMs += frameDeltaMs;
      }
      break;
    // Rep-based phases — unreachable but keeps TS exhaustive.
    case 'squat':
    case 'stand_up':
    case 'down':
    case 'up':
      break;
  }

  let warning: ExerciseWarning | null = null;
  if (isStraight) {
    if (deviation > HIP_SAG_THRESHOLD) {
      warning = 'hip_sag';
    } else if (deviation < -HIP_PIKE_THRESHOLD) {
      warning = 'hip_pike';
    }
  }

  const nextState: PlankState = { phase, holdMs };
  return { detected: true, repCount: 0, phase, warning, nextState };
}
