import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ShieldCheck, Layers, Ruler, Wand2 } from "lucide-react";

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-black/70 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

function ButtonPrimary({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
    >
      {children}
    </Link>
  );
}

function ButtonGhost({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black/80 shadow-sm hover:bg-black/5"
    >
      {children}
    </Link>
  );
}

function Card({ icon, title, text }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5">
        {icon}
      </div>
      <div className="text-base font-semibold text-black/90">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-black/60">{text}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#f7f7f8]">
      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 md:pt-14">
        <div className="relative overflow-hidden rounded-[32px] border border-black/10 bg-white p-8 shadow-sm md:p-12">
          {/* zachte “glow” achtergrond */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-black/5 blur-3xl" />
            <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-black/5 blur-3xl" />
            <div className="absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-black/5 blur-3xl" />
          </div>

          <div className="relative">
            <Pill>
              <Sparkles size={14} />
              <span>BB3D Studio • Status maart 2026</span>
            </Pill>

            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-black md:text-5xl">
              3D ontwerpen voor niche bedrijven.
              <span className="text-black/50"> Badkamers, tuinen, toiletten.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/60 md:text-base">
              BB3D Studio is een professionele 3D configurator voor niche bedrijven (badkamer • toilet • tuin). De 3D Studio is live: je kunt onderdelen plaatsen, verplaatsen en verwijderen met snappen, collision prevention en templates.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonPrimary to="/studio">
                Start ontwerp <ArrowRight size={16} />
              </ButtonPrimary>
              <ButtonGhost to="/login">Login</ButtonGhost>
            </div>

            <div className="mt-5 text-xs text-black/45">
              Volgende stappen: rotatie-UX → maatvoering/metingen → opslaan & delen (met accounts/rechten).
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-black/80">Roadmap</div>
            <div className="mt-1 text-sm text-black/55">Kleine stappen, maar altijd stability-first: voorspelbaar gedrag zonder regressies.</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<ShieldCheck size={18} />}
            title="3D Studio (live)"
            text="Plaatsen, slepen en verwijderen van onderdelen in 3D. Basis workflow werkt in alle templates."
          />
          <Card
            icon={<Layers size={18} />}
            title="Snappen & collision"
            text="Snappen naar muren en objecten, clamping binnen de ruimte en collision prevention voor realistische plaatsing."
          />
          <Card
            icon={<Ruler size={18} />}
            title="Templates (badkamer/toilet/tuin)"
            text="Start vanuit een template en pas aan. Templates versnellen het ontwerpproces en maken testen consistent."
          />
          <Card
            icon={<Wand2 size={18} />}
            title="Rotatie-UX"
            text="Volgende stap: roteren met duidelijke handles, nette snapping/constraints en professionele micro-interacties."
          />
          <Card
            icon={<Sparkles size={18} />}
            title="Maatvoering & uitlijnen"
            text="Daarna: meten, maatlijnen en uitlijnen (overlays) zodat ontwerpen echt ‘planner-grade’ worden."
          />
          <Card
            icon={<ArrowRight size={18} />}
            title="Opslaan, delen & accounts"
            text="Opslaan per klant/project, delen via link/export. Accounts/rechten voegen we toe zodra de core UX af is."
          />
        </div>

        {/* FOOTER NOTE */}
        <div className="mt-8 rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/60 shadow-sm">
          <div className="font-semibold text-black/80">Wat staat er nu live?</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Werkende 3D Studio (React/Vite + Three.js / R3F) ✅</li>
            <li>Onderdelen plaatsen / verplaatsen / verwijderen ✅</li>
            <li>Snappen naar muren en objecten + collision/clamp ✅</li>
            <li>Stacking basics (o.a. countertop/sink logic) ✅</li>
            <li>Templates: badkamer / toilet / tuin ✅</li>
            <li>Camera views + reset ✅</li>
            <li>WebGL fallback (geen white screens bij disabled WebGL) ✅</li>
            <li>Routes: Home / Studio / Login ✅</li>
</ul>
        </div>
      </section>
    </main>
  );
}
