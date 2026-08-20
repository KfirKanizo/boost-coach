export type BoostType = 'VISION_REP' | 'DURATION';

export interface Exercise {
  id: string;
  name_translations: Record<string, string>;
  primary_muscle: string;
  movement_pattern: string;
  equipment_required: string;
  boost_type: string;
  animation_url?: string;
  instructions?: string[];
}

export interface BoostTargetMetrics {
  sets?: number;
  reps?: number;
  duration_sec?: number;
}

export interface BoostResultMetrics {
  reps_completed?: number;
  duration_sec?: number;
}

export interface Boost {
  id: string;
  status: 'pending' | 'completed' | 'skipped';
  target_metrics: BoostTargetMetrics;
  result_metrics: BoostResultMetrics | null;
  scheduled_date: string;
  exercise: Exercise;
}
