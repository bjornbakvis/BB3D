import React from "react";
import { Cuboid, HardHat, Lock } from "lucide-react";

export default function Studio() {
  return (
    <div className="space-y-6">
      <div className="bb-card p-8">
        <div className="flex items-center gap-3">
          <div className="bb-pill">
            <Cuboid size={14} /> Studio
          </div>
          <div className="bb-pill">
            <Lock size={14} /> Inloggen vereist
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">3D Studio (placeholder)</h1>

        <p className="mt-2 max-w-prose text-sm font-medium text-slate-600">
          Hier komt later de echte 3D editor. Nu zetten we alleen de basis neer:
          route, layout, en “beveiligde pagina” structuur.
        </p>
      </div>

      <div className="bb-card p-6">
        <div className="flex items-start gap-3">
          <HardHat size={18} className="mt-0.5 text-slate-700" />
          <div className="text-sm text-slate-700">
            <div className="font-extrabold text-slate-900">Wat bouwen we hierna?</div>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Een simpel tekenvlak: grid + muren tekenen</li>
              <li>Objecten plaatsen (bad, wc, planten)</li>
              <li>Opslaan/laden van een ontwerp</li>
              <li>Daarna pas: echte 3D weergave</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
