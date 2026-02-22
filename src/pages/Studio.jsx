import React from "react";
import { Box, HardHat, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function Studio() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <HardHat size={14} />
          <span>Studio • in opbouw</span>
        </div>

        <h1 className="mt-4 flex items-center gap-3 text-2xl font-semibold text-white/90 md:text-3xl">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Box size={18} />
          </span>
          3D Studio (basis)
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
          Dit is straks de plek waar je 3D ontwerpen maakt (badkamers, tuinen, toiletten, etc.).
          We houden deze pagina nu expres simpel: eerst de basis van de webapp, daarna de echte 3D editor.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/85">
            <Lock size={16} />
            Login wordt verplicht
          </div>
          <p className="text-sm text-white/60">
            Straks kun je deze Studio alleen gebruiken als je bent ingelogd.
            Voor nu is dit nog “mock beveiligd” zodat de structuur alvast klopt.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-medium text-white/80 hover:text-white"
            >
              Terug naar Home
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/15"
            >
              Naar Login (placeholder)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
