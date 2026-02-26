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

  // Ruimte / templates (Stap A)
  const TEMPLATES = useMemo(() => ({
    badkamer: { label: "Badkamer", roomW: 3.0, roomD: 2.0, wallH: 2.4, showWalls: true },
    toilet: { label: "Toilet", roomW: 1.2, roomD: 1.0, wallH: 2.4, showWalls: true },
    tuin: { label: "Tuin", roomW: 8.0, roomD: 5.0, wallH: 1.2, showWalls: true },
    leeg: { label: "Lege ruimte", roomW: 6.0, roomD: 6.0, wallH: 2.4, showWalls: false },
  }), []);

  const [templateId, setTemplateId] = useState("badkamer");
  const [roomW, setRoomW] = useState(TEMPLATES.badkamer.roomW);
  const [roomD, setRoomD] = useState(TEMPLATES.badkamer.roomD);
  const [wallH, setWallH] = useState(TEMPLATES.badkamer.wallH);
  const [showWalls, setShowWalls] = useState(TEMPLATES.badkamer.showWalls);


  // Editor state (stap 1)
  const [tool, setTool] = useState("select"); // select | place | move | delete
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [cameraAction, setCameraAction] = useState(null);

  const requestCamera = (type) => {
    setCameraAction({ type, selectedId, nonce: Date.now() });
  };

  // Undo/Redo (A)
  const undoStackRef = useRef([]); // stack of {objects, selectedId}
  const redoStackRef = useRef([]); // stack of {objects, selectedId}
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function deepClone(v) {
    // Stability: prefer structuredClone when available (keeps numbers/arrays safer & faster).
    // Fallback stays JSON-based (objects in this app are plain data).
    if (typeof structuredClone === "function") return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  }

  function pushUndoSnapshot(nextRedoClear = true) {
    // Store current state before a change
    undoStackRef.current.push({
      objects: deepClone(objects),
      selectedId,
      templateId,
      roomW,
      roomD,
      wallH,
      showWalls,
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
      templateId,
      roomW,
      roomD,
      wallH,
      showWalls,
    });
    setObjects(prev.objects);
    setSelectedId(prev.selectedId ?? null);
    setTemplateId(prev.templateId ?? templateId);
    setRoomW(typeof prev.roomW === "number" ? prev.roomW : roomW);
    setRoomD(typeof prev.roomD === "number" ? prev.roomD : roomD);
    setWallH(typeof prev.wallH === "number" ? prev.wallH : wallH);
    setShowWalls(typeof prev.showWalls === "boolean" ? prev.showWalls : showWalls);
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
      templateId,
      roomW,
      roomD,
      wallH,
      showWalls,
    });
    setObjects(nxt.objects);
    setSelectedId(nxt.selectedId ?? null);
    setTemplateId(nxt.templateId ?? templateId);
    setRoomW(typeof nxt.roomW === "number" ? nxt.roomW : roomW);
    setRoomD(typeof nxt.roomD === "number" ? nxt.roomD : roomD);
    setWallH(typeof nxt.wallH === "number" ? nxt.wallH : wallH);
    setShowWalls(typeof nxt.showWalls === "boolean" ? nxt.showWalls : showWalls);
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
      color: "",
      y: 0,
      rotY: 0, // degrees

    }),
    []
  );


  // Objectbibliotheek (C1) — structuur die we later kunnen uitbreiden met echte modellen/snap points
  const catalogByTab = useMemo(
    () => ({
      bathroom: [
        { presetKey: "bath_cabinet_60", label: "Kastje 60cm", type: "Cabinet", w: 0.6, d: 0.5, h: 0.8, color: "", y: 0, rotY: 0 },
        { presetKey: "bath_counter_120", label: "Blad 120cm", type: "Countertop", w: 1.2, d: 0.6, h: 0.06, color: "", y: 0, rotY: 0 },
        { presetKey: "bath_sink", label: "Wastafel", type: "Sink", w: 0.5, d: 0.4, h: 0.18, color: "", y: 0, rotY: 0 },
      ],
      toilet: [
        { presetKey: "toilet_toilet", label: "Toilet", type: "Toilet", w: 0.38, d: 0.7, h: 0.8, color: "", y: 0, rotY: 0 },
        { presetKey: "toilet_cabinet_40", label: "Fonteinkast 40cm", type: "Cabinet", w: 0.4, d: 0.32, h: 0.75, color: "", y: 0, rotY: 0 },
      ],
      garden: [
        { presetKey: "garden_planter", label: "Plantenbak", type: "Planter", w: 0.8, d: 0.35, h: 0.45, color: "", y: 0, rotY: 0 },
        { presetKey: "garden_block", label: "Steen blok", type: "Block", w: 0.6, d: 0.6, h: 0.25, color: "", y: 0, rotY: 0 },
      ],
    }),
    []
  );

  const [libraryTab, setLibraryTab] = useState("bathroom");
  const [placeItemId, setPlaceItemId] = useState("bath_cabinet_60");

  const flatCatalog = useMemo(() => Object.values(catalogByTab).flat(), [catalogByTab]);
  const placePreset = useMemo(
    () => flatCatalog.find((i) => i.presetKey === placeItemId) || null,
    [flatCatalog, placeItemId]
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

  function applyTemplate(nextId) {
    const t = TEMPLATES[nextId] || TEMPLATES.badkamer;
    pushUndoSnapshot();

    setTemplateId(nextId);
    setRoomW(t.roomW);
    setRoomD(t.roomD);
    setWallH(t.wallH);
    setShowWalls(t.showWalls);

    // Start fresh for the new template (keeps it predictable)
    setObjects([]);
    setSelectedId(null);
    setTool("select");
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
        ...preset,
        id, // ✅ zorg dat elk geplaatst item een unieke id houdt (preset.presetKey mag niet overschrijven)
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

  
  // --- Positioning helpers (professional feel) ---
  function rotatedExtents(w, d, rotYDeg) {
    const rw = Number(w || 0);
    const rd = Number(d || 0);
    const r = (Number(rotYDeg || 0) * Math.PI) / 180;
    const c = Math.abs(Math.cos(r));
    const s = Math.abs(Math.sin(r));
    const ex = (c * rw + s * rd) / 2; // half-extent on X
    const ez = (s * rw + c * rd) / 2; // half-extent on Z
    return { ex, ez };
  }

  function constrainAndMagnet({ id, x, y, z, w, d, h, rotY, objectsNow }) {
    const { ex, ez } = rotatedExtents(w, d, rotY);

    // Keep a tiny gap so objects don't visually clip into walls
    const wallGap = 0.02;

    // Bounds for the CENTER of the object so its sides stay inside the room
    const minX = -roomW / 2 + ex + wallGap;
    const maxX = roomW / 2 - ex - wallGap;
    const minZ = -roomD / 2 + ez + wallGap;
    const maxZ = roomD / 2 - ez - wallGap;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    let nx = clamp(x, minX, maxX);
    let nz = clamp(z, minZ, maxZ);
    let ny = Number(y ?? 0);
    const nh = Number(h ?? 0);

    // "Magnet" distance (how close is considered 'snap')
    // Wall magnet should feel similar to object-to-object magnet.
    // Wall snapping is 'always-on', so we keep it a bit tighter than object magnet.
    const wallMagnet = 0.03;   // meters
    const objectMagnet = 0.06; // meters

    // Snap to walls (touching)
    if (Math.abs(nx - minX) <= wallMagnet) nx = minX;
    if (Math.abs(nx - maxX) <= wallMagnet) nx = maxX;
    if (Math.abs(nz - minZ) <= wallMagnet) nz = minZ;
    if (Math.abs(nz - maxZ) <= wallMagnet) nz = maxZ;

    // Snap / prevent overlap with other objects (simple AABB with rotation-safe extents)
    const others = (objectsNow || []).filter((o) => o && o.id !== id);
    const DEBUG_SNAPS = false;
    let snapCandidate = null; // { x, y, z, reason }
    let wallSnapReason = null; // string when a wall-flush snap was applied (C3.4)

    // --- PRO SNAPPOINTS (C3) ---
    // Stability-first: only add narrow, type-specific snaps without changing existing magnet/collision.
    const movingObj = (objectsNow || []).find((o) => o && o.id === id) || null;
    const movingType = movingObj?.type || "";
    const movingPresetKey = movingObj?.presetKey || "";

    // Helper: near check
    const near = (a, b, tol) => Math.abs(a - b) <= tol;

    // Countertop: snap to the center between 2 cabinets when widths match (e.g. 120cm on 2x60cm).
    // This is "configurator behavior" and only triggers when the countertop is near the cabinets row.
    if (movingType === "Countertop") {
      const cabinets = others.filter((o) => (o?.type || "") === "Cabinet");
      if (cabinets.length >= 2) {
        const tolLane = 0.15;   // how strict they must be aligned on Z
        const tolAdj = 0.14;    // how strict they must be "next to each other"
        const tolWidth = 0.08;  // width match tolerance (meters)
        const tolNear = 0.45;   // how close countertop must be to trigger snap

        // For now: only support rotY ~ 0 to avoid confusing snaps for rotated slabs.
        if (Math.abs(((rotY || 0) % 360 + 360) % 360) < 0.5 || Math.abs((((rotY || 0) % 360 + 360) % 360) - 180) < 0.5) {
          // Try all pairs and pick the best candidate (closest snap).
          let bestPair = null;
          let bestDist2 = Infinity;

          for (let i = 0; i < cabinets.length; i++) {
            for (let j = i + 1; j < cabinets.length; j++) {
              const a = cabinets[i];
              const b = cabinets[j];

              const ax = Number(a.x ?? 0), az = Number(a.z ?? 0), ay = Number(a.y ?? 0);
              const bx = Number(b.x ?? 0), bz = Number(b.z ?? 0), by = Number(b.y ?? 0);
              const aw = Number(a.w ?? 0), ad = Number(a.d ?? 0), ah = Number(a.h ?? 0);
              const bw = Number(b.w ?? 0), bd = Number(b.d ?? 0), bh = Number(b.h ?? 0);

              // Must be on same "row" (Z) and same top height (Y)
              const topA = ay + ah;
              const topB = by + bh;
              if (!near(az, bz, tolLane)) continue;
              if (!near(topA, topB, 0.04)) continue;

              // Must be adjacent on X (side-by-side), not overlapping too much, not far apart.
              const centerDx = Math.abs(ax - bx);
              const wantDx = (aw / 2) + (bw / 2);
              if (!near(centerDx, wantDx, tolAdj)) continue;

              // Width match: countertop width should match sum of cabinet widths
              const sumW = aw + bw;
              if (Math.abs(w - sumW) > tolWidth) continue;

              // Candidate snap position: midpoint between cabinets, same Z lane, and on top.
              const cx = (ax + bx) / 2;
              const cz = (az + bz) / 2;
              const cy = Math.max(topA, topB);

              // Only trigger if countertop is near this candidate
              const d2 = (nx - cx) * (nx - cx) + (nz - cz) * (nz - cz);
              if (d2 > tolNear * tolNear) continue;

              if (d2 < bestDist2) {
                bestDist2 = d2;
                bestPair = { x: cx, z: cz, y: cy };
              }
            }
          }

          if (bestPair) {
            // De uiteindelijke "stack" beslissing gebeurt lager in de stacking-sectie.
            // We geven hier alleen een voorstel door.
            snapCandidate = { x: bestPair.x, z: bestPair.z, y: bestPair.y, reason: "countertop_on_two_cabinets" };
          }
        }
      }
    }

    // Countertop: snap op 1 cabinet (C3.3) — zelfde "vloeiend" gevoel als bij 2 cabinets.
    // Alleen als er nog geen snapCandidate is gekozen (dus 2-cabinet heeft voorrang).
    if (movingType === "Countertop" && !snapCandidate) {
      const cabinets = others.filter((o) => (o?.type || "") === "Cabinet");
      if (cabinets.length > 0) {
        const tolLane = 0.18;   // uitlijning op Z
        const tolWidth = 0.08;  // breedte match tolerance (meters)
        const tolNear = 0.55;   // hoe dichtbij om te triggeren

        // Alleen bij 0° / 180° (in graden) om onverwachte snaps te voorkomen.
        const rot = (((rotY || 0) % 360) + 360) % 360;
        const rotOk = Math.abs(rot) < 0.5 || Math.abs(rot - 180) < 0.5;

        if (rotOk) {
          let best = null;
          let bestDist2 = Infinity;

          for (const c of cabinets) {
            const cx = Number(c.x ?? 0);
            const cz = Number(c.z ?? 0);
            const cy = Number(c.y ?? 0);
            const ch = Number(c.h ?? 0);

            // Cabinet extents (respecteer rotatie)
            const { ex: cex } = rotatedExtents(c.w, c.d, c.rotY);

            // Cabinet moet in dezelfde rij liggen (Z) zodat het logisch voelt
            if (Math.abs(cz - nz) > tolLane) continue;

            // Breedte match: blad.w ≈ cabinet.w (we gebruiken extents zodat rotatie geen rare surprises geeft)
            if (Math.abs(cex - ex) > tolWidth) continue;

            // Trigger alleen als je in de buurt bent
            const d2 = (nx - cx) * (nx - cx) + (nz - cz) * (nz - cz);
            if (d2 > tolNear * tolNear) continue;

            if (d2 < bestDist2) {
              bestDist2 = d2;
              best = { x: cx, z: cz, y: cy + ch };
            }
          }

          if (best) {
            snapCandidate = { x: best.x, z: best.z, y: best.y, reason: "countertop_on_one_cabinet" };
          }
        }
      }
    }


    

    // Sink: snap naar het midden van een Countertop (C3.2).
    // Doel: pro configurator-gevoel; alleen actief als er een countertop in de buurt is en de wastafel daarop past.
    if (movingType === "Sink") {
      const countertops = others.filter((o) => (o?.type || "") === "Countertop");
      if (countertops.length > 0) {
        const tolNear = 0.55;        // hoe dichtbij je moet zijn om te snappen (meters)
        const tolFit = 0.04;         // kleine tolerantie zodat het niet te streng is
        const zCapture = 0.40;       // hoe strak op Z we willen "pakken" (midden van het blad)
        const xLaneCapture = 0.55;   // hoe ver van het midden we nog meerekenen voor links/rechts

        // Alleen bij 0° / 180° (in graden) om onverwachte snaps te voorkomen.
        const rot = (((rotY || 0) % 360) + 360) % 360;
        const rotOk = Math.abs(rot) < 0.5 || Math.abs(rot - 180) < 0.5;

        if (rotOk) {
          let best = null;
          let bestDist2 = Infinity;

          for (const c of countertops) {
            const cx = Number(c.x ?? 0);
            const cz = Number(c.z ?? 0);
            const cy = Number(c.y ?? 0);
            const ch = Number(c.h ?? 0);

            const { ex: cex, ez: cez } = rotatedExtents(c.w, c.d, c.rotY);

            // Past de wastafel binnen het blad?
            if (cex + tolFit < ex || cez + tolFit < ez) continue;

            // Dichtbij genoeg (globaal)
            const d2center = (nx - cx) * (nx - cx) + (nz - cz) * (nz - cz);
            if (d2center > tolNear * tolNear) continue;

            // We houden Z netjes in het midden (voor nu).
            if (Math.abs(nz - cz) > zCapture) continue;

            // Links / Midden / Rechts ankers (in wereld X, want rotOk beperkt tot 0/180)
            // Zorgt dat de wastafel binnen het blad blijft.
            const maxOffsetX = Math.max(0, cex - ex);

// Als het blad maar nét breder is dan de wastafel (bv. 60cm meubel),
// dan voelt links/rechts "springen" onprofessioneel. In dat geval: alleen midden snap.
const allowLeftRight = maxOffsetX >= 0.14;

const leftX = cx - maxOffsetX;
const centerX = cx;
const rightX = cx + maxOffsetX;

// Kies target op basis van waar de gebruiker naartoe sleept (nx).
const split = allowLeftRight ? Math.max(0.10, maxOffsetX * 0.5) : 999;
            let targetX = centerX;
            let reason = "sink_on_countertop_center";

            if (nx < cx - split && Math.abs(nx - leftX) <= xLaneCapture) {
              targetX = leftX;
              reason = "sink_on_countertop_left";
            } else if (nx > cx + split && Math.abs(nx - rightX) <= xLaneCapture) {
              targetX = rightX;
              reason = "sink_on_countertop_right";
            } else {
              targetX = centerX;
              reason = "sink_on_countertop_center";
            }

            const d2 = (nx - targetX) * (nx - targetX) + (nz - cz) * (nz - cz);
            if (d2 < bestDist2) {
              bestDist2 = d2;
              best = { x: targetX, z: cz, y: cy + ch, reason };
            }
          }

          if (best) {
            snapCandidate = { x: best.x, z: best.z, y: best.y, reason: best.reason };
          }
        }
      }
    }



    // Cabinet: flush-snap tegen de muur (C3.4).
    // Pro planner gedrag: kast achterzijde ligt strak tegen de dichtstbijzijnde muur (zonder center-offset gevoel).
    // Stability-first: we passen alleen nx/nz aan; collision/magnet/stacking blijven leidend.
    if (movingType === "Cabinet") {
      const tolWall = 0.28; // hoe dichtbij je een muur moet zijn om te "pakken" (meters)

      // Alleen bij 0° / 180° (in graden) om onverwachte snaps te voorkomen.
      const rot = (((rotY || 0) % 360) + 360) % 360;
      const rotOk = Math.abs(rot) < 0.5 || Math.abs(rot - 180) < 0.5;

      if (rotOk) {
        const distMinX = Math.abs(nx - minX);
        const distMaxX = Math.abs(maxX - nx);
        const distMinZ = Math.abs(nz - minZ);
        const distMaxZ = Math.abs(maxZ - nz);

        const bestDist = Math.min(distMinX, distMaxX, distMinZ, distMaxZ);

        if (bestDist <= tolWall) {
          if (bestDist === distMinX) {
            nx = minX;
            wallSnapReason = "cabinet_flush_minX";
          } else if (bestDist === distMaxX) {
            nx = maxX;
            wallSnapReason = "cabinet_flush_maxX";
          } else if (bestDist === distMinZ) {
            nz = minZ;
            wallSnapReason = "cabinet_flush_minZ";
          } else {
            nz = maxZ;
            wallSnapReason = "cabinet_flush_maxZ";
          }

          nx = clamp(nx, minX, maxX);
          nz = clamp(nz, minZ, maxZ);
        }
      }
    }

if (DEBUG_SNAPS) {
      if (snapCandidate) {
        // eslint-disable-next-line no-console
        console.log("[snap]", snapCandidate.reason, { x: snapCandidate.x, y: snapCandidate.y, z: snapCandidate.z });
      } else if (wallSnapReason) {
        // eslint-disable-next-line no-console
        console.log("[snap]", wallSnapReason, { x: nx, y: ny, z: nz });
      }
    }



    // --- STAPELEN (stacking) ---
    // Als het object "bovenop" een ander object past, dan laten we hem klikken op de bovenkant.
    // Pro UX: in het midden van de kamer helpen we extra met een ruimere "capture zone" + auto-centre (Optie A).
    const stackTol = 0.06;
    const stackMagnet = 0.28; // hoe "makkelijk" hij op een bovenkant klikt (hoogte)
    const stackCapture = 0.18; // extra marge in X/Z om stapelen makkelijker te maken (voor kleine onderdelen later)
    // Default: op de vloer. Als er een geldige bovenkant onder ons zit, klikken we daarop.
    let bestY = 0;
    let bestCenter = null;


    if (snapCandidate) {
      bestY = snapCandidate.y;
      bestCenter = { x: snapCandidate.x, z: snapCandidate.z };
    }

    if (!snapCandidate) {
      for (const o of others) {
      const ox = Number(o.x ?? 0);
      const oz = Number(o.z ?? 0);
      const oy = Number(o.y ?? 0);
      const oh = Number(o.h ?? 0);

      const { ex: oex, ez: oez } = rotatedExtents(o.w, o.d, o.rotY);

      // Past onze footprint (bovenste object) binnen de footprint van het onderste object?
      if (oex + stackTol >= ex && oez + stackTol >= ez) {
        const maxDx = (oex - ex + stackTol);
        const maxDz = (oez - ez + stackTol);

        // "Capture": je hoeft niet pixel-perfect te mikken, we pakken hem als je dichtbij genoeg zit.
        const nearX = Math.abs(nx - ox) <= (maxDx + stackCapture);
        const nearZ = Math.abs(nz - oz) <= (maxDz + stackCapture);

        if (nearX && nearZ) {
          const topY = oy + oh;

          // Als we (ongeveer) boven het object zitten, mogen we klikken op de bovenkant.
          // Dit is bewust ruim: je sleept in X/Z, en het object "klimt" naar boven als het past.
          if (ny <= topY + stackMagnet) {
            // Optie A: auto-centre op het onderste object zodra stapelen actief is.
            if (topY > bestY) {
              bestY = topY;
              bestCenter = { x: ox, z: oz };
            }
          }
        }
      }
    }
    }

    if (bestY > 0) {
      ny = bestY;
      // Auto-centre, maar wel binnen de kamergrenzen.
      nx = clamp(bestCenter.x, minX, maxX);
      nz = clamp(bestCenter.z, minZ, maxZ);
    } else {
      ny = 0;
    }

    const yOverlaps = (oy, oh) => {
      const eps = 1e-4;
      return !(ny + nh <= oy + eps || ny >= oy + oh - eps);
    };

    for (const o of others) {
      const ox = Number(o.x ?? 0);
      const oz = Number(o.z ?? 0);
      const oy = Number(o.y ?? 0);
      const oh = Number(o.h ?? 0);

      // Alleen botsing voorkomen als we ook écht op dezelfde hoogte zitten.
      // (Als je stapelt, mogen de X/Z footprints overlappen, want Y is anders.)
      if (!yOverlaps(oy, oh)) continue;
      const ow = Number(o.w || 1);
      const od = Number(o.d || 1);
      const orot = Number(o.rotY || 0);
      const { ex: oex, ez: oez } = rotatedExtents(ow, od, orot);

      // Candidate snap positions on X (touch faces)
      const touchRight = ox + (oex + ex);
      const touchLeft = ox - (oex + ex);

      // Only snap X if we are roughly aligned in Z (overlapping "lane")
      const zOverlap = Math.abs(nz - oz) <= (oez + ez + 0.02);
      if (zOverlap) {
        if (Math.abs(nx - touchRight) <= objectMagnet) nx = touchRight;
        if (Math.abs(nx - touchLeft) <= objectMagnet) nx = touchLeft;
      }

      // Candidate snap positions on Z
      const touchFront = oz + (oez + ez);
      const touchBack = oz - (oez + ez);

      const xOverlap = Math.abs(nx - ox) <= (oex + ex + 0.02);
      if (xOverlap) {
        if (Math.abs(nz - touchFront) <= objectMagnet) nz = touchFront;
        if (Math.abs(nz - touchBack) <= objectMagnet) nz = touchBack;
      }

      // Hard overlap prevention (resolve overlap deterministically)
      const dx = nx - ox;
      const dz = nz - oz;
      const ax = Math.abs(dx);
      const az = Math.abs(dz);
      const minAx = oex + ex;
      const minAz = oez + ez;

      if (ax < minAx && az < minAz) {
        const eps = 0.001;

        const cx = nx;
        const cz = nz;

        // Try the 4 "touch faces" positions (left/right/front/back), and pick the closest one
        // that is inside the room AND not overlapping.
        const candidates = [
          { x: ox + (minAx + eps), z: cz },
          { x: ox - (minAx + eps), z: cz },
          { x: cx, z: oz + (minAz + eps) },
          { x: cx, z: oz - (minAz + eps) },
        ];

        let best = null;
        let bestDist2 = Infinity;

        for (const c of candidates) {
          const tx = clamp(c.x, minX, maxX);
          const tz = clamp(c.z, minZ, maxZ);

          const adx = Math.abs(tx - ox);
          const adz = Math.abs(tz - oz);

          const stillOverlap = adx < minAx && adz < minAz;
          if (stillOverlap) continue;

          const d2 = (tx - cx) * (tx - cx) + (tz - cz) * (tz - cz);
          if (d2 < bestDist2) {
            bestDist2 = d2;
            best = { x: tx, z: tz };
          }
        }

        if (best) {
          nx = best.x;
          nz = best.z;
        } else {
          // Fallback (should be rare): original smallest-penetration push-out
          const penX = minAx - ax;
          const penZ = minAz - az;

          if (penX < penZ) {
            nx += (dx >= 0 ? 1 : -1) * (penX + eps);
          } else {
            nz += (dz >= 0 ? 1 : -1) * (penZ + eps);
          }

          // Re-clamp after push-out
          nx = clamp(nx, minX, maxX);
          nz = clamp(nz, minZ, maxZ);

          // If clamping prevented a full resolve (e.g. near a wall), push on the other axis too
          const adx2 = Math.abs(nx - ox);
          const adz2 = Math.abs(nz - oz);
          if (adx2 < minAx && adz2 < minAz) {
            if (penX < penZ) {
              nz += (dz >= 0 ? 1 : -1) * (penZ + eps);
            } else {
              nx += (dx >= 0 ? 1 : -1) * (penX + eps);
            }
            nx = clamp(nx, minX, maxX);
            nz = clamp(nz, minZ, maxZ);
          }
        }
      }
    }

    return { x: nx, y: ny, z: nz };
  }

function handlePlaceAt(x, z) {
    if (tool !== "place") return;
    pushUndoSnapshot();

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const id = `obj_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

    const preset = placePreset || defaultBlock;

    // Gebruik altijd de allernieuwste objectenlijst (prev), zodat stapelen/collision direct klopt
    setObjects((prev) => {
      // Place inside room + "magnet" to walls/other objects
      const placed = constrainAndMagnet({
        id: null,
        x,
        y: preset.y ?? 0,
        z,
        w: preset.w,
        d: preset.d,
        h: preset.h,
        rotY: preset.rotY ?? 0,
        objectsNow: prev,
      });

      const cx = placed.x;
      const cz = placed.z;

      // Keep a lightweight 0..1 mapping too (based on current room size)
      const px = clamp(0.5 + cx / Math.max(0.0001, roomW), 0, 1);
      const py = clamp(0.5 + cz / Math.max(0.0001, roomD), 0, 1);

      const newObj = {
        id,
        type: "Block",
        x: cx,
        z: cz,
        px,
        py,
        ...preset,
        id, // ✅ zorg dat elk geplaatst item een unieke id houdt (preset.presetKey mag niet overschrijven)
        y: placed.y,
      };

      return [...prev, newObj];
    });

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

    setObjects((prev) => {
      const moving = prev.find((o) => o.id === id);
      if (!moving) return prev;

      const moved = constrainAndMagnet({
        id,
        x,
        y: moving.y ?? 0,
        z,
        w: moving.w,
        d: moving.d,
        h: moving.h,
        rotY: moving.rotY,
        objectsNow: prev,
      });

      const cx = moved.x;
      const cz = moved.z;

      const px = clamp(0.5 + cx / Math.max(0.0001, roomW), 0, 1);
      const py = clamp(0.5 + cz / Math.max(0.0001, roomD), 0, 1);

      return prev.map((o) => (o.id === id ? { ...o, x: cx, y: moved.y ?? (o.y ?? 0), z: cz, px, py } : o));
    });
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

            {tool === "place" && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-black/70">Objectbibliotheek</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <TabButton label="Badkamer" active={libraryTab === "bathroom"} onClick={() => setLibraryTab("bathroom")} />
                  <TabButton label="Toilet" active={libraryTab === "toilet"} onClick={() => setLibraryTab("toilet")} />
                  <TabButton label="Tuin" active={libraryTab === "garden"} onClick={() => setLibraryTab("garden")} />
                </div>

                <div className="mt-3 grid gap-2">
                  {(catalogByTab[libraryTab] || []).map((it) => (
                    <button
                      key={it.presetKey}
                      type="button"
                      onClick={() => setPlaceItemId(it.presetKey)}
                      className={clsx(
                        "w-full rounded-2xl border px-3 py-3 text-left text-sm font-medium shadow-sm",
                        placeItemId === it.presetKey ? "border-black/20 bg-black text-white" : "border-black/10 bg-white text-black/75 hover:bg-black/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>{it.label}</div>
                        <div className={clsx("text-[11px]", placeItemId === it.presetKey ? "text-white/70" : "text-black/45")}>
                          {Math.round(it.w * 100)}×{Math.round(it.d * 100)}×{Math.round(it.h * 100)} cm
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.03] p-3 text-xs text-black/70">
                  <div className="font-semibold text-black/70">Tip</div>
                  <div className="mt-1">Kies een object hierboven en klik in het 3D werkvlak om te plaatsen.</div>
                </div>
              </div>
            )}


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

              <div className="flex items-center gap-2">


                <button type="button" className="h-8 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-black/70 hover:bg-black/5 active:scale-[0.98]" onClick={() => requestCamera("top")}>Top</button>


                <button type="button" className="h-8 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-black/70 hover:bg-black/5 active:scale-[0.98]" onClick={() => requestCamera("front")}>Front</button>


                <button type="button" className="h-8 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-black/70 hover:bg-black/5 active:scale-[0.98]" onClick={() => requestCamera("iso")}>Iso</button>


                <button type="button" className="h-8 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-black/70 hover:bg-black/5 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed" disabled={!selectedId} onClick={() => requestCamera("focus")}>Focus</button>


                <button type="button" className="h-8 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-black/70 hover:bg-black/5 active:scale-[0.98]" onClick={() => requestCamera("reset")}>Reset</button>


              </div>



              <div className="text-xs text-black/45">


                (3D komt hierna — dit is nu de “basis editor”)
              </div>
            </div>

            <div className="mt-4 h-[520px] w-full overflow-hidden rounded-3xl border border-black/10">
              <StudioScene
  templateId={templateId}
                                cameraAction={cameraAction}
objects={objects}
                selectedId={selectedId}
                tool={tool}
                onPlaceAt={handlePlaceAt}
                onObjectClick={handleObjectClick3D}
                onMoveStart={handleMoveStart}
                onMove={handleMoveAt}
                roomW={roomW}
                roomD={roomD}
                wallH={wallH}
                showWalls={showWalls}
              />
            </div>
          </section>

          {/* RIGHT: Properties */}
          <aside className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-2xl border border-black/10 bg-white p-4">
              <div className="text-sm font-semibold text-black/80">Ruimte</div>
              <div className="mt-2 grid gap-3">
                <div>
                  <div className="text-xs font-semibold text-black/70">Template</div>
                  <select
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-black/80 shadow-sm outline-none focus:border-black/20"
                  >
                    {Object.entries(TEMPLATES).map(([key, t]) => (
                      <option key={key} value={key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <LabeledNumber
                    label="Breedte (m)"
                    value={roomW}
                    onChange={(v) => {
                      pushUndoSnapshot();
                      setRoomW(Math.max(0.5, v));
                    }}
                  />
                  <LabeledNumber
                    label="Diepte (m)"
                    value={roomD}
                    onChange={(v) => {
                      pushUndoSnapshot();
                      setRoomD(Math.max(0.5, v));
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <LabeledNumber
                    label="Muurhoogte (m)"
                    value={wallH}
                    onChange={(v) => {
                      pushUndoSnapshot();
                      setWallH(Math.max(0.5, v));
                    }}
                  />
                  <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="text-xs font-semibold text-black/70">Muren</div>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndoSnapshot();
                        setShowWalls((p) => !p);
                      }}
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm font-medium text-black/75 shadow-sm hover:bg-black/5"
                    >
                      {showWalls ? "Aan" : "Uit"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-black/5 p-3 text-xs text-black/60">
                  Tip: pas eerst de ruimte aan, daarna blokken plaatsen.
                </div>
              </div>
            </div>

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
                    value={selectedObj.color ?? ""}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-black/80 shadow-sm outline-none focus:border-black/20"
                  >
                    <option value="">Auto (type)</option>
                    <option value="Stone">Stone</option>
                    <option value="Wood">Wood</option>
                    <option value="Concrete">Concrete</option>
                    <option value="White">White</option>
                    <option value="Black">Black</option>
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

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm",
        active ? "border-black/20 bg-black text-white" : "border-black/10 bg-white text-black/70 hover:bg-black/5"
      )}
    >
      {label}
    </button>
  );
}

function LabeledNumber({ label, value, onChange, step = 0.1, min = 0 }) {
  // We keep a local string so typing '.' or ',' on mobile works smoothly.
  const [raw, setRaw] = useState(String(value ?? ""));

  useEffect(() => {
    // Sync when external value changes (undo/redo/template switch)
    setRaw(String(value ?? ""));
  }, [value]);

  function normalizeDecimalString(s) {
    let t = String(s ?? "").replace(/,/g, ".");
    t = t.replace(/[^0-9.\-]/g, "");
    if (t.includes("-")) {
      t = (t.startsWith("-") ? "-" : "") + t.replace(/-/g, "");
    }
    const firstDot = t.indexOf(".");
    if (firstDot !== -1) {
      t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, "");
    }
    return t;
  }

  function commit() {
    const t = normalizeDecimalString(raw);
    if (t === "" || t === "-" || t === ".") {
      setRaw(String(value ?? ""));
      return;
    }
    const num = Number(t);
    if (Number.isNaN(num)) {
      setRaw(String(value ?? ""));
      return;
    }
    onChange(Math.max(min, num));
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold text-black/70">{label}</div>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm text-black/80 shadow-sm outline-none focus:border-black/20"
      />
</div>
  );
}
