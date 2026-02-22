import * as THREE from "three";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Edges } from "@react-three/drei";

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
              }
            }}
            onPointerMove={(e) => {
              // Dragging is handled globally by DragMoveController (so walls never block it).
              if (tool !== "move") return;
              if (draggingId) return;
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
  const hiddenWall = useMemo(() => {
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
    return best;
  }, [camera.position.x, camera.position.y, camera.position.z, roomW, roomD, wallH]);

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

function DragMoveController({ tool, draggingId, setDraggingId, onMove, snapStep, roomW, roomD }) {
  const { camera, gl } = useThree();

  // A tiny, robust drag loop that does NOT depend on R3F pointer events hitting the mesh.
  // It always projects the pointer onto the ground plane (y=0).
  useEffect(() => {
    if (tool !== "move") return;
    if (!draggingId) return;
    if (!gl?.domElement) return;

    const el = gl.domElement;

    const onMoveEvt = (ev) => {
      // Pointer might be outside the canvas; still handle it.
      const rect = el.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;

      const ndcX = x * 2 - 1;
      const ndcY = -(y * 2 - 1);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

      const ray = raycaster.ray;
      const gp = groundPointFromRay(ray);
      if (!gp) return;

      const x0 = snap(gp.x, snapStep);
      const z0 = snap(gp.z, snapStep);      const margin = 0.25;

      const rw = typeof roomW === "number" && Number.isFinite(roomW) && roomW > 0 ? roomW : null;
      const rd = typeof roomD === "number" && Number.isFinite(roomD) && roomD > 0 ? roomD : null;

      const nx = rw ? clamp(x0, -rw / 2 + margin, rw / 2 - margin) : x0;
      const nz = rd ? clamp(z0, -rd / 2 + margin, rd / 2 - margin) : z0;

      onMove?.(draggingId, nx, nz);
    };

    const onUpEvt = () => {
      setDraggingId(null);
    };

    // Listen on window so dragging keeps working even if the pointer leaves the canvas.
    window.addEventListener("pointermove", onMoveEvt, { passive: true });
    window.addEventListener("pointerup", onUpEvt, { passive: true });
    window.addEventListener("pointercancel", onUpEvt, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMoveEvt);
      window.removeEventListener("pointerup", onUpEvt);
      window.removeEventListener("pointercancel", onUpEvt);
    };
  }, [tool, draggingId, onMove, snapStep, roomW, roomD, camera, gl, setDraggingId]);

  return null;
}


function ZoomUI({ controlsRef, minDistance, maxDistance }) {
  const [t, setT] = useState(0.35); // 0..1
  const rafLock = useRef(false);

  // Keep UI in sync with camera distance (lightweight)
  useFrame(() => {
    if (rafLock.current) return;
    const c = controlsRef.current;
    if (!c) return;
    const dist = c.getDistance();
    const nextT = (dist - minDistance) / (maxDistance - minDistance);
    const clamped = Math.min(1, Math.max(0, nextT));
    // avoid rerender spam
    if (Math.abs(clamped - t) > 0.02) setT(clamped);
  });

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
    // release lock shortly after so useFrame can resync
    setTimeout(() => {
      rafLock.current = false;
    }, 50);
  };

  return (
    <div className="absolute right-3 bottom-3 z-20 flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 p-2 shadow-sm backdrop-blur">
      <button
        type="button"
        className="h-9 w-9 rounded-lg border border-black/10 bg-white text-lg leading-none hover:bg-black/5 active:scale-[0.98]"
        onClick={() => setDistance(t + 0.06)}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>

      <div className="flex h-9 items-center">
        <input
          aria-label="Zoom slider"
          title="Zoom"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={t}
          onChange={(e) => setDistance(Number(e.target.value))}
          className="w-28"
        />
      </div>

      <button
        type="button"
        className="h-9 w-9 rounded-lg border border-black/10 bg-white text-lg leading-none hover:bg-black/5 active:scale-[0.98]"
        onClick={() => setDistance(t - 0.06)}
        aria-label="Zoom out"
        title="Zoom out"
      >
        –
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
  snapStep = 0.5,
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
      <Canvas camera={{ position: [Math.max(6, roomW), Math.max(6, wallH + 3), Math.max(6, roomD)], fov: 50 }} shadows gl={{ antialias: true }}>
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
          args={[Math.max(6, roomW + 2), Math.max(6, roomD + 2)]}
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
            const margin = 0.25;
            const x = clamp(x0, -roomW / 2 + margin, roomW / 2 - margin);
            const z = clamp(z0, -roomD / 2 + margin, roomD / 2 - margin);
            onPlaceAt?.(x, z);
          }}
          receiveShadow
        >
          <planeGeometry args={[Math.max(2, roomW), Math.max(2, roomD)]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0} />
        </mesh>

        {/* Room walls */}
        <Room roomW={roomW} roomD={roomD} wallH={wallH} showWalls={showWalls} />
        <DragMoveController
          tool={tool}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          onMove={onMove}
          snapStep={snapStep}
          roomW={roomW}
          roomD={roomD}
        />


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
    </div>
  );
}
