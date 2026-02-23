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
            <meshStandardMaterial
              color={baseColor}
              emissive={isSel ? "#222222" : isHover ? "#222222" : "#000000"}
              emissiveIntensity={isSel ? 1.25 : isHover ? 0.45 : 0}
              roughness={0.8}
              metalness={0.05}
            />
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


function Room({ roomW, roomD, wallH, showWalls }) {
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
      color="#f2f2f2"
      roughness={0.95}
      metalness={0}
      transparent
      opacity={0.35} // option 2: ghost walls so you can keep seeing inside
    />
  );

  // Important: walls should NOT capture pointer events (fixes "can't move inside walls")
  const noRaycast = () => null;

  const renderWall = (key, props, geomArgs) => {
    // option 1 + option 3: always keep the camera-facing wall open (hidden)
    if (hiddenWall === key) return null;
    return (
      <mesh {...props} raycast={noRaycast} castShadow receiveShadow>
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
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const controlsRef = useRef(null);
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [Math.max(4, roomW * 1.2), Math.max(3.2, wallH * 1.25 + 1), Math.max(4, roomD * 1.2)], fov: 50 }} shadows gl={{ antialias: true }}>
        {/* Licht */}
        <ambientLight intensity={0.55} />
        <CameraFramer controlsRef={controlsRef} roomW={roomW} roomD={roomD} wallH={wallH} />
        <directionalLight
          position={[6, 10, 4]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Grid vloer */}
        <Grid
          position={[0, 0, 0]}
          args={[roomW, roomD]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#000000"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#000000"
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
        <Room roomW={roomW} roomD={roomD} wallH={wallH} showWalls={showWalls} />


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
