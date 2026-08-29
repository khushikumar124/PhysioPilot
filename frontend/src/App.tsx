import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { TherapistLayout } from "./components/TherapistLayout";
import { PatientLayout } from "./components/PatientLayout";
import { FullPageSpinner } from "./components/ui/Spinner";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ClinicDashboardPage } from "./pages/therapist/ClinicDashboardPage";
import { NewPatientPage } from "./pages/therapist/NewPatientPage";
import { PatientProfilePage } from "./pages/therapist/PatientProfilePage";
import { PrescriptionBuilderPage } from "./pages/therapist/PrescriptionBuilderPage";
import { PatientHomePage } from "./pages/patient/PatientHomePage";
import { ExerciseSessionPage } from "./pages/patient/ExerciseSessionPage";
import { PatientProgressPage } from "./pages/patient/PatientProgressPage";
import { AssistantPage } from "./pages/patient/AssistantPage";

/** Send a signed-in user to the side of the product that belongs to them. */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "physiotherapist" ? "/clinic" : "/today"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* --- Physiotherapist ------------------------------------------- */}
      <Route
        element={
          <ProtectedRoute role="physiotherapist">
            <TherapistLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/clinic" element={<ClinicDashboardPage />} />
        <Route path="/clinic/patients/new" element={<NewPatientPage />} />
        <Route path="/clinic/patients/:patientId" element={<PatientProfilePage />} />
        <Route path="/clinic/patients/:patientId/plan" element={<PrescriptionBuilderPage />} />
      </Route>

      {/* --- Patient ---------------------------------------------------- */}
      <Route
        element={
          <ProtectedRoute role="patient">
            <PatientLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/today" element={<PatientHomePage />} />
        <Route path="/progress" element={<PatientProgressPage />} />
        <Route path="/help" element={<AssistantPage />} />
      </Route>

      {/* The session screen is full-bleed: no navigation chrome to tap by
          accident while the patient is exercising. */}
      <Route
        path="/today/session/:prescribedExerciseId"
        element={
          <ProtectedRoute role="patient">
            <ExerciseSessionPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
