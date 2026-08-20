/**
 * Pluggable kinematics engine interface and registry.
 *
 * Each exercise pattern (squat, push, pull, core, hinge) implements the
 * `KinematicsEngine` interface. The vision worker dispatches frames to
 * the engine registered for the active `MovementPattern`.
 *
 * Adding a new exercise pattern requires:
 * 1. Create a new `*Kinematics.ts` module implementing `KinematicsEngine`.
 * 2. Register it in the `engines` map below.
 * 3. Add the pattern to `MovementPattern` in `visionProtocol.ts`.
 * No worker edits are needed beyond the registry registration.
 */

import type {
  LandmarkPoint,
  MovementPattern,
  ExercisePhase,
  ExerciseWarning,
} from './visionProtocol';

// ── Shared types ────────────────────────────────────────────────────────────

/** Canonical state shape across all kinematics engines. */
export interface ExerciseState {
  phase: ExercisePhase;
  repCount: number;
  /** Accumulated holding time in ms (duration-based exercises only). */
  holdMs?: number;
}

/** Canonical analysis result returned by every engine. */
export interface ExerciseAnalysis {
  detected: boolean;
  repCount: number;
  phase: ExercisePhase;
  warning: ExerciseWarning | null;
  nextState: ExerciseState;
}

/** Every kinematics module must implement this interface. */
export interface KinematicsEngine {
  /** The movement pattern this engine handles. */
  pattern: MovementPattern;

  /** Create a fresh state for the start of a set. */
  initialState(): ExerciseState;

  /**
   * Analyze a single frame and return the updated state.
   *
   * @param points  33 COCO landmarks (null when pose is lost).
   * @param state   Current exercise state from the previous frame.
   * @param deltaMs Milliseconds since the last frame (used by duration-based
   *                exercises like plank; ignored by rep-based engines).
   */
  analyzeFrame(
    points: LandmarkPoint[] | null,
    state: ExerciseState,
    deltaMs?: number,
  ): ExerciseAnalysis;

  /**
   * COCO landmark indices whose joints should be highlighted crimson when
   * the engine reports a warning. Used by `SkeletonOverlay`.
   */
  warningJoints: readonly number[];
}

// ── Engine registry ─────────────────────────────────────────────────────────

import { squatEngine } from './squatKinematics';
import { pushEngine } from './pushUpKinematics';
import { plankEngine } from './plankKinematics';

const engines = new Map<MovementPattern, KinematicsEngine>([
  ['squat', squatEngine],
  ['push', pushEngine],
  ['core', plankEngine],
]);

/**
 * Return the kinematics engine for the given pattern.
 * Falls back to squat for unrecognized patterns (defensive).
 */
export function getEngine(pattern: MovementPattern): KinematicsEngine {
  return engines.get(pattern) ?? squatEngine;
}
