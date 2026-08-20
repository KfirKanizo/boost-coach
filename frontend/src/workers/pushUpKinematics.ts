/**
 * Deterministic push-up kinematics — pure math, no DOM, no MediaPipe imports.
 *
 * Runs inside the vision worker on the normalized 33-landmark pose output of
 * `PoseLandmarker` (COCO topology). Keeping this a pure module makes the rep
 * counter fully unit-testable in isolation.
 */

import type {
  LandmarkPoint,
  ExercisePhase,
  ExerciseWarning,
} from './visionProtocol';
import { angleAt, isVisible } from './kinematicsUtils';
import type { KinematicsEngine, ExerciseAnalysis } from './kinematicsEngine';

/** Re-export for backward compatibility with tests that import from here. */
export { angleAt } from './kinematicsUtils';

/** COCO 33-landmark pose indices relevant to push-up analysis. */
export const PUSH_UP_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/**
 * Angle thresholds (degrees) for the push-up state machine.
 * Arms extended → straight line at the elbow (> 160°).
 * Arms bent → elbow folded past 90°.
 */
export const EXTEND_THRESHOLD_DEG = 160;
export const BEND_THRESHOLD_DEG = 90;

/** Max perpendicular hip deviation (normalized) before triggering a warning. */
const HIP_SAG_THRESHOLD = 0.12;

export interface PushUpState {
  phase: ExercisePhase;
  repCount: number;
}

export interface PushUpAnalysis {
  detected: boolean;
  repCount: number;
  phase: ExercisePhase;
  warning: ExerciseWarning | null;
  nextState: PushUpState;
}

export function createInitialPushUpState(): PushUpState {
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
  const lShoulder = points[PUSH_UP_LANDMARKS.leftShoulder];
  const rShoulder = points[PUSH_UP_LANDMARKS.rightShoulder];
  const lElbow = points[PUSH_UP_LANDMARKS.leftElbow];
  const rElbow = points[PUSH_UP_LANDMARKS.rightElbow];
  const lWrist = points[PUSH_UP_LANDMARKS.leftWrist];
  const rWrist = points[PUSH_UP_LANDMARKS.rightWrist];

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
 * Hip-sag heuristic: the perpendicular distance of the mid-hip from the
 * shoulder–ankle line, normalized by the torso+leg length. A deviation
 * above `HIP_SAG_THRESHOLD` indicates the hips are sagging below the
 * straight line expected in a proper push-up plank.
 */
export function detectHipSag(points: LandmarkPoint[]): boolean {
  const sides: ReadonlyArray<[number, number, number, number, number, number]> =
    [
      [
        PUSH_UP_LANDMARKS.leftShoulder,
        PUSH_UP_LANDMARKS.leftHip,
        PUSH_UP_LANDMARKS.leftAnkle,
        PUSH_UP_LANDMARKS.rightShoulder,
        PUSH_UP_LANDMARKS.rightHip,
        PUSH_UP_LANDMARKS.rightAnkle,
      ],
      [
        PUSH_UP_LANDMARKS.rightShoulder,
        PUSH_UP_LANDMARKS.rightHip,
        PUSH_UP_LANDMARKS.rightAnkle,
        PUSH_UP_LANDMARKS.leftShoulder,
        PUSH_UP_LANDMARKS.leftHip,
        PUSH_UP_LANDMARKS.leftAnkle,
      ],
    ];

  for (const [sIdx, hIdx, aIdx] of sides) {
    const shoulder = points[sIdx];
    const hip = points[hIdx];
    const ankle = points[aIdx];
    if (!isVisible(shoulder) || !isVisible(hip) || !isVisible(ankle)) continue;

    // Mid-hip as average of left and right hips when both visible.
    const lHip = points[PUSH_UP_LANDMARKS.leftHip];
    const rHip = points[PUSH_UP_LANDMARKS.rightHip];
    let midHipX = hip.x;
    let midHipY = hip.y;
    if (isVisible(lHip) && isVisible(rHip)) {
      midHipX = (lHip.x + rHip.x) / 2;
      midHipY = (lHip.y + rHip.y) / 2;
    }

    // Shoulder-to-ankle vector (image coordinates).
    const abx = ankle.x - shoulder.x;
    const aby = ankle.y - shoulder.y;
    const lineLength = Math.hypot(abx, aby);
    if (lineLength === 0) continue;

    // Perpendicular distance from mid-hip to the shoulder–ankle line.
    const px = midHipX - shoulder.x;
    const py = midHipY - shoulder.y;
    const lateral = Math.abs(px * aby - py * abx) / lineLength;

    if (lateral / lineLength > HIP_SAG_THRESHOLD) return true;
  }
  return false;
}

/**
 * Advance the push-up state machine from a frame's elbow angles.
 *
 * - get_ready → down: both elbows flexed past `BEND_THRESHOLD_DEG`.
 * - down     → up: both elbows extended past `EXTEND_THRESHOLD_DEG`
 *             (counts one rep on this edge).
 * - up       → down: both elbows flexed again (next rep begins).
 *
 * When the pose is untrusted the state is frozen — no false counts.
 */
export function analyzePushUpFrame(
  points: LandmarkPoint[] | null,
  state: PushUpState,
): PushUpAnalysis {
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

  const bothFlexed = Math.max(elbows.left, elbows.right) < BEND_THRESHOLD_DEG;
  const bothExtended =
    Math.min(elbows.left, elbows.right) > EXTEND_THRESHOLD_DEG;

  let { phase, repCount } = state;

  switch (phase) {
    case 'get_ready':
      if (bothFlexed) phase = 'down';
      break;
    case 'down':
      if (bothExtended) {
        repCount += 1;
        phase = 'up';
      }
      break;
    case 'up':
      if (bothFlexed) phase = 'down';
      break;
    // Phases belonging to other exercise patterns — kept for exhaustive TS.
    case 'squat':
    case 'stand_up':
    case 'holding':
    case 'descending':
    case 'ascending':
    case 'hinged':
    case 'standing':
      break;
  }

  const nextState: PushUpState = { phase, repCount };
  const warning: ExerciseWarning | null = detectHipSag(points)
    ? 'hip_sag'
    : null;

  return { detected: true, repCount, phase, warning, nextState };
}

// ── Engine adapter ──────────────────────────────────────────────────

/** Push-up kinematics engine — wraps the pure functions above. */
export const pushEngine: KinematicsEngine = {
  pattern: 'push',
  warningJoints: [
    PUSH_UP_LANDMARKS.leftHip,
    PUSH_UP_LANDMARKS.rightHip,
  ],
  initialState: createInitialPushUpState,
  analyzeFrame(points, state): ExerciseAnalysis {
    const result = analyzePushUpFrame(points, state as PushUpState);
    return {
      detected: result.detected,
      repCount: result.repCount,
      phase: result.phase,
      warning: result.warning,
      nextState: result.nextState,
    };
  },
};
