import * as THREE from "three";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Edges, Html } from "@react-three/drei";

function colorToHex(name) {
  switch (name) {
    case "Wood":
      return "#a67c52";
    case "Concrete":
      return "#a0a0a0";
    case "White":
      return "#f1f1f1";
    case "Black":
      return "#222222";
    case "Stone":
    default:
      return "#b9b9b9";
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function snap(v, step) {
  if (!step) return v;
  return Math.round(v / step) * step;
}


function makeCheckerTexture({ c1, c2, squares = 16, size = 512 }) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const step = size / squares;

  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x * step, y * step, step, step);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function getThemeConfig(templateId) {
  const id = templateId || "bathroom";
  if (id === "garden") {
    return {
      id,
      floor: { c1: "#3f7a45", c2: "#356a3c", squares: 64, tileSize: 0.25 },
      wall: { c1: "#d9d9d9", c2: "#cfcfcf", squares: 24, tileSize: 0.6, opacity: 0.25 },
      grid: { cell: "#0b0b0b", section: "#0b0b0b", cellThickness: 0.35, sectionThickness: 0.75 },
      light: { ambient: 0.7, sun: 1.05 },
    };
  }
  if (id === "toilet") {
    return {
      id,
      floor: { c1: "#d6d6d6", c2: "#cfcfcf", squares: 48, tileSize: 0.22 },
      wall: { c1: "#f2f2f2", c2: "#e9e9e9", squares: 28, tileSize: 0.25, opacity: 0.35 },
      grid: { cell: "#0b0b0b", section: "#0b0b0b", cellThickness: 0.4, sectionThickness: 0.9 },
      light: { ambient: 0.58, sun: 1.0 },
    };
  }
  // bathroom default
  return {
    id: "bathroom",
    floor: { c1: "#e6e6e6", c2: "#dedede", squares: 40, tileSize: 0.3 },
    wall: { c1: "#f4f4f4", c2: "#ececec", squares: 24, tileSize: 0.25, opacity: 0.35 },
    grid: { cell: "#0b0b0b", section: "#0b0b0b", cellThickness: 0.4, sectionThickness: 0.9 },
    light: { ambient: 0.6, sun: 1.05 },
  };
}

function groundPointFromRay(ray) {
  // Intersect the pointer ray with the ground plane at y=0
  const o = ray.origin;
  const d = ray.direction;
  if (!d || Math.abs(d.y) < 1e-6) return null;
  const t = -o.y / d.y;
  if (!isFinite(t) || t < 0) return null;
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}

function Blocks({ objects, selectedId, tool, onObjectClick, onMoveStart, onMove, snapStep, draggingId, setDraggingId, hoverId, setHoverId, setSelectedMesh, roomW, roomD }) {
  // NOTE: we support both (x,z) and (px,py) so we don't break earlier data
  const mapped = useMemo(() => {
    return (objects || []).map((o) => {
      const hasXZ = typeof o.x === "number" && typeof o.z === "number";
      const x = hasXZ ? o.x : typeof o.px === "number" ? (o.px - 0.5) * 10 : 0;
      const z = hasXZ ? o.z : typeof o.py === "number" ? (o.py - 0.5) * 10 : 0;
      return { ...o, _x: x, _z: z };
    });
  }, [objects]);


  // PATCH B (prep for C2): Central place to map visuals per presetKey.
  // IMPORTANT: For now, we keep visuals exactly the same as before (box + same material).
  
  
  function renderBlockVisual(o, { w, h, d, baseColor, isSel, isHover }) {
    // C2 + Patch D (geometry): materials + simple shapes per presetKey.
    // IMPORTANT: Interaction footprint is kept via a separate invisible hitbox mesh (see mapped render below).
    // This function only returns VISUAL meshes (no hitbox, no pointer handlers).

    // --- base material defaults
    let color = baseColor;
    let roughness = 0.9;
    let metalness = 0.05;

    

    let kind = "default";
    const key = String(o.presetKey || "");

    // Type defaults (professional look)
    if (key.includes("cabinet")) {
      color = "#c49a6c";
      roughness = 0.78;
      metalness = 0.06;
      kind = "cabinet";
    } else if (key.includes("counter")) {
      color = "#e5e5e5";
      roughness = 0.6;
      metalness = 0.1;
      kind = "counter";
    } else if (key.includes("sink") || key.includes("toilet")) {
      color = "#f8f8f8";
      roughness = 0.35;
      metalness = 0.05;
      kind = "ceramic";
    } else if (key.includes("planter")) {
      color = "#bdbdbd";
      roughness = 0.8;
      metalness = 0.05;
      kind = "planter";
    } else if (key.includes("block") || key.includes("stone")) {
      color = "#9e9e9e";
      roughness = 0.95;
      metalness = 0.02;
      kind = "stone";
    }

    // User-selected color override ("" = Auto/type default)
    const userHasOverride = typeof o.color === "string" && o.color.length > 0;
    if (userHasOverride) {
      color = colorToHex(o.color);
    }


    // Shared material for main parts

    const mainMat = (
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={"#000000"}
        emissiveIntensity={0}
      />
    );

    // Convenience
    const halfH = h / 2;

    // PATCH D1: counter becomes a thin top slab (visual only)
    if (kind === "counter") {
      const t = Math.max(0.05, h * 0.22); // thickness
      const yTop = halfH - t / 2;
      // User override: keep pro type look by default, but let UI-selected color win.
      // Default (no override) = empty string / undefined.
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, yTop, 0]}>
            <boxGeometry args={[w * 1.02, t, d * 1.02]} />
            {mainMat}
          </mesh>
          {/* subtle underside shadow lip */}
          <mesh castShadow receiveShadow position={[0, yTop - t * 0.35, 0]}>
            <boxGeometry args={[w * 0.98, t * 0.18, d * 0.98]} />
            <meshStandardMaterial
              color={color}
              roughness={Math.min(1, roughness + 0.1)}
              metalness={metalness}
              emissive={"#000000"}
              emissiveIntensity={0}
            />
          </mesh>
        </group>
      );
    }

    // PATCH D4: cabinets get a plinth + body (still simple boxes)
    if (kind === "wood") {
      const plinthH = Math.max(0.04, h * 0.10);
      const bodyH = Math.max(0.05, h - plinthH);
      const yPlinth = -halfH + plinthH / 2;
      const yBody = yPlinth + plinthH / 2 + bodyH / 2;

      return (
        <group>
          <mesh castShadow receiveShadow position={[0, yBody, 0]}>
            <boxGeometry args={[w, bodyH, d]} />
            {mainMat}
          </mesh>
          <mesh castShadow receiveShadow position={[0, yPlinth, 0]}>
            <boxGeometry args={[w * 1.01, plinthH, d * 1.01]} />
            <meshStandardMaterial
              color={userHasOverride ? color : "#8b6a4a"}
              roughness={0.95}
              metalness={0.02}
              emissive={"#000000"}
              emissiveIntensity={0}
            />
          </mesh>
          {/* tiny handle hint */}
          <mesh castShadow receiveShadow position={[w * 0.25, yBody, d * 0.51]}>
            <boxGeometry args={[w * 0.18, bodyH * 0.06, 0.02]} />
            <meshStandardMaterial
              color={"#3a3a3a"}
              roughness={0.35}
              metalness={0.6}
              emissive={"#000000"}
              emissiveIntensity={0}
            />
          </mesh>
        </group>
      );
    }

    // PATCH D3: ceramic items get simple multi-part forms
    if (kind === "ceramic") {
      // sink vs toilet distinction via presetKey
      const k = String(o.presetKey || "");

      if (k.includes("sink")) {
        // Sink: base + bowl
        const baseH = Math.max(0.05, h * 0.45);
        const bowlH = Math.max(0.05, h * 0.30);
        const yBase = -halfH + baseH / 2;
        const yBowl = yBase + baseH / 2 + bowlH / 2;

        return (
          <group>
            <mesh castShadow receiveShadow position={[0, yBase, 0]}>
              <boxGeometry args={[w * 0.75, baseH, d * 0.60]} />
              {mainMat}
            </mesh>
            <mesh castShadow receiveShadow position={[0, yBowl, 0]}>
              <cylinderGeometry args={[Math.min(w, d) * 0.28, Math.min(w, d) * 0.34, bowlH, 24]} />
              {mainMat}
            </mesh>
            {/* faucet hint */}
            <mesh castShadow receiveShadow position={[0, yBowl + bowlH * 0.15, d * 0.22]}>
              <cylinderGeometry args={[0.02, 0.02, h * 0.22, 12]} />
              <meshStandardMaterial
                color={"#3a3a3a"}
                roughness={0.2}
                metalness={0.8}
                emissive={"#000000"}
                emissiveIntensity={0}
              />
            </mesh>
          </group>
        );
      }

      // Toilet: base + bowl + tank
      const baseH = Math.max(0.05, h * 0.35);
      const bowlH = Math.max(0.05, h * 0.30);
      const tankH = Math.max(0.05, h * 0.25);

      const yBase = -halfH + baseH / 2;
      const yBowl = yBase + baseH / 2 + bowlH / 2;
      const yTank = halfH - tankH / 2;

      return (
        <group>
          <mesh castShadow receiveShadow position={[0, yBase, 0]}>
            <boxGeometry args={[w * 0.75, baseH, d * 0.80]} />
            {mainMat}
          </mesh>
          <mesh castShadow receiveShadow position={[0, yBowl, -d * 0.10]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.22, Math.min(w, d) * 0.28, bowlH, 24]} />
            {mainMat}
          </mesh>
          <mesh castShadow receiveShadow position={[0, yTank, d * 0.18]}>
            <boxGeometry args={[w * 0.55, tankH, d * 0.30]} />
            {mainMat}
          </mesh>
        </group>
      );
    }

    // PATCH D2: planter becomes planter + soil + plant
    if (kind === "planter") {
      const wall = Math.max(0.03, Math.min(w, d) * 0.08);
      const soilH = Math.max(0.04, h * 0.18);
      const plantH = Math.max(0.08, h * 0.45);

      const yOuter = -halfH + h / 2; // center (0), but keep explicit
      const ySoil = halfH - soilH / 2 - wall * 0.25;
      const yPlant = ySoil + soilH / 2 + plantH / 2;

      return (
        <group>
          {/* Outer box */}
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <boxGeometry args={[w, h, d]} />
            {mainMat}
          </mesh>

          {/* Soil */}
          <mesh castShadow receiveShadow position={[0, ySoil, 0]}>
            <boxGeometry args={[Math.max(0.05, w - wall * 2), soilH, Math.max(0.05, d - wall * 2)]} />
            <meshStandardMaterial
              color={"#4a3428"}
              roughness={0.98}
              metalness={0.02}
              emissive={"#000000"}
              emissiveIntensity={0}
            />
          </mesh>

          {/* Plant */}
          <mesh castShadow receiveShadow position={[0, yPlant, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.12, Math.min(w, d) * 0.16, plantH, 16]} />
            <meshStandardMaterial
              color={"#2f7d32"}
              roughness={0.95}
              metalness={0.0}
              emissive={"#000000"}
              emissiveIntensity={0}
            />
          </mesh>
        </group>
      );
    }

    // Stone blocks: simple bevel feel via two stacked boxes
    if (kind === "stone") {
      const topH = Math.max(0.03, h * 0.35);
      const bottomH = Math.max(0.03, h - topH);
      const yBottom = -halfH + bottomH / 2;
      const yTop = yBottom + bottomH / 2 + topH / 2;

      return (
        <group>
          <mesh castShadow receiveShadow position={[0, yBottom, 0]}>
            <boxGeometry args={[w, bottomH, d]} />
            {mainMat}
          </mesh>
          <mesh castShadow receiveShadow position={[0, yTop, 0]}>
            <boxGeometry args={[w * 0.92, topH, d * 0.92]} />
            {mainMat}
          </mesh>
        </group>
      );
    }

    // Default: fallback to a simple box (visual)
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[w, h, d]} />
          {mainMat}
        </mesh>
      </group>
    );
  }


  return (
    <>
      {mapped.map((o) => {
        const isSel = o.id === selectedId;
        const isHover = o.id === hoverId;

        const w = Number(o.w || 1);
        const h = Number(o.h || 1);
        const d = Number(o.d || 1);

        const baseColor = colorToHex(o.color);

        return (
          <mesh
            key={o.id}
            position={[o._x, (h / 2) + (Number(o.y || 0)), o._z]}
            rotation={[0, (Number(o.rotY || 0) * Math.PI) / 180, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoverId?.(o.id);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoverId?.((prev) => (prev === o.id ? null : prev));
            }}
            onPointerDown={(e) => {
              e.stopPropagation();

              // Always allow select/delete behavior via existing handler
              onObjectClick?.(o.id);

              // Start dragging only when Move tool is active
              if (tool === "move") {
                onMoveStart?.(o.id);
                setDraggingId(o.id);
                try {
                  e.target?.setPointerCapture?.(e.pointerId);
                } catch {
                  // ignore if not supported
                }
              }
            }}
            onPointerMove={(e) => {
              if (tool !== "move") return;
              if (draggingId !== o.id) return;

              const gp = groundPointFromRay(e.ray);
              if (!gp) return;

              const x0 = snap(gp.x, snapStep);
              const z0 = snap(gp.z, snapStep);
              onMove?.(o.id, x0, z0);
            }}
            onPointerUp={(e) => {
              if (tool !== "move") return;
              if (draggingId !== o.id) return;

              e.stopPropagation();
              setDraggingId(null);
            }}
            onPointerCancel={() => {
              if (draggingId === o.id) setDraggingId(null);
            }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial transparent opacity={0} />
            {renderBlockVisual(o, { w, h, d, baseColor, isSel, isHover })}
            {(isSel || isHover) && (
              <Edges
                scale={1.01}
                threshold={15}
                color={isSel ? "#111111" : "#333333"}
              />
            )}
</mesh>
        );
      })}
    </>
  );
}


