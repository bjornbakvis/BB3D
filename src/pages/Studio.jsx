import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "lucide-react";
import StudioScene from "../components/StudioScene.jsx";

function nowTime() {
  const d = new Date();
  return d.toLocaleString();
}

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function Studio() {
  // Project (stap 2)
  const [projectName, setProjectName] = useState("Nieuw ontwerp");
  const [lastSaved, setLastSaved] = useState("");

  // Editor state (stap 1)
  const [tool, setTool] = useState("select"); // select | place | move | delete
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Undo/Redo (A)
  const undoStackRef = useRef([]); // stack of {objects, selectedId}
  const redoStackRef = useRef([]); // stack of {objects, selectedId}
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function pushUndoSnapshot(nextRedoClear = true) {
    // Store current state before a change
    undoStackRef.current.push({
      objects: deepClone(objects),
      selectedId,
    });
    if (nextRedoClear) redoStackRef.current = [];
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }

  function undo() {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    // Move current into redo
    redoStackRef.current.push({
      objects: deepClone(objects),
      selectedId,
    });
    setObjects(prev.objects);
    setSelectedId(prev.selectedId ?? null);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }

  function redo() {
    const nxt = redoStackRef.current.pop();
    if (!nxt) return;
    // Move current into undo
    undoStackRef.current.push({
      objects: deepClone(objects),
      selectedId,
    });
    setObjects(nxt.objects);
    setSelectedId(nxt.selectedId ?? null);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }

  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
  useEffect(() => {
    function onKeyDown(e) {
      const key = (e.key || "").toLowerCase();
      const isMac = /mac/i.test(navigator.platform || "");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (key === "y") {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [objects, selectedId]);

  // Default “block” dat we plaatsen
  const defaultBlock = useMemo(
    () => ({
      w: 1.2,
      h: 0.9,
      d: 0.6,
      color: "Stone",
      y: 0,
      rotY: 0, // degrees

    }),
    []
  );

  const selectedObj = useMemo(
    () => objects.find((o) => o.id === selectedId) || null,
    [objects, selectedId]
  );

  function newProject() {
    pushUndoSnapshot();
    setProjectName("Nieuw ontwerp");
    setObjects([]);
    setSelectedId(null);
    setTool("select");
    setLastSaved("");
  }

  function saveProject() {
    // Nog geen database: we “doen alsof” we opslaan
    setLastSaved(nowTime());
  }

  function onCanvasClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    // Klik op leeg canvas met tool "place" -> plaats blok
    if (tool === "place") {
      const id = `obj_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      const newObj = {
        id,
        type: "Block",
        // we bewaren pos als percentages zodat het responsive blijft
        px: x / rect.width,
        py: y / rect.height,
        ...defaultBlock,
      };
      setObjects((prev) => [...prev, newObj]);
      setSelectedId(id);
      return;
    }

    // Anders: klik op leeg canvas -> deselect
    setSelectedId(null);
  }

  function onObjectClick(e, id) {
    e.stopPropagation();

    if (tool === "delete") {
      pushUndoSnapshot();
      setObjects((prev) => prev.filter((o) => o.id !== id));
      if (selectedId === id) setSelectedId(null);
      return;
    }

    setSelectedId(id);
  }

  function updateSelected(patch) {
    if (!selectedObj) return;
    pushUndoSnapshot();
    setObjects((prev) =>
      prev.map((o) => (o.id === selectedObj.id ? { ...o, ...patch } : o))
    );
  }

  function handlePlaceAt(x, z) {
    if (tool !== "place") return;
    pushUndoSnapshot();

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    // keep a lightweight 0..1 mapping too, so this stays responsive-friendly later
    const px = clamp(0.5 + x / 10, 0, 1);
    const py = clamp(0.5 + z / 10, 0, 1);

    const id = `obj_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const newObj = {
      id,
      type: "Block",
      x,
      z,
      px,
      py,
      ...defaultBlock,
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(id);
  }
  function handleMoveStart(id) {
    if (tool !== "move") return;
    pushUndoSnapshot();
  }

  function handleMoveAt(id, x, z) {
    // Move only when the tool is "move"
    if (tool !== "move") return;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const px = clamp(0.5 + x / 10, 0, 1);
    const py = clamp(0.5 + z / 10, 0, 1);

    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x, z, px, py } : o))
    );
  }


  function handleObjectClick3D(id) {
    if (tool === "delete") {
      pushUndoSnapshot();
      setObjects((prev) => prev.filter((o) => o.id !== id));
      if (selectedId === id) setSelectedId(null);
      return;
    }
    setSelectedId(id);
  }

  // “Canvas” styling: grid look (zonder echte 3D)
  const gridStyle = {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
    backgroundSize: "36px 36px",
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#f7f7f8]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header / Project bar */}
        <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5">
                <Box size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-black/85">Studio</div>
                <div className="text-xs text-black/50">
                  {lastSaved ? `Laatst opgeslagen: ${lastSaved}` : "Nog niet opgeslagen"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/80 shadow-sm outline-none focus:border-black/20 sm:w-[260px]"
                placeholder="Projectnaam"
              />

              <button
                onClick={newProject}
                type="button"
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black/80 shadow-sm hover:bg-black/5"
              >
                Nieuw project
              </button>

              <div className="flex gap-2">
                <button
                  onClick={undo}
                  type="button"
                  disabled={!canUndo}
                  className={clsx(
                    "rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm",
                    canUndo
                      ? "border-black/10 bg-white text-black/80 hover:bg-black/5"
                      : "border-black/10 bg-white text-black/30 opacity-60 cursor-not-allowed"
                  )}
                >
                  Undo
                </button>
                <button
                  onClick={redo}
                  type="button"
                  disabled={!canRedo}
                  className={clsx(
                    "rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm",
                    canRedo
                      ? "border-black/10 bg-white text-black/80 hover:bg-black/5"
                      : "border-black/10 bg-white text-black/30 opacity-60 cursor-not-allowed"
                  )}
                >
                  Redo
                </button>
              </div>

              <button
                onClick={saveProject}
                type="button"
                className="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Editor layout */}
        <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr_280px]">
          {/* LEFT: Tools */}
          <aside className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-black/80">Tools</div>
            <div className="mt-3 grid gap-2">
              <ToolButton label="Select" active={tool === "select"} onClick={() => setTool("select")} />
              <ToolButton label="Plaats blok" active={tool === "place"} onClick={() => setTool("place")} />
              <ToolButton label="Verplaats" active={tool === "move"} onClick={() => setTool("move")} />
              <ToolButton label="Verwijder" active={tool === "delete"} onClick={() => setTool("delete")} />
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-3 text-xs text-black/60">
              <div className="font-semibold text-black/75">Hoe werkt het nu?</div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Kies “Plaats blok” en klik in het 3D werkvlak.</li>
                <li>Klik op een blok om te selecteren.</li>
                <li>Kies “Verplaats” en sleep een blok om te verplaatsen.</li>
                <li>Kies “Verwijder” en klik op een blok om te verwijderen.</li>
              </ul>
            </div>
          </aside>

          {/* CENTER: Canvas */}
          <section className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-black/80">Werkvlak</div>
                <div className="text-xs text-black/50">
                  Tool: <span className="font-semibold text-black/70">{tool}</span> • Objecten:{" "}
                  <span className="font-semibold text-black/70">{objects.length}</span>
                </div>
              </div>

              <div className="text-xs text-black/45">
                (3D komt hierna — dit is nu de “basis editor”)
              </div>
            </div>

            <div className="mt-4 h-[520px] w-full overflow-hidden rounded-3xl border border-black/10">
              <StudioScene
                objects={objects}
                selectedId={selectedId}
                tool={tool}
                onPlaceAt={handlePlaceAt}
                onObjectClick={handleObjectClick3D}
                onMoveStart={handleMoveStart}
                onMove={handleMoveAt}
              />
            </div>
          </section>

          {/* RIGHT: Properties */}
          <aside className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-black/80">Eigenschappen</div>

            {!selectedObj ? (
              <div className="mt-3 rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-black/60">
                Klik op een object om eigenschappen te zien.
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="text-xs text-black/50">Geselecteerd</div>
                  <div className="mt-1 text-sm font-semibold text-black/80">
                    {selectedObj.type} • {selectedObj.id}
                  </div>
                </div>

                <LabeledNumber
                  label="Breedte (w)"
                  value={selectedObj.w}
                  onChange={(v) => updateSelected({ w: v })}
                />
                <LabeledNumber
                  label="Hoogte (h)"
                  value={selectedObj.h}
                  onChange={(v) => updateSelected({ h: v })}
                />
                <LabeledNumber
                  label="Diepte (d)"
                  value={selectedObj.d}
                  onChange={(v) => updateSelected({ d: v })}
                />

                <LabeledNumber
                  label="Hoogte boven vloer (y)"
                  value={selectedObj.y ?? 0}
                  step={0.1}
                  onChange={(v) => updateSelected({ y: Math.max(0, v) })}
                />

                <LabeledNumber
                  label="Rotatie (°)"
                  value={selectedObj.rotY ?? 0}
                  step={1}
                  onChange={(v) => updateSelected({ rotY: v })}
                />

                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="text-xs font-semibold text-black/70">Kleur / materiaal</div>
                  <select
                    value={selectedObj.color}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-black/80 shadow-sm outline-none focus:border-black/20"
                  >
                    <option>Stone</option>
                    <option>Wood</option>
                    <option>Concrete</option>
                    <option>White</option>
                    <option>Black</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-black/10 bg-black/5 p-4 text-xs text-black/60">
                  <div className="font-semibold text-black/75">Volgende stap</div>
                  <div className="mt-1">
                    Dit werkvlak wordt straks een echte 3D scene. De objecten die je nu “plaatst”, gaan we dan
                    echt als 3D blokken tekenen.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function ToolButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-2xl border px-3 py-3 text-left text-sm font-medium shadow-sm",
        active ? "border-black/20 bg-black text-white" : "border-black/10 bg-white text-black/75 hover:bg-black/5"
      )}
    >
      {label}
    </button>
  );
}

function LabeledNumber({ label, value, onChange, step = 0.1 }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold text-black/70">{label}</div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-black/80 shadow-sm outline-none focus:border-black/20"
      />
    </div>
  );
}
