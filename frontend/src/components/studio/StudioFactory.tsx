import type { BoostType } from '../../types/boost';
import { MediaPipeCameraTracker } from './MediaPipeCameraTracker';
import { SimpleTimerTracker } from './SimpleTimerTracker';

export interface StudioFactoryProps {
  /**
   * Polymorphic boost type from the API (`boost_type`).
   * Dispatches to the matching execution environment.
   */
  boostType: BoostType;
  /** Countdown length (seconds) for timed boosts, e.g. VISION_REP. */
  durationSec?: number;
  /** When provided, the executed boost is reported as completed on finish. */
  boostId?: string;
}

/**
 * Dynamic renderer for Boost execution.
 *
 * Condition A: VISION_REP  -> MediaPipeCameraTracker (edge AI, M3+)
 * Condition B: DURATION    -> SimpleTimerTracker
 * Condition C: DISTANCE_GPS -> GeolocationTracker (future)
 *
 * Kept strictly on the main thread for Milestone 2; the heavy MediaPipe
 * Web Worker pipeline arrives in the next milestone.
 */
export function StudioFactory({ boostType, durationSec, boostId }: StudioFactoryProps) {
  switch (boostType) {
    case 'VISION_REP':
      return <MediaPipeCameraTracker durationSec={durationSec} boostId={boostId} />;
    case 'DURATION':
      return <SimpleTimerTracker initialSeconds={durationSec} boostId={boostId} />;
    default:
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-card bg-surface px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-ash">
            Unsupported boost type
          </p>
          <p className="font-display text-lg font-bold">{boostType}</p>
        </div>
      );
  }
}