function Room({ roomW, roomD, wallH, showWalls, wallMap, wallOpacity }) {
  const { camera } = useThree();

  // Determine which wall faces the camera the most (option 3: auto-hide)
  const [hiddenWall, setHiddenWall] = useState("front");

  // Update hidden wall dynamically while the camera rotates (dollhouse view)
  useFrame(() => {
    const center = new THREE.Vector3(0, wallH / 2, 0);
    const camDir = new THREE.Vector3().subVectors(camera.position, center).normalize();

    const candidates = [
      { key: "back", normal: new THREE.Vector3(0, 0, -1) },
      { key: "front", normal: new THREE.Vector3(0, 0, 1) },
      { key: "left", normal: new THREE.Vector3(-1, 0, 0) },
      { key: "right", normal: new THREE.Vector3(1, 0, 0) },
    ];

    let best = candidates[0].key;
    let bestDot = -Infinity;
    for (const c of candidates) {
      const d = camDir.dot(c.normal);
      if (d > bestDot) {
        bestDot = d;
        best = c.key;
      }
    }

    // Avoid re-render spam
    setHiddenWall((prev) => (prev === best ? prev : best));
  });

  if (!showWalls) return null;

  const wallMat = (
    <meshStandardMaterial
      map={wallMap}
      color="#ffffff"
      roughness={0.92}
      metalness={0}
      transparent
      opacity={wallOpacity}
    />
  );


  // Important: walls should NOT capture pointer events (fixes "can't move inside walls")
  const noRaycast = () => null;

  const renderWall = (key, props, geomArgs) => {
    // option 1 + option 3: always keep the camera-facing wall open (hidden)
    if (hiddenWall === key) return null;
    return (
      <mesh castShadow receiveShadow {...props} raycast={noRaycast} castShadow receiveShadow>
        <boxGeometry args={geomArgs} />
        {wallMat}
      </mesh>
    );
  };

  return (
    <group>
      {renderWall("back", { position: [0, wallH / 2, -roomD / 2] }, [roomW, wallH, 0.1])}
      {renderWall("front", { position: [0, wallH / 2, roomD / 2] }, [roomW, wallH, 0.1])}
      {renderWall("left", { position: [-roomW / 2, wallH / 2, 0] }, [0.1, wallH, roomD])}
      {renderWall("right", { position: [roomW / 2, wallH / 2, 0] }, [0.1, wallH, roomD])}
    </group>
  );
}


