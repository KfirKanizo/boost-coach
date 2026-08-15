/**
 * Message protocol between the main React thread and the vision worker.
 *
 * Keep payloads small: the main thread must never receive raw frames or
 * large buffers — only normalized landmark coordinates and derived state.
 */

/** A single normalized landmark (0..1 coordinates, depth in `z`). */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Squat phase machine states, surfaced to the HUD. */
export type SquatPhase = 'get_ready' | 'squat' | 'stand_up';

/** Posture warnings detected by the kinematic analysis. */
export type SquatWarning = 'knee_valgus' | 'pose_lost';

export type VisionWorkerRequest = {
  /** A zero-copy video frame transferred into the worker. */
  type: 'FRAME';
  bitmap: ImageBitmap;
  /** Monotonic timestamp (ms) required by VIDEO-mode landmark tracking. */
  timestampMs: number;
};

export type VisionWorkerResponse =
  | { type: 'READY' }
  | {
      type: 'RESULTS';
      frame: {
        /** Skeleton for the HUD overlay, or null when no pose was detected. */
        landmarks: LandmarkPoint[] | null;
        repCount: number;
        phase: SquatPhase;
        warning: SquatWarning | null;
      };
    }
  | {
      /**
       * Anonymous performance telemetry. Only aggregate FPS numbers and a
       * frame count are posted — never frames, landmarks, or PII.
       */
      type: 'TELEMETRY';
      /** Rolling average inference FPS over the recent window. */
      fps: number;
      framesProcessed: number;
    }
  | { type: 'ERROR'; message: string };
