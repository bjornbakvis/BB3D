import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginMock } = useAuth();

  const from = location.state?.from || "/studio";

  return (
    <div className="mx-auto max-w-xl">
      <div className="bb-card p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Inloggen</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Deze pagina is nu nog een placeholder. Straks komt hier echte login (met backend + session-cookie).
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-bold text-slate-900">Voor nu (test):</div>
          <div>Druk op de knop om “mock” in te loggen, zodat je de flow kunt zien.</div>
        </div>

        <button
          type="button"
          className="mt-6 bb-btn-primary"
          onClick={() => {
            loginMock();
            navigate(from, { replace: true });
          }}
        >
          <LogIn size={16} />
          Mock inloggen
        </button>
      </div>
    </div>
  );
}
