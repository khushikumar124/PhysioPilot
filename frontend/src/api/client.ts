/**
 * Thin API client.
 *
 * Every call goes through `request`, so token handling, JSON encoding and
 * error normalisation live in exactly one place. A 401 clears the stored
 * session and lets the auth context redirect to the login screen.
 */

import type {
  Adherence,
  AssistantReply,
  AssistantTurn,
  Exercise,
  ExercisePerformance,
  ExerciseSessionRecord,
  Patient,
  PatientSummary,
  Plan,
  PrescribedExerciseInput,
  ProgressSeries,
  RepSubmission,
  SessionResult,
  TherapistOverview,
  TodayRoutine,
  TokenResponse,
  User,
  UserRole,
} from "./types";

const TOKEN_KEY = "physiopilot.token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing: the session simply does not persist across reloads */
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection.");
  }

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("physiopilot:unauthorized"));
    throw new ApiError(401, "Your session has ended. Please sign in again.");
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      } else if (Array.isArray(payload.detail) && payload.detail.length) {
        // FastAPI validation errors arrive as a list of field problems.
        detail = payload.detail
          .map((issue: { loc?: (string | number)[]; msg?: string }) => {
            const field = issue.loc?.filter((p) => p !== "body").join(".");
            return field ? `${field}: ${issue.msg}` : issue.msg;
          })
          .join("; ");
      }
    } catch {
      /* non-JSON error body: keep the generic message */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  // --- auth ---------------------------------------------------------------
  login: (email: string, password: string) =>
    request<TokenResponse>("POST", "/api/auth/login", { email, password }),
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    clinic_name?: string;
  }) => request<TokenResponse>("POST", "/api/auth/register", payload),
  me: () => request<User>("GET", "/api/auth/me"),

  // --- catalogue ----------------------------------------------------------
  exercises: () => request<Exercise[]>("GET", "/api/exercises"),
  createExercise: (payload: {
    name: string;
    patient_cue: string;
    description?: string;
    body_region?: string;
    difficulty?: string;
  }) => request<Exercise>("POST", "/api/exercises", payload),

  // --- therapist ----------------------------------------------------------
  overview: () => request<TherapistOverview>("GET", "/api/patients/overview"),
  patients: () => request<PatientSummary[]>("GET", "/api/patients"),
  patient: (id: number) => request<Patient>("GET", `/api/patients/${id}`),
  createPatient: (payload: {
    name: string;
    email: string;
    password: string;
    date_of_birth?: string | null;
    phone?: string | null;
    notes?: string | null;
  }) => request<Patient>("POST", "/api/patients", payload),
  patientAdherence: (id: number, windowDays = 14) =>
    request<Adherence>("GET", `/api/patients/${id}/adherence?window_days=${windowDays}`),
  patientPerformance: (id: number) =>
    request<ExercisePerformance[]>("GET", `/api/patients/${id}/performance`),
  patientProgress: (id: number) => request<ProgressSeries[]>("GET", `/api/patients/${id}/progress`),
  patientSessions: (id: number, limit = 30) =>
    request<ExerciseSessionRecord[]>("GET", `/api/patients/${id}/sessions?limit=${limit}`),
  patientPlans: (id: number) => request<Plan[]>("GET", `/api/patients/${id}/plans`),
  createPlan: (
    patientId: number,
    payload: {
      title: string;
      condition: string;
      start_date: string;
      end_date: string | null;
      items: PrescribedExerciseInput[];
    },
  ) => request<Plan>("POST", `/api/patients/${patientId}/plans`, payload),
  updatePlan: (
    planId: number,
    payload: Partial<{
      title: string;
      condition: string;
      start_date: string;
      end_date: string | null;
      status: string;
      items: PrescribedExerciseInput[];
    }>,
  ) => request<Plan>("PATCH", `/api/plans/${planId}`, payload),

  // --- patient ------------------------------------------------------------
  routine: () => request<TodayRoutine>("GET", "/api/me/routine"),
  myAdherence: (windowDays = 14) =>
    request<Adherence>("GET", `/api/me/adherence?window_days=${windowDays}`),
  myProgress: () => request<ProgressSeries[]>("GET", "/api/me/progress"),
  mySessions: (limit = 20) =>
    request<ExerciseSessionRecord[]>("GET", `/api/me/sessions?limit=${limit}`),
  startSession: (prescribedExerciseId: number) =>
    request<ExerciseSessionRecord>("POST", "/api/sessions/start", {
      prescribed_exercise_id: prescribedExerciseId,
    }),
  completeSession: (
    sessionId: number,
    payload: {
      reps_attempted: number;
      tracking_mode: "camera" | "self_reported";
      pose_coverage?: number | null;
      reps: RepSubmission[];
      notes?: string | null;
    },
  ) => request<SessionResult>("POST", `/api/sessions/${sessionId}/complete`, payload),
  abandonSession: (sessionId: number) =>
    request<ExerciseSessionRecord>("POST", `/api/sessions/${sessionId}/abandon`),
  askAssistant: (message: string) =>
    request<AssistantReply>("POST", "/api/me/assistant", { message }),
  assistantHistory: () => request<AssistantTurn[]>("GET", "/api/me/assistant/history"),
};
