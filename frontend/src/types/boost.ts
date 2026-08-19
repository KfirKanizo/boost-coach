/** Domain types mirroring the BoostCoach API contract (snake_case payloads). */

/** Polymorphic boost type driving the StudioFactory. */
export type BoostType = 'VISION_REP' | 'DURATION' | 'DISTANCE_GPS';

export type BoostStatus = 'pending' | 'completed' | 'skipped';

export interface Exercise {
  id: string;
  name_translations: Record<string, string>;
  primary_muscle: string;
  movement_pattern: string;
  equipment_required: string;
  boost_type: BoostType;
  animation_url?: string;
  instructions?: string[];
}

export interface Boost {
  id: string;
  status: BoostStatus;
  target_metrics: Record<string, unknown>;
  result_metrics: Record<string, unknown> | null;
  scheduled_date: string;
  exercise: Exercise;
}
