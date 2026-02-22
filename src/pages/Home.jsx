import React from "react";
import { ArrowRight, Sparkles, ShieldCheck, Layers, Ruler, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

function Feature({ icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        {icon}
      </div>
      <div className="text-base font-semibold text-white/90">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-white/60">{text}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 md:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-28 right-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <Sparkles size={14} />
            <span>2026 • BB3D Studio (basis)</span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Ontwerp in 3D voor niche bedrijven
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
            Maak straks professionele 3D ontwerpen voor badkamers, tuinen en meer.
            Vandaag leggen we de basis: een strakke homepagina, navigatie en een “Studio” pagina die later
            achter een echte login komt.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/studio"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/15"
            >
              Naar de Studio
              <ArrowRight size={16} />
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-medium text-white/80 hover:text-white"
            >
              Login (placeholder)
            </Link>
          </div>

          <div className="mt-6 text-xs text-white/45">
            Tip: Studio is nu “mock beveiligd”. Straks maken we echte login + sessies.
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 text-sm font-semibold text-white/80">Wat bouwen we hierna?</div>

        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={<ShieldCheck size={18} />}
            title="Echte login (verplicht)"
            text="Straks moet je eerst inloggen voordat je ontwerpen kunt maken of bekijken."
          />
          <Feature
            icon={<Layers size={18} />}
            title="3D lagen & onderdelen"
            text="Denk aan muren, tegels, meubels, planten. Alles als ‘blokken’ die je kunt plaatsen."
          />
          <Feature
            icon={<Ruler size={18} />}
            title="Meten & maatvoering"
            text="Handige hulpmiddelen: maten, grid, snapping en nette uitlijning."
          />
          <Feature
            icon={<Wand2 size={18} />}
            title="Slimme templates"
            text="Snelle start voor badkamer/tuin/toilet met slimme standaard layouts."
          />
          <Feature
            icon={<Sparkles size={18} />}
            title="Mooi renderen"
            text="Later: mooi licht, materialen en een ‘presentatie’ modus voor klanten."
          />
          <Feature
            icon={<ArrowRight size={18} />}
            title="Opslaan & delen"
            text="Ontwerpen opslaan per klant en delen via link/export."
          />
        </div>
      </section>
    </main>
  );
}