function CameraFramer({ controlsRef, roomW, roomD, wallH }) {
  const { camera } = useThree();

  useEffect(() => {
    const base = Math.max(roomW, roomD);
    const dist = Math.max(4.2, base * 1.35);
    const y = Math.max(3.2, wallH * 1.25 + 0.9);
    camera.position.set(dist, y, dist);
    camera.lookAt(0, 0, 0);

    const c = controlsRef.current;
    if (c) {
      c.target.set(0, 0, 0);
      c.update();
    }
  }, [camera, controlsRef, roomW, roomD, wallH]);

  return null;
}

function ZoomOverlay({ controlsRef, minDistance, maxDistance }) {
  const [t, setT] = useState(0.35); // 0..1
  const rafLock = useRef(false);

  // Keep UI in sync with camera distance (outside Canvas, so we use rAF)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!rafLock.current) {
        const c = controlsRef.current;
        if (c) {
          const dist = c.getDistance();
          const nextT = (dist - minDistance) / (maxDistance - minDistance);
          const clamped = Math.min(1, Math.max(0, nextT));
          setT((prev) => (Math.abs(clamped - prev) > 0.02 ? clamped : prev));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlsRef, minDistance, maxDistance]);

  const setDistance = (nextT) => {
    const c = controlsRef.current;
    if (!c) return;

    const clamped = Math.min(1, Math.max(0, nextT));
    const dist = minDistance + clamped * (maxDistance - minDistance);

    // Zoom should happen towards the grid (target on y=0)
    const target = c.target.clone();
    target.y = 0;
    c.target.copy(target);

    const dir = new THREE.Vector3().subVectors(c.object.position, c.target).normalize();
    c.object.position.copy(c.target.clone().add(dir.multiplyScalar(dist)));
    c.update();

    rafLock.current = true;
    setT(clamped);
    setTimeout(() => {
      rafLock.current = false;
    }, 50);
  };

  return (
    <div className="pointer-events-auto absolute right-3 bottom-3 z-30 flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 p-2 shadow-sm backdrop-blur">
      <button
        type="button"
        className="h-9 w-9 rounded-lg border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98]"
        onClick={() => setDistance(t - 0.08)}
        aria-label="Zoom uit"
        title="Zoom uit"
      >
        –
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={t}
        onChange={(e) => setDistance(parseFloat(e.target.value))}
        className="w-28 accent-black"
        aria-label="Zoom"
        title="Zoom"
      />

      <button
        type="button"
        className="h-9 w-9 rounded-lg border border-black/10 bg-white hover:bg-black/5 active:scale-[0.98]"
        onClick={() => setDistance(t + 0.08)}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}

