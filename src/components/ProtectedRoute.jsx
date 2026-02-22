import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Later wordt dit "echt":
 * - check session via /api/session
 * - als niet ingelogd: naar /login
 *
 * Voor nu:
 * - als je niet 'mock ingelogd' bent, sturen we je naar /login.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
