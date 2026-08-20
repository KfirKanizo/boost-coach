/**
 * Deterministic pull kinematics — pure math, no DOM, no MediaPipe imports.
 *
 * Handles exercises where the primary motion is elbow flexion against
 * resistance: curls (barbell, dumbbell, hammer, cable, preacher) and
 * horizontal/vertical pulls (bent-over row, seated cable row, lat pulldown,
 * pull-up, chin-up, T-bar row, dumbbell row).
 *
 * Biomechanically identical to push-up elbow tracking, but the state machine
 * is inverted: a rep is counted when the elbows return to full extension
 * (the eccentric / lowering phase completes the rep).
 *
 * State machine (rep counted on descending → get_ready edge):
 *
 *   get_ready  ──(elbows flex <90°)──►  ascending
 *   ascending  ──(elbows extend >160°)─►  descending  (+1 rep)
 *   descending ──(elbows flex <90°)──►  ascending
 */

import type {
  LandmarkPoint,
  ExercisePhase,
  ExerciseWarning,
} from './visionProtocol';
import { angleAt, isVisible } from './kinematicsUtils';
import type { KinematicsEngine, ExerciseAnalysis } from './kinematicsEngine';

/** COCO 33-landmark pose indices relevant to pull analysis. */
export const PULL_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
} as const;

/**
 * Angle thresholds (degrees) for the pull state machine.
 *
 * Arms extended → straight line at the elbow (> 160°).
 * Arms fully flexed → elbow folded past 90° (peak contraction).
 *
 * Same thresholds as push-up: the elbow joint is the same, just the
 * direction of the force vector differs.
 */
export const EXTEND_THRESHOLD_DEG = 160;
export const FLEX_THRESHOLD_DEG = 90;

export interface PullState {
  phase: ExercisePhase;
  repCount: number;
}

export interface PullAnalysis {
  detected: boolean;
  repCount: number;
  phase: ExercisePhase;
  warning: ExerciseWarning | null;
  nextState: PullState;
}

export function createInitialPullState(): PullState {
  return { phase: 'get_ready', repCount: 0 };
}

export interface ElbowAngles {
  left: number;
  right: number;
}

/**
 * Elbow flexion angles for both arms.
 * Uses shoulder–elbow–wrist (landmarks 11-13-15 left, 12-14-16 right).
 */
export function computeElbowAngles(
  points: LandmarkPoint[],
): ElbowAngles | null {
  const lShoulder = points[PULL_LANDMARKS.leftShoulder];
  const rShoulder = points[PULL_LANDMARKS.rightShoulder];
  const lElbow = points[PULL_LANDMARKS.leftElbow];
  const rElbow = points[PULL_LANDMARKS.rightElbow];
  const lWrist = points[PULL_LANDMARKS.leftWrist];
  const rWrist = points[PULL_LANDMARKS.rightWrist];

  if (
    !isVisible(lShoulder) ||
    !isVisible(rShoulder) ||
    !isVisible(lElbow) ||
    !isVisible(rElbow) ||
    !isVisible(lWrist) ||
    !isVisible(rWrist)
  ) {
    return null;
  }

  return {
    left: angleAt(lShoulder, lElbow, lWrist),
    right: angleAt(rShoulder, rElbow, rWrist),
  };
}

/**
 * Advance the pull state machine from a frame's elbow angles.
 *
 * - get_ready → ascending: both elbows flexed past `FLEX_THRESHOLD_DEG`.
 * - ascending → descending: both elbows extended past `EXTEND_THRESHOLD_DEG`
 *               (counts one rep on this edge — eccentric completes the rep).
 * - descending → ascending: both elbows flexed again (next rep begins).
 *
 * When the pose is untrusted the state is frozen — no false counts.
 */
export function analyzePullFrame(
  points: LandmarkPoint[] | null,
  state: PullState,
): PullAnalysis {
  if (!points || points.length < 33) {
    return {
      detected: false,
      repCount: state.repCount,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const elbows = computeElbowAngles(points);
  if (!elbows) {
    return {
      detected: false,
      repCount: state.repCount,
      phase: state.phase,
      warning: 'pose_lost',
      nextState: state,
    };
  }

  const bothFlexed = Math.max(elbows.left, elbows.right) < FLEX_THRESHOLD_DEG;
  const bothExtended =
    Math.min(elbows.left, elbows.right) > EXTEND_THRESHOLD_DEG;

  let { phase, repCount } = state;

  switch (phase) {
    case 'get_ready':
      if (bothFlexed) phase = 'ascending';
      break;
    case 'ascending':
      if (bothExtended) {
        repCount += 1;
        phase = 'descending';
      }
      break;
    case 'descending':
      if (bothFlexed) phase = 'ascending';
      break;
    // Phases belonging to other exercise patterns — kept for exhaustive TS.
    case 'squat':
    case 'stand_up':
    case 'down':
    case 'up':
    case 'holding':
    case 'hinged':
    case 'standing':
      break;
  }

  const nextState: PullState = { phase, repCount };

  return { detected: true, repCount, phase, warning: null, nextState };
}

// ── Engine adapter ──────────────────────────────────────────────────

/** Pull kinematics engine — wraps the pure functions above. */
export const pullEngine: KinematicsEngine = {
  pattern: 'pull',
  warningJoints: [],
  initialState: createInitialPullState,
  analyzeFrame(points, state): ExerciseAnalysis {
    const result = analyzePullFrame(points, state as PullState);
    return {
      detected: result.detected,
      repCount: result.repCount,
      phase: result.phase,
      warning: result.warning,
      nextState: result.nextState,
    };
  },
};
