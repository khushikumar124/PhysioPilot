/** Route guard: requires a session, and optionally a specific role. */

import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../api/types";
import { FullPageSpinner } from "../components/ui/Spinner";

export function ProtectedRoute({ role, children }: { role?: UserRole; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Loading your account" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) {
    // Signed in, but on the wrong side of the product: send them home.
    return <Navigate to={user.role === "physiotherapist" ? "/clinic" : "/today"} replace />;
  }
  return <>{children}</>;
}
