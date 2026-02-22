import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogIn, LogOut, Cuboid } from "lucide-react";
import BBLogo from "./BBLogo.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function TopNav() {
  const navigate = useNavigate();
  const { isAuthenticated, loginMock, logoutMock } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <BBLogo size={34} />
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight text-slate-900">BB 3D Studio</div>
            <div className="text-xs font-semibold text-slate-500">Concept • 2026</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `bb-pill transition ${isActive ? "border-slate-400 text-slate-900" : "hover:bg-slate-100"}`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/studio"
            className={({ isActive }) =>
              `bb-pill transition ${isActive ? "border-slate-400 text-slate-900" : "hover:bg-slate-100"}`
            }
          >
            <span className="flex items-center gap-2">
              <Cuboid size={14} />
              Studio
            </span>
          </NavLink>

          <div className="ml-2 h-7 w-px bg-slate-200" />

          {!isAuthenticated ? (
            <button
              type="button"
              className="bb-btn-primary"
              onClick={() => {
                // Voor nu: mock login, zodat je de flow kunt testen.
                // Later vervangen door echte login pagina + backend.
                loginMock();
                navigate("/studio");
              }}
              title="Voor nu: mock login"
            >
              <LogIn size={16} />
              Naar Studio
            </button>
          ) : (
            <button
              type="button"
              className="bb-btn-ghost"
              onClick={() => {
                logoutMock();
                navigate("/");
              }}
              title="Uitloggen (mock)"
            >
              <LogOut size={16} />
              Uitloggen
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