export default function StudioScene({
  objects,
  selectedId,
  tool,
  onPlaceAt,
  onObjectClick,
  onMoveStart,
  onMove,
  snapStep = 0,
  roomW = 6,
  roomD = 6,
  wallH = 2.4,
  showWalls = true,
  templateId = "bathroom",
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const controlsRef = useRef(null);
  const theme = useMemo(() => getThemeConfig(templateId), [templateId]);

  const floorTex = useMemo(() => {
    const t = makeCheckerTexture({ c1: theme.floor.c1, c2: theme.floor.c2, squares: theme.floor.squares });
    const repsX = Math.max(1, roomW / theme.floor.tileSize);
    const repsZ = Math.max(1, roomD / theme.floor.tileSize);
    t.repeat.set(repsX, repsZ);
    return t;
  }, [theme, roomW, roomD]);

  const wallTex = useMemo(() => {
    const t = makeCheckerTexture({ c1: theme.wall.c1, c2: theme.wall.c2, squares: theme.wall.squares });
    const repsX = Math.max(1, roomW / theme.wall.tileSize);
    const repsZ = Math.max(1, roomD / theme.wall.tileSize);
    t.repeat.set(repsX, repsZ);
    return t;
  }, [theme, roomW, roomD]);

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [Math.max(4, roomW * 1.2), Math.max(3.2, wallH * 1.25 + 1), Math.max(4, roomD * 1.2)], fov: 50 }} shadows gl={{ antialias: true }}>
        {/* Licht */}
        <ambientLight intensity={theme.light.ambient} />
        <CameraFramer controlsRef={controlsRef} roomW={roomW} roomD={roomD} wallH={wallH} />
        <directionalLight
          position={[6, 10, 4]}
          intensity={theme.light.sun}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />


        {/* Visible floor (theme) */}
        <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[Math.max(2, roomW), Math.max(2, roomD)]} />
          <meshStandardMaterial map={floorTex} color="#ffffff" roughness={0.95} metalness={0} />
        </mesh>

        {/* Grid vloer */}
        <Grid
          position={[0, 0, 0]}
          args={[roomW, roomD]}
          cellSize={1}
          cellThickness={theme.grid.cellThickness}
          cellColor={theme.grid.cell}
          sectionSize={5}
          sectionThickness={theme.grid.sectionThickness}
          sectionColor={theme.grid.section}
          fadeDistance={30}
          fadeStrength={1}
        />

        {/* Vloer (klikbaar) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();

            // Place only when the tool is "place"
            if (tool !== "place") return;

            const p = e.point; // THREE.Vector3
            const x0 = snap(p.x, snapStep);
            const z0 = snap(p.z, snapStep);
            onPlaceAt?.(x0, z0);
          }}
          receiveShadow
        >
          <planeGeometry args={[Math.max(2, roomW), Math.max(2, roomD)]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0} />
        </mesh>

        {/* Room walls */}
        <Room roomW={roomW} roomD={roomD} wallH={wallH} showWalls={showWalls} wallMap={wallTex} wallOpacity={theme.wall.opacity} />


        {/* Blocks */}
        <Blocks
          objects={objects}
          selectedId={selectedId}
          tool={tool}
          onObjectClick={onObjectClick}
          onMoveStart={onMoveStart}
          onMove={onMove}
          snapStep={snapStep}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          hoverId={hoverId}
          setHoverId={setHoverId}
          setSelectedMesh={setSelectedMesh}
          roomW={roomW}
          roomD={roomD}
        />

        {/* Controls (disabled while dragging so the camera doesn't fight your move) */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!draggingId}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          enableZoom
          zoomSpeed={1.0}
          enablePan={false}
          minDistance={2.5}
          maxDistance={Math.max(10, roomW + roomD)}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.1}
          target={[0, 0, 0]}
        />
</Canvas>

      {/* Zoom UI overlay (DOM) */}
      <ZoomOverlay controlsRef={controlsRef} minDistance={2.5} maxDistance={Math.max(10, roomW + roomD)} />
    </div>
  );
}
