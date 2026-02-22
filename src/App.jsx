import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/TopNav.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Studio from "./pages/Studio.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Studio is later "echt" 3D. Nu alleen een veilige placeholder. */}
          <Route
            path="/studio"
            element={
              <ProtectedRoute>
                <Studio />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
