import React from "react";
import { ArrowRight, Sparkles, ShieldCheck, Layers3, Ruler, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="bb-card relative overflow-hidden p-8">
        {/* subtle background */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-slate-900 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-slate-900 blur-3xl" />
        </div>

        <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <div className="bb-pill inline-flex">
              <Sparkles size={14} />
              <span>3D ontwerpen voor niche bedrijven</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Maak in minuten een strak 3D ontwerp — voor badkamers, tuinen, toiletten en meer.
            </h1>

            <p className="max-w-prose text-base font-medium text-slate-600">
              Dit project is de basis. Vandaag bouwen we de “lege maar stevige” webapp: navigatie, homepagina,
              en alvast een plek voor een Studio-pagina die later achter inloggen komt.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/studio" className="bb-btn-primary">
                Begin met een ontwerp <ArrowRight size={16} />
              </Link>
              <a
                href="#plan"
                className="bb-btn-ghost"
              >
                Bekijk het plan
              </a>
            </div>
          </div>

          <div className="bb-card p-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="bb-pill">
                  <Layers3 size={14} /> Modules
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Projecten, klanten, ontwerpen</div>
                  <div className="text-sm text-slate-600">
                    Straks per klant meerdere ontwerpen opslaan en delen.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bb-pill">
                  <Ruler size={14} /> Precisie
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Meters & maten</div>
                  <div className="text-sm text-slate-600">
                    Later: slimme maatvoering, snapping en templates.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bb-pill">
                  <Wand2 size={14} /> Slim
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Assistent & presets</div>
                  <div className="text-sm text-slate-600">
                    Later: AI-hulp voor indelingen en materiaalkeuze.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bb-pill">
                  <ShieldCheck size={14} /> Veilig
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Inloggen verplicht</div>
                  <div className="text-sm text-slate-600">
                    Ontwerpen maken/bekijken alleen voor ingelogde gebruikers.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="plan" className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Plan (simpel en stap-voor-stap)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bb-card p-6">
            <div className="text-sm font-extrabold text-slate-900">Stap 1 — Basis webapp</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Homepagina + navigatie (klaar ✅)</li>
              <li>Studio placeholder pagina (klaar ✅)</li>
              <li>Login placeholder + “ProtectedRoute” (klaar ✅)</li>
            </ul>
          </div>

          <div className="bb-card p-6">
            <div className="text-sm font-extrabold text-slate-900">Stap 2 — Echte login (later)</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Backend endpoints: /api/login, /api/logout, /api/session</li>
              <li>Session-cookie (veilig, HttpOnly)</li>
              <li>Studio alleen bereikbaar als session geldig is</li>
            </ul>
          </div>

          <div className="bb-card p-6">
            <div className="text-sm font-extrabold text-slate-900">Stap 3 — 3D engine kiezen (later)</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Start simpel: 2D grid + “muren” tekenen</li>
              <li>Daarna: 3D view + basis objecten (bad, wc, planten)</li>
              <li>Opslaan, laden, delen</li>
            </ul>
          </div>

          <div className="bb-card p-6">
            <div className="text-sm font-extrabold text-slate-900">Stap 4 — Producten & prijzen (later)</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Catalogus (tegels, kranen, meubels, planten)</li>
              <li>Offerte/export (PDF) per ontwerp</li>
              <li>Rechten: wie mag wat zien/bewerken</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="text-center text-xs font-semibold text-slate-500">
        BB 3D Studio • basisproject • gebouwd met React + Vite + Tailwind
      </footer>
    </div>
  );
}
