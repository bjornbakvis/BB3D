import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

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

function Blocks({ objects, selectedId, tool, onObjectClick, onMove, snapStep, draggingId, setDraggingId }) {
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

        const w = Number(o.w || 1);
        const h = Number(o.h || 1);
        const d = Number(o.d || 1);

        const baseColor = colorToHex(o.color);

        return (
          <mesh
            key={o.id}
            position={[o._x, h / 2, o._z]}
            onPointerDown={(e) => {
              e.stopPropagation();

              // Always allow select/delete behavior via existing handler
              onObjectClick?.(o.id);

              // Start dragging only when Move tool is active
              if (tool === "move") {
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

              const nx = snap(gp.x, snapStep);
              const nz = snap(gp.z, snapStep);

              onMove?.(o.id, nx, nz);
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
              emissive={isSel ? "#111111" : "#000000"}
              emissiveIntensity={isSel ? 0.9 : 0}
              roughness={0.8}
              metalness={0.05}
            />
          </mesh>
        );
      })}
    </>
  );
}

export default function StudioScene({
  objects,
  selectedId,
  tool,
  onPlaceAt,
  onObjectClick,
  onMove,
  snapStep = 0.5,
}) {
  const [draggingId, setDraggingId] = useState(null);

  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [6, 6, 6], fov: 50 }} shadows gl={{ antialias: true }}>
        {/* Licht */}
        <ambientLight intensity={0.55} />
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
          args={[20, 20]}
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
            const x = snap(p.x, snapStep);
            const z = snap(p.z, snapStep);
            onPlaceAt?.(x, z);
          }}
          receiveShadow
        >
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0} />
        </mesh>

        {/* Blocks */}
        <Blocks
          objects={objects}
          selectedId={selectedId}
          tool={tool}
          onObjectClick={onObjectClick}
          onMove={onMove}
          snapStep={snapStep}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
        />

        {/* Controls (disabled while dragging so the camera doesn't fight your move) */}
        <OrbitControls
          makeDefault
          enabled={!draggingId}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          panSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}
