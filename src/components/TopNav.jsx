import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogIn, LogOut, Box } from "lucide-react";
import BBLogo from "./BBLogo.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function TopNav() {
  const navigate = useNavigate();
  const { isAuthed, loginMock, logoutMock } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <BBLogo size={36} />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide text-white/90">
                BB3D Studio
              </div>
              <div className="text-xs text-white/50">Design • 2026</div>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              [
                "rounded-xl px-3 py-2 text-sm",
                isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white",
              ].join(" ")
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/studio"
            className={({ isActive }) =>
              [
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white",
              ].join(" ")
            }
          >
            <Box size={16} />
            Studio
          </NavLink>

          {!isAuthed ? (
            <button
              onClick={() => {
                loginMock();
                navigate("/studio");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              type="button"
            >
              <LogIn size={16} />
              Login
            </button>
          ) : (
            <button
              onClick={() => {
                logoutMock();
                navigate("/");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              type="button"
            >
              <LogOut size={16} />
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
