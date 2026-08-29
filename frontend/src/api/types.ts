/** Types mirroring the FastAPI schemas in backend/app/schemas.py. */

export type UserRole = "physiotherapist" | "patient";
export type PlanStatus = "active" | "completed" | "paused";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type Trend = "improving" | "steady" | "declining" | "insufficient_data";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  patient_profile_id: number | null;
  therapist_profile_id: number | null;
  language: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Exercise {
  id: number;
  slug: string;
  name: string;
  description: string;
  patient_cue: string;
  body_region: string;
  difficulty: string;
  cv_supported: boolean;
  tracker_key: string | null;
  primary_metric: string | null;
  default_target_rom: number | null;
  /** True when a therapist wrote this exercise rather than it shipping built in. */
  is_custom: boolean;
}

export interface Patient {
  id: number;
  name: string;
  email: string;
  date_of_birth: string | null;
  phone: string | null;
  language: string;
  notes: string | null;
}

export interface PatientSummary {
  id: number;
  name: string;
  condition: string | null;
  active_plan_id: number | null;
  adherence_pct: number | null;
  quality_pct: number | null;
  last_session_at: string | null;
  trend: Trend;
  needs_attention: boolean;
  attention_reasons: string[];
}

export interface PrescribedExercise {
  id: number;
  exercise_id: number;
  sets: number;
  repetitions: number;
  hold_seconds: number | null;
  frequency_per_day: number;
  instructions: string;
  target_rom: number | null;
  order_index: number;
  active: boolean;
  exercise: Exercise;
}

export interface PrescribedExerciseInput {
  exercise_id: number;
  sets: number;
  repetitions: number;
  hold_seconds?: number | null;
  frequency_per_day: number;
  instructions: string;
  target_rom?: number | null;
}

export interface Plan {
  id: number;
  patient_id: number;
  therapist_id: number;
  title: string;
  condition: string;
  start_date: string;
  end_date: string | null;
  status: PlanStatus;
  prescribed_exercises: PrescribedExercise[];
}

export interface RoutineItem {
  prescribed_exercise_id: number;
  exercise: Exercise;
  sets: number;
  repetitions: number;
  hold_seconds: number | null;
  instructions: string;
  target_rom: number | null;
  sessions_due_today: number;
  sessions_done_today: number;
  completed_today: boolean;
}

export interface TodayRoutine {
  patient_name: string;
  plan_title: string | null;
  condition: string | null;
  items: RoutineItem[];
  sessions_done_this_week: number;
  sessions_due_this_week: number;
}

export interface Adherence {
  window_days: number;
  sessions_due: number;
  sessions_completed: number;
  adherence_pct: number | null;
  days_active: number;
  current_streak_days: number;
}

export interface ExercisePerformance {
  exercise_id: number;
  exercise_name: string;
  cv_supported: boolean;
  sessions: number;
  reps_attempted: number;
  reps_valid: number | null;
  quality_pct: number | null;
  latest_rom: number | null;
  best_rom: number | null;
  target_rom: number | null;
  trend: Trend;
}

export interface ProgressPoint {
  session_id: number | null;
  recorded_at: string;
  value: number;
}

export interface ProgressSeries {
  exercise_id: number;
  exercise_name: string;
  metric_type: string;
  unit: string;
  points: ProgressPoint[];
  trend: Trend;
}

export interface TherapistOverview {
  total_patients: number;
  patients_on_active_plans: number;
  sessions_completed_today: number;
  patients_needing_attention: number;
}

export interface ExerciseSessionRecord {
  id: number;
  patient_id: number;
  prescribed_exercise_id: number;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
  reps_prescribed: number;
  reps_attempted: number;
  reps_valid: number | null;
  quality_score: number | null;
  rom_max: number | null;
  rom_mean: number | null;
  tracking_mode: string;
  pose_coverage: number | null;
  feedback: string | null;
}

export interface RepRecord {
  index: number;
  min_angle: number;
  max_angle: number;
  rom: number;
  duration_seconds: number;
  valid: boolean;
  classification: string;
  reason: string | null;
}

export interface SessionResult extends ExerciseSessionRecord {
  exercise_name: string;
  reps: RepRecord[];
  patient_summary: string[];
}

export interface RepSubmission {
  index: number;
  min_angle: number;
  max_angle: number;
  duration_seconds: number;
  peak_velocity?: number | null;
  mean_visibility?: number | null;
}

export interface AssistantReply {
  reply: string;
  source: string;
  redirected: boolean;
  suggestions: string[];
}

export interface AssistantTurn {
  id: number;
  created_at: string;
  user_message: string;
  assistant_response: string;
}
