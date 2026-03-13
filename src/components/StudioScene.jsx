import * as THREE from "three";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Edges, Html, Environment } from "@react-three/drei";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";

function isWebGLAvailable() {
  // Guard for SSR / non-browser environments
  if (typeof window === "undefined" || typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function WebGLBlockedNotice() {
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="max-w-xl rounded-2xl bg-white/5 p-6 shadow-lg border border-white/10">
        <div className="text-lg font-semibold mb-2">WebGL is uitgeschakeld in je browser</div>
        <div className="text-sm opacity-90 mb-4">
          Je browser kon geen WebGL-context aanmaken (vaak door enterprise policy, een browser-flag, of hardware acceleration die uit staat).
          BB3D Studio kan dan geen 3D renderen.
        </div>

        <div className="text-sm font-semibold mb-2">Snelle stappen</div>
        <ol className="text-sm list-decimal pl-5 space-y-1 opacity-90">
          <li>Open <span className="font-mono">chrome://gpu</span> en controleer of <span className="font-semibold">WebGL</span> niet “Disabled” is.</li>
          <li>Chrome → Settings → System → zet <span className="font-semibold">Use hardware acceleration when available</span> aan → herstart Chrome.</li>
          <li>Probeer een ander browserprofiel (niet-incognito) of een andere browser (Edge/Firefox).</li>
          <li>Als dit een managed werkdevice is: vraag IT om WebGL toe te staan.</li>
        </ol>

        <div className="mt-4 text-xs opacity-70">
          Tip: als dit alleen in incognito gebeurt, is dat vaak een policy/profiel-instelling.
        </div>
      </div>
    </div>
  );
}

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    try { this.props.onError?.(error); } catch {}
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}


function colorToHex(name) {
  switch (name) {
    case "Wood":
      return "#a67c52";
    case "Concrete":
      return "#a0a0a0";
    case "White": return "#ffffff";
    case "Black":
      return "#222222";
    case "Stone":
    default:
      return "#b9b9b9";
  }
}

function adjustHex(hex, amount) {
  // amount: -0.2..0.2 (negative = darker, positive = lighter)
  if (typeof hex !== "string") return hex;
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const f = Math.max(-0.9, Math.min(0.9, amount));
  const adj = (c) => {
    const v = f >= 0 ? c + (255 - c) * f : c * (1 + f);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const rr = adj(r).toString(16).padStart(2, "0");
  const gg = adj(g).toString(16).padStart(2, "0");
  const bb = adj(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
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


/**
 * Real PBR surface materials (recommended for "IKEA planner" look)
 *
 * Put CC0 texture sets under /public/textures/... so they can be loaded by URL.
 * Each set should include at least:
 *   - albedo.jpg (basecolor)
 *   - normal.jpg
 *   - roughness.jpg
 *
 * Example:
 * public/textures/bathroom/tile_white_gloss/albedo.jpg
 * public/textures/bathroom/tile_white_gloss/normal.jpg
 * public/textures/bathroom/tile_white_gloss/roughness.jpg
 */
export const REAL_PBR_PRESETS = {
  // Bathroom / toilet
  pbr_tile_white_gloss: {
    label: "Wandtegel – glanzend wit (PBR)",
    ui: { surface: ["floor", "wall"], templates: ["badkamer", "toilet"] },
    paths: {
      albedo: "/textures/bathroom/tile_white_gloss/albedo.ktx2",
      normal: "/textures/bathroom/tile_white_gloss/normal.ktx2",
      roughness: "/textures/bathroom/tile_white_gloss/roughness.ktx2",
    },
    tileSizeM: 0.60,
    normalScale: 0.4,
    roughnessStrength: 0.75,
    colorTint: "#ffffff",
    emissiveStrength: 0.10,
  },
  pbr_tile_grey_matte: {
    label: "Tegel – mat grijs (PBR)",
    ui: { surface: ["floor", "wall"], templates: ["badkamer", "toilet"] },
    paths: {
      albedo: "/textures/bathroom/tile_grey_matte/albedo.ktx2",
      normal: "/textures/bathroom/tile_grey_matte/normal.ktx2",
      roughness: "/textures/bathroom/tile_grey_matte/roughness.ktx2",
    },
    tileSizeM: 0.60,
    normalScale: 0.7,
    roughnessStrength: 0.95,
  },
  pbr_tile_blue_gloss: {
    label: "Tegel – blauw (PBR)",
    ui: { surface: ["floor", "wall"], templates: ["badkamer", "toilet"] },
    paths: {
      albedo: "/textures/bathroom/tile_blue_gloss/albedo.ktx2",
      normal: "/textures/bathroom/tile_blue_gloss/normal.ktx2",
      roughness: "/textures/bathroom/tile_blue_gloss/roughness.ktx2",
    },
    tileSizeM: 0.60,
    normalScale: 0.45,
    roughnessStrength: 0.78,
    colorTint: "#ffffff",
    emissiveStrength: 0.04,
  },
  pbr_marble_gloss: {
    label: "Marmer – glanzend (PBR)",
    ui: { surface: ["floor", "wall"], templates: ["badkamer", "toilet"] },
    paths: {
      albedo: "/textures/bathroom/marble_gloss/albedo.jpg",
      normal: "/textures/bathroom/marble_gloss/normal.jpg",
      roughness: "/textures/bathroom/marble_gloss/roughness.jpg",
    },
    tileSizeM: 0.80,
    normalScale: 0.5,
    roughnessStrength: 0.35,
  },
  pbr_granite_grey_tile: {
    label: "Graniet tegel – grijs (PBR)",
    ui: { surface: ["floor"], templates: ["badkamer", "toilet"] },
    paths: {
      albedo: "/textures/bathroom/granite_grey_tile/albedo.ktx2",
      normal: "/textures/bathroom/granite_grey_tile/normal.ktx2",
      roughness: "/textures/bathroom/granite_grey_tile/roughness.ktx2",
    },
    tileSizeM: 0.60,
    normalScale: 0.45,
    roughnessStrength: 0.6,
  },

  pbr_wood_floor: {
    label: "Houten vloer (PBR)",
    ui: { surface: ["floor"], templates: ["badkamer", "toilet"] },
    paths: {
      albedo: "/textures/bathroom/wood_floor/albedo.ktx2",
      normal: "/textures/bathroom/wood_floor/normal.ktx2",
      roughness: "/textures/bathroom/wood_floor/roughness.ktx2",
    },
    tileSizeM: 0.25,
    normalScale: 0.6,
    roughnessStrength: 0.9,
  },

  // Garden
  pbr_grass: {
    label: "Gras (PBR)",
    ui: { surface: ["ground"], templates: ["tuin"] },
    paths: {
      albedo: "/textures/garden/grass/albedo.ktx2",
      normal: "/textures/garden/grass/normal.ktx2",
      roughness: "/textures/garden/grass/roughness.ktx2",
    },
    tileSizeM: 1.0,
    normalScale: 1.0,
    roughnessStrength: 0.95,
  },
  pbr_paving: {
    label: "Terrastegel / bestrating (PBR)",
    ui: { surface: ["ground"], templates: ["tuin"] },
    paths: {
      albedo: "/textures/garden/paving/albedo.ktx2",
      normal: "/textures/garden/paving/normal.ktx2",
      roughness: "/textures/garden/paving/roughness.ktx2",
    },
    tileSizeM: 0.60,
    normalScale: 0.8,
    roughnessStrength: 0.9,
  },

// Garden boundaries (terrain separation) - add your own CC0 textures here
pbr_boundary_fence_wood: {
  label: "Schutting hout (PBR)",
  ui: { surface: ["boundary"], templates: ["tuin"] },
  paths: {
    albedo: "/textures/garden/boundary/fence_wood/albedo.jpg",
    normal: "/textures/garden/boundary/fence_wood/normal.jpg",
    roughness: "/textures/garden/boundary/fence_wood/roughness.jpg",
  },
  tileSizeM: 1.0,
  roughnessStrength: 0.85,
},
pbr_boundary_hedge: {
  label: "Haag / begroeiing (PBR)",
  ui: { surface: ["boundary"], templates: ["tuin"] },
  paths: {
    albedo: "/textures/garden/boundary/hedge/albedo.jpg",
    normal: "/textures/garden/boundary/hedge/normal.jpg",
    roughness: "/textures/garden/boundary/hedge/roughness.jpg",
  },
  tileSizeM: 1.0,
  roughnessStrength: 0.95,
},
pbr_boundary_concrete: {
  label: "Muur / beton (PBR)",
  ui: { surface: ["boundary"], templates: ["tuin"] },
  paths: {
    albedo: "/textures/garden/boundary/concrete/albedo.jpg",
    normal: "/textures/garden/boundary/concrete/normal.jpg",
    roughness: "/textures/garden/boundary/concrete/roughness.jpg",
  },
  tileSizeM: 1.0,
  roughnessStrength: 0.9,
},
};

function normalizeMaterialTemplateId(id) {
  if (id === "bathroom") return "badkamer";
  if (id === "garden") return "tuin";
  if (id === "empty") return "leeg";
  if (id === "toilet") return "toilet";
  return id || "badkamer";
}

export function getMaterialOptions({ surface, templateId }) {
  const normalizedTemplateId = normalizeMaterialTemplateId(templateId);
  return Object.entries(REAL_PBR_PRESETS)
    .filter(([, preset]) => {
      const ui = preset?.ui;
      if (!ui) return false;
      const surfaces = Array.isArray(ui.surface) ? ui.surface : [ui.surface];
      const templates = Array.isArray(ui.templates) ? ui.templates : [ui.templates];
      return surfaces.includes(surface) && templates.includes(normalizedTemplateId);
    })
    .map(([value, preset]) => ({ value, label: preset.label }));
}

// Cache textures across component lifetimes (avoid reload spam)
const __realPbrCache = new Map();

// Minimal KTX2 support: if a preset path ends with .ktx2 we load it via KTX2Loader.
// Existing JPG-based presets keep working unchanged.
let __ktx2LoaderSingleton = null;

function __isKtx2Path(url) {
  return typeof url === "string" && url.toLowerCase().endsWith(".ktx2");
}

function __getKtx2Loader() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (__ktx2LoaderSingleton) return __ktx2LoaderSingleton;

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });

  const loader = new KTX2Loader();
  loader.setTranscoderPath("/basis/");
  loader.detectSupport(renderer);

  try {
    renderer.dispose();
    renderer.forceContextLoss?.();
  } catch {}

  __ktx2LoaderSingleton = loader;
  return loader;
}

function __loadTextureAny(url, onLoad, onError) {
  if (__isKtx2Path(url)) {
    const ktx2Loader = __getKtx2Loader();
    if (!ktx2Loader) {
      onError?.(new Error("KTX2 loader could not be created"));
      return;
    }
    ktx2Loader.load(url, onLoad, undefined, onError);
    return;
  }

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(url, onLoad, undefined, onError);
}

function __applyTexSettings(tex, repsX, repsZ, isColorMap) {
  if (!tex) return;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, repsX), Math.max(1, repsZ));
  tex.anisotropy = 8;
  if (isColorMap) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

/**
 * Load a PBR set via TextureLoader with graceful fallback (never crash).
 * Returns: { ready, failed, map, normalMap, roughnessMap, normalScale }
 */
function __clonePreparedTexture(baseTex, repsX, repsY, isColorMap, opts = null) {
  if (!baseTex) return null;
  const tex = baseTex.clone();
  tex.image = baseTex.image;
  tex.source = baseTex.source;
  __applyTexSettings(tex, repsX, repsY, isColorMap);
  if (opts?.flipX) {
    tex.repeat.x = -Math.abs(tex.repeat.x);
    tex.offset.x = 1;
  }
  if (opts?.flipY) {
    tex.repeat.y = -Math.abs(tex.repeat.y);
    tex.offset.y = 1;
  }
  if (opts?.rotateQuarterTurns) {
    tex.center.set(0.5, 0.5);
    tex.rotation = (Math.PI / 2) * opts.rotateQuarterTurns;
  }
  tex.needsUpdate = true;
  return tex;
}

function useRealPBRSet(materialId, repeatW, repeatD, opts = null) {
  const preset = REAL_PBR_PRESETS[materialId] || null;
  const [state, setState] = useState(() => ({
    ready: false,
    failed: false,
    map: null,
    normalMap: null,
    roughnessMap: null,
    normalScale: 0.7,
  }));

  useEffect(() => {
    if (!preset) {
      setState({ ready: false, failed: false, map: null, normalMap: null, roughnessMap: null, normalScale: 0.7 });
      return;
    }

    let cancelled = false;
    let cloned = { map: null, normalMap: null, roughnessMap: null };

    const setFromBase = (base) => {
      const map = __clonePreparedTexture(base.map, repeatW, repeatD, true, opts);
      const normalMap = __clonePreparedTexture(base.normalMap, repeatW, repeatD, false, opts);
      const roughnessMap = __clonePreparedTexture(base.roughnessMap, repeatW, repeatD, false, opts);

      cloned = { map, normalMap, roughnessMap };

      setState({
        ready: true,
        failed: false,
        map,
        normalMap,
        roughnessMap,
        normalScale: base.normalScale ?? preset.normalScale ?? 0.7,
      });
    };

    const cached = __realPbrCache.get(materialId);
    if (cached && cached.map && cached.normalMap && cached.roughnessMap) {
      setFromBase(cached);
      return () => {
        try { cloned.map?.dispose?.(); } catch {}
        try { cloned.normalMap?.dispose?.(); } catch {}
        try { cloned.roughnessMap?.dispose?.(); } catch {}
      };
    }

    const out = { map: null, normalMap: null, roughnessMap: null, normalScale: preset.normalScale ?? 0.7 };
    let ok = 0;
    let failed = false;

    const finish = () => {
      if (cancelled) return;

      if (failed || !out.map || !out.normalMap || !out.roughnessMap) {
        try { out.map?.dispose?.(); } catch {}
        try { out.normalMap?.dispose?.(); } catch {}
        try { out.roughnessMap?.dispose?.(); } catch {}
        setState({ ready: false, failed: true, map: null, normalMap: null, roughnessMap: null, normalScale: 0.7 });
        return;
      }

      __realPbrCache.set(materialId, out);
      setFromBase(out);
    };

    const loadOne = (key, url) => {
      __loadTextureAny(
        url,
        (tex) => {
          if (cancelled) {
            try { tex.dispose?.(); } catch {}
            return;
          }
          out[key] = tex;
          ok += 1;
          if (ok === 3) finish();
        },
        () => {
          failed = true;
          finish();
        }
      );
    };

    setState({ ready: false, failed: false, map: null, normalMap: null, roughnessMap: null, normalScale: out.normalScale });

    loadOne("map", preset.paths.albedo);
    loadOne("normalMap", preset.paths.normal);
    loadOne("roughnessMap", preset.paths.roughness);

    return () => {
      cancelled = true;
      try { cloned.map?.dispose?.(); } catch {}
      try { cloned.normalMap?.dispose?.(); } catch {}
      try { cloned.roughnessMap?.dispose?.(); } catch {}
    };
  }, [materialId, preset, repeatW, repeatD, opts?.rotateQuarterTurns]);

  return state;
}


function normalizeTemplateId(templateId) {
  if (templateId === "bathroom") return "badkamer";
  if (templateId === "garden") return "tuin";
  if (templateId === "empty") return "leeg";
  if (templateId === "toilet") return "toilet";
  return templateId || "badkamer";
}

function getThemeConfig(templateId) {
  const id = normalizeTemplateId(templateId);
  if (id === "tuin") {
    return {
      id,
      floor: { c1: "#f5f5f5", c2: "#eeeeee", squares: 64, tileSize: 0.25 },
      wall: { c1: "#d9d9d9", c2: "#cfcfcf", squares: 24, tileSize: 0.6, opacity: 0.25 },
      grid: { cell: "#0b0b0b", section: "#0b0b0b", cellThickness: 0.35, sectionThickness: 0.75 },
      light: { ambient: 0.9, sun: 0.78, fill: 0.38 },
    };
  }
  if (id === "toilet") {
    return {
      id,
      floor: { c1: "#d6d6d6", c2: "#cfcfcf", squares: 48, tileSize: 0.22 },
      wall: { c1: "#f2f2f2", c2: "#e9e9e9", squares: 28, tileSize: 0.25, opacity: 0.35 },
      grid: { cell: "#0b0b0b", section: "#0b0b0b", cellThickness: 0.4, sectionThickness: 0.9 },
      light: { ambient: 0.88, sun: 0.76, fill: 0.34 },
    };
  }
  // bathroom default
  return {
    id: "badkamer",
    floor: { c1: "#e6e6e6", c2: "#dedede", squares: 40, tileSize: 0.3 },
    wall: { c1: "#f4f4f4", c2: "#ececec", squares: 24, tileSize: 0.25, opacity: 0.35 },
    grid: { cell: "#0b0b0b", section: "#0b0b0b", cellThickness: 0.4, sectionThickness: 0.9 },
    light: { ambient: 0.9, sun: 0.78, fill: 0.36 },
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

function cameraFacingQuarterTurnDeg(camera, targetY = 0) {
  // Return a stable 0/90/180/270 rotation so newly placed objects face the user
  // based on the current camera direction around the room.
  const dx = camera.position.x;
  const dz = camera.position.z;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);

  if (az >= ax) {
    return dz >= 0 ? 180 : 0;
  }

  return dx >= 0 ? 270 : 90;
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
      kind = "wood";
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
    

    const isWhiteMaterial = (userHasOverride && o.color === "White") || (!userHasOverride && (kind === "ceramic"));
if (userHasOverride) {
      color = colorToHex(o.color);
    }


    // Shared material for main parts

    const mainMat = (
      <meshStandardMaterial
        color={color}
        roughness={isWhiteMaterial ? Math.min(roughness, 0.35) : roughness}
        metalness={metalness}
        emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
        emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
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
              emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
              emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
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
              color={
              userHasOverride
                ? adjustHex(
                    color,
                    isWhiteMaterial
                      ? -0.10
                      : (o.color === "Black" || color === "#222222" || color === "#000000") ? 0.35
                        : -0.12
                  )
                : "#8b6a4a"
            }
              roughness={0.95}
              metalness={0.02}
              emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
              emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
            />
          </mesh>
          {/* tiny handle hint */}
          <mesh castShadow receiveShadow position={[w * 0.25, yBody, d * 0.51]}>
            <boxGeometry args={[w * 0.18, bodyH * 0.06, 0.02]} />
            <meshStandardMaterial
              color={
              userHasOverride
                ? adjustHex(
                    color,
                    (o.color === "Black" || color === "#222222" || color === "#000000")
                      ? 0.35
                      : -0.18
                  )
                : "#3a3a3a"
            }
              roughness={0.35}
              metalness={0.6}
              emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
              emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
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
                emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
                emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
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
              emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
              emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
            />
          </mesh>

          {/* Plant */}
          <mesh castShadow receiveShadow position={[0, yPlant, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.12, Math.min(w, d) * 0.16, plantH, 16]} />
            <meshStandardMaterial
              color={"#2f7d32"}
              roughness={0.95}
              metalness={0.0}
              emissive={isWhiteMaterial ? "#ffffff" : "#000000"}
              emissiveIntensity={isWhiteMaterial ? 0.45 : 0}
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
            <meshStandardMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
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


function Room({
  roomW,
  roomD,
  wallH,
  showWalls,
  wallFrontMap,
  wallFrontNormalMap,
  wallFrontRoughnessMap,
  wallFrontNormalScale,
  wallLeftMap,
  wallLeftNormalMap,
  wallLeftRoughnessMap,
  wallLeftNormalScale,
  wallRightMap,
  wallRightNormalMap,
  wallRightRoughnessMap,
  wallRightNormalScale,
  wallRoughnessStrength = 0.9,
  wallColorTint = "#ffffff",
  wallEmissiveStrength = 0,
  wallOpacity,
  controlsRef,
  cameraAction,
}) {
  const { camera } = useThree();

  // Determine which wall faces the camera the most (auto-hide)
  const [hiddenWall, setHiddenWall] = useState("front");

  // IMPORTANT (stability/perf):
  // Avoid allocations and state-calls every frame. We only set state when the winner changes.
  const bestRef = useRef("front");
  const centerRef = useRef(new THREE.Vector3());

  // During programmatic camera moves (Reset/Top/Front/Iso), OrbitControls + damping can emit
  // intermediate "change" events. We suppress wall-updates briefly to prevent visible flicker.
  const suppressRef = useRef(false);
  const suppressTimerRef = useRef(null);

  const computeHiddenWall = () => {
    // Use camera position relative to a stable center.
    // This is deterministic and independent of frame timing.
    centerRef.current.set(0, wallH / 2, 0);

    const dx = camera.position.x - centerRef.current.x;
    const dz = camera.position.z - centerRef.current.z;

    const ax = Math.abs(dx);
    const az = Math.abs(dz);

    // Deadzone around the diagonal to avoid boundary jitter.
    // X must be clearly dominant before we switch to left/right.
    const DOM_RATIO = 1.12; // 12% dominance threshold

    if (ax > az * DOM_RATIO) {
      return dx >= 0 ? "right" : "left";
    }
    // Default to Z axis (front/back). This keeps Reset/iso views consistent.
    return dz >= 0 ? "front" : "back";
  };

  // Update hidden wall on OrbitControls changes (NOT per-frame).
  // This eliminates flip-flop caused by damping/float drift in useFrame.
  useEffect(() => {
    const c = controlsRef?.current;
    if (!c) return;

    const onChange = () => {
      if (suppressRef.current) return;
      const best = computeHiddenWall();
      if (bestRef.current !== best) {
        bestRef.current = best;
        setHiddenWall(best);
      }
    };

    c.addEventListener("change", onChange);

    // Initial compute (so first render is correct even before the first change event)
    onChange();

    return () => {
      c.removeEventListener("change", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef, wallH]);

  // Suppress updates briefly when a programmatic camera action runs (reset/top/front/iso).
  useEffect(() => {
    if (!cameraAction || !cameraAction.nonce) return;

    // Start suppression window
    suppressRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);

    // Immediately set a deterministic hidden wall based on the current camera pose.
    // (CameraActions runs in another component; this gives stable behavior even if order varies.)
    const immediate = computeHiddenWall();
    if (bestRef.current !== immediate) {
      bestRef.current = immediate;
      setHiddenWall(immediate);
    }

    suppressTimerRef.current = setTimeout(() => {
      suppressRef.current = false;

      // Final settle compute after the programmatic move finishes.
      const best = computeHiddenWall();
      if (bestRef.current !== best) {
        bestRef.current = best;
        setHiddenWall(best);
      }
    }, 250);

    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraAction?.nonce, wallH]);

  if (!showWalls) return null;

  const wallFrontMaterialKey = [
    wallFrontMap?.uuid || "nomap",
    wallFrontNormalMap?.uuid || "nonormal",
    wallFrontRoughnessMap?.uuid || "norough",
    wallFrontNormalScale || 0.7,
    wallRoughnessStrength,
    wallColorTint,
    wallEmissiveStrength,
    wallOpacity,
  ].join("|");

  const wallLeftMaterialKey = [
    wallLeftMap?.uuid || "nomap",
    wallLeftNormalMap?.uuid || "nonormal",
    wallLeftRoughnessMap?.uuid || "norough",
    wallLeftNormalScale || 0.7,
    wallRoughnessStrength,
    wallColorTint,
    wallEmissiveStrength,
    wallOpacity,
  ].join("|");

  const wallRightMaterialKey = [
    wallRightMap?.uuid || "nomap",
    wallRightNormalMap?.uuid || "nonormal",
    wallRightRoughnessMap?.uuid || "norough",
    wallRightNormalScale || 0.7,
    wallRoughnessStrength,
    wallColorTint,
    wallEmissiveStrength,
    wallOpacity,
  ].join("|");

// Important: walls should NOT capture pointer events (fixes "can't move inside walls")
  const noRaycast = () => null;

  const renderWall = (key, props, geomArgs, surface) => {
    // option 1 + option 3: always keep the camera-facing wall open (hidden)
    if (hiddenWall === key) return null;

    const isFrontSurface = surface === "front";
    const isLeftSurface = surface === "left";
    const wallMap = isFrontSurface ? wallFrontMap : (isLeftSurface ? wallLeftMap : wallRightMap);
    const wallNormalMap = isFrontSurface ? wallFrontNormalMap : (isLeftSurface ? wallLeftNormalMap : wallRightNormalMap);
    const wallRoughnessMap = isFrontSurface ? wallFrontRoughnessMap : (isLeftSurface ? wallLeftRoughnessMap : wallRightRoughnessMap);
    const wallNormalScale = isFrontSurface ? wallFrontNormalScale : (isLeftSurface ? wallLeftNormalScale : wallRightNormalScale);
    const wallMaterialKey = isFrontSurface ? wallFrontMaterialKey : (isLeftSurface ? wallLeftMaterialKey : wallRightMaterialKey);

    return (
      <mesh key={`${key}|${wallMaterialKey}`} castShadow receiveShadow {...props} raycast={noRaycast}>
        <boxGeometry args={geomArgs} />
        <meshStandardMaterial
          key={`mat|${key}|${wallMaterialKey}`}
          map={wallMap}
          normalMap={wallNormalMap || null}
          roughnessMap={wallRoughnessMap || null}
          normalScale={wallNormalMap ? new THREE.Vector2(wallNormalScale || 0.7, wallNormalScale || 0.7) : undefined}
          color={wallColorTint}
          emissive={wallColorTint}
          emissiveIntensity={wallEmissiveStrength}
          roughness={wallRoughnessMap ? wallRoughnessStrength : 0.92}
          metalness={0}
          transparent={wallOpacity < 1}
          opacity={wallOpacity}
          depthWrite={wallOpacity >= 1}
        />
      </mesh>
    );
  };

  return (
    <group>
      {renderWall("back", { position: [0, wallH / 2, -roomD / 2] }, [roomW, wallH, 0.1], "front")}
      {renderWall("front", { position: [0, wallH / 2, roomD / 2] }, [roomW, wallH, 0.1], "front")}
      {renderWall("left", { position: [-roomW / 2, wallH / 2, 0] }, [0.1, wallH, roomD], "left")}
      {renderWall("right", { position: [roomW / 2, wallH / 2, 0] }, [0.1, wallH, roomD], "right")}
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
      c.target.set(0, targetY, 0);
      c.update();
    }
  }, [camera, controlsRef, roomW, roomD, wallH]);

  return null;
}




function ControlsDefaultStateSaver({ controlsRef, roomW, roomD, wallH, targetY = 0 }) {
  // Save the "template default" OrbitControls state so Reset can return EXACTLY to it.
  // This avoids drift from damping/velocity and guarantees pixel-identical reset.
  useEffect(() => {
    const c = controlsRef?.current;
    if (!c) return;
    // Ensure target is consistent with our default view
    try {
      c.target.set(0, targetY, 0);
      c.update();
      c.saveState();
    } catch {}
  }, [controlsRef, roomW, roomD, wallH, targetY]);

  return null;
}


function CameraActions({ controlsRef, objects, selectedId, roomW, roomD, wallH, cameraAction, targetY = 0 }) {
  const { camera } = useThree();
  const lastNonceRef = useRef(null);

  useEffect(() => {
    if (!cameraAction || !cameraAction.nonce) return;
    if (lastNonceRef.current === cameraAction.nonce) return;
    lastNonceRef.current = cameraAction.nonce;

    const c = controlsRef.current;
    const base = Math.max(roomW, roomD);
    const isoDist = Math.max(4.2, base * 1.35);
    const isoY = Math.max(3.2, wallH * 1.25 + 0.9);

    const setView = (pos, target) => {
      const tx = target[0];
      const ty = target[1];
      const tz = target[2];

      // Always keep a sane up-vector
      camera.up.set(0, 1, 0);

      if (c) {
        c.target.set(tx, ty, tz);
      }
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(tx, ty, tz);

      if (c) c.update();
    };

    const getCurrentDistance = (targetVec) => {
      if (c && typeof c.getDistance === "function") return Math.max(0.5, c.getDistance());
      return Math.max(0.5, camera.position.distanceTo(targetVec));
    };

    const type = cameraAction.type;

    // Reset = exact dezelfde default view als bij template-load (Canvas camera.position).
    // Dit verandert de default niet; het hergebruikt exact dezelfde formule.
    if (type === "reset") {
      // Reset = EXACT terug naar de template-default view.
      // We gebruiken OrbitControls.saveState()/reset() zodat er geen drift is (damping/velocity),
      // en zodat het altijd pixel-identiek is aan de initiële template view.
      if (c && typeof c.reset === "function") {
        try {
          camera.up.set(0, 1, 0);
          c.reset();
          c.update();
          return;
        } catch {
          // fall through to hard-set view
        }
      }

      const defaultPos = [
        Math.max(4, roomW * 1.2),
        Math.max(3.2, wallH * 1.25 + 1),
        Math.max(4, roomD * 1.2),
      ];
      setView(defaultPos, [0, targetY, 0]);
      return;
    }

    // Presets: behoud zo veel mogelijk je huidige zoom (distance), zodat er niet "random" in/uit gezoomd wordt.
    if (type === "iso" || type === "top" || type === "front") {
      const target = new THREE.Vector3(0, targetY, 0);
      const dist = Math.max(3.0, Math.min(isoDist * 1.25, getCurrentDistance(target)));

      if (type === "iso") {
        const dir = new THREE.Vector3(1, 0.85, 1).normalize();
        const pos = target.clone().add(dir.multiplyScalar(dist));
        setView([pos.x, pos.y, pos.z], [0, targetY, 0]);
        return;
      }

      if (type === "top") {
        // Kleine z-offset om singulariteit te voorkomen (OrbitControls houdt hier niet van)
        const pos = target.clone().add(new THREE.Vector3(0, 1, 0).multiplyScalar(dist));
        setView([pos.x, pos.y, pos.z + 0.001], [0, targetY, 0]);
        return;
      }

      if (type === "front") {
        // Front = kijk vanaf +Z richting oorsprong, met een klein beetje hoogte.
        const pos = target.clone().add(new THREE.Vector3(0, 0.18, 1).normalize().multiplyScalar(dist));
        setView([pos.x, pos.y, pos.z], [0, targetY, 0]);
        return;
      }
    }

    if (type === "focus") {
      if (!selectedId) return;

      const o = (objects || []).find((x) => x && x.id === selectedId);
      if (!o) return;

      const tx = Number(o.x ?? 0);
      const tz = Number(o.z ?? 0);
      const ty = Number(o.y ?? 0) + Number(o.h ?? 0) * 0.5;

      // Object "radius" (ruw) voor een nette framing
      const halfW = Math.max(0.05, Number(o.w ?? 0.4) * 0.5);
      const halfD = Math.max(0.05, Number(o.d ?? 0.4) * 0.5);
      const halfH = Math.max(0.05, Number(o.h ?? 0.6) * 0.5);
      const radius = Math.max(halfW, halfD, halfH);

      // Meer "echte focus": zoom/framingsafstand gebaseerd op objectgrootte
      const dist = Math.max(1.8, Math.min(isoDist * 1.25, radius * 3.2));

      // Pro gedrag: focus "vanaf de voorkant" van het object (op basis van rotY).
      // We nemen forward = (0,0,1) en draaien dat met rotY (graden).
      const rotDeg = Number(o.rotY ?? 0);
      const rotRad = THREE.MathUtils.degToRad(rotDeg);
      const forward = new THREE.Vector3(Math.sin(rotRad), 0, Math.cos(rotRad));
      const dir = forward.multiplyScalar(-1).add(new THREE.Vector3(0, 0.35, 0)).normalize();

      const target = new THREE.Vector3(tx, ty, tz);
      const pos = target.clone().add(dir.multiplyScalar(dist));

      setView([pos.x, pos.y, pos.z], [tx, ty, tz]);
      return;
    }
  }, [cameraAction, camera, controlsRef, objects, selectedId, roomW, roomD, wallH, targetY]);

  return null;
}
function ZoomOverlay({ controlsRef, minDistance, maxDistance, targetY = 0 }) {
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
    target.y = targetY;
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
    <div className="pointer-events-auto z-30 flex items-center gap-2 rounded-xl border border-black/10 bg-white/90 p-2 shadow-sm backdrop-blur">
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
  onEmptyFloorClick,
  onMoveStart,
  onMove,
  snapStep = 0,
  roomW = 6,
  roomD = 6,
  wallH = 2.4,
  showWalls = true,
  templateId = "badkamer",
  cameraAction = null,
  // Surface materials (optional; defaults keep current look)
  floorMaterialId = "default",
  wallMaterialId = "default",
  groundMaterialId = "default",
  boundaryMaterialId = "default",
}) {
  const __webglInitial = useMemo(() => isWebGLAvailable(), []);
  const [__webglOk, set__webglOk] = useState(__webglInitial);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const controlsRef = useRef(null);
  const normalizedTemplateId = useMemo(() => normalizeTemplateId(templateId), [templateId]);
  const theme = useMemo(() => getThemeConfig(normalizedTemplateId), [normalizedTemplateId]);

  const isGardenTemplate = normalizedTemplateId === "tuin";

  // Camera target: indoor rooms look better when we orbit around the room center (wallH/2).
  // Garden/empty stays at y=0.
  const controlsTargetY = (!isGardenTemplate && showWalls) ? (wallH / 2) : 0;



const effectiveFloorMaterialId = isGardenTemplate ? "default" : floorMaterialId;
// In garden, wall dropdown is replaced by terrain boundary dropdown
const effectiveWallMaterialId = isGardenTemplate ? boundaryMaterialId : wallMaterialId;
const effectiveGroundMaterialId = isGardenTemplate ? groundMaterialId : "default";


// Surface material repeats (meters -> repeat count)
const floorRepeatX = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveFloorMaterialId];
  const tileSize = preset?.tileSizeM || theme.floor.tileSize || 1;
  return Math.max(1, roomW / tileSize);
}, [effectiveFloorMaterialId, theme, roomW]);

const floorRepeatZ = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveFloorMaterialId];
  const tileSize = preset?.tileSizeM || theme.floor.tileSize || 1;
  return Math.max(1, roomD / tileSize);
}, [effectiveFloorMaterialId, theme, roomD]);

const wallRepeatFrontX = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveWallMaterialId];
  const tileSize = preset?.tileSizeM || theme.wall.tileSize || 1;
  return Math.max(1, roomW / tileSize);
}, [effectiveWallMaterialId, theme, roomW]);

const wallRepeatSideX = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveWallMaterialId];
  const tileSize = preset?.tileSizeM || theme.wall.tileSize || 1;
  return Math.max(1, roomD / tileSize);
}, [effectiveWallMaterialId, theme, roomD]);

const wallRepeatY = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveWallMaterialId];
  const tileSize = preset?.tileSizeM || theme.wall.tileSize || 1;
  return Math.max(1, wallH / tileSize);
}, [effectiveWallMaterialId, theme, wallH]);

const groundRepeatX = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveGroundMaterialId];
  const tileSize = preset?.tileSizeM || theme.floor.tileSize || 1;
  return Math.max(1, roomW / tileSize);
}, [effectiveGroundMaterialId, theme, roomW]);

const groundRepeatZ = useMemo(() => {
  const preset = REAL_PBR_PRESETS[effectiveGroundMaterialId];
  const tileSize = preset?.tileSizeM || theme.floor.tileSize || 1;
  return Math.max(1, roomD / tileSize);
}, [effectiveGroundMaterialId, theme, roomD]);

const realFloor = useRealPBRSet(effectiveFloorMaterialId, floorRepeatX, floorRepeatZ);
const realWallFront = useRealPBRSet(effectiveWallMaterialId, wallRepeatFrontX, wallRepeatY, { rotateQuarterTurns: 1 });
const realWallLeft = useRealPBRSet(effectiveWallMaterialId, wallRepeatSideX, wallRepeatY, { rotateQuarterTurns: 1 });
const realWallRight = useRealPBRSet(effectiveWallMaterialId, wallRepeatSideX, wallRepeatY, { rotateQuarterTurns: 1, flipX: true });
const realGround = useRealPBRSet(effectiveGroundMaterialId, groundRepeatX, groundRepeatZ);

const floorPresetRoughness = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveFloorMaterialId]?.roughnessStrength ?? 0.9;
}, [effectiveFloorMaterialId]);

const wallPresetRoughness = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveWallMaterialId]?.roughnessStrength ?? 0.9;
}, [effectiveWallMaterialId]);

const groundPresetRoughness = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveGroundMaterialId]?.roughnessStrength ?? 0.95;
}, [effectiveGroundMaterialId]);

const floorPresetColorTint = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveFloorMaterialId]?.colorTint ?? "#ffffff";
}, [effectiveFloorMaterialId]);

const wallPresetColorTint = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveWallMaterialId]?.colorTint ?? "#ffffff";
}, [effectiveWallMaterialId]);

const floorPresetEmissiveStrength = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveFloorMaterialId]?.emissiveStrength ?? 0;
}, [effectiveFloorMaterialId]);

const wallPresetEmissiveStrength = useMemo(() => {
  return REAL_PBR_PRESETS[effectiveWallMaterialId]?.emissiveStrength ?? 0;
}, [effectiveWallMaterialId]);

const wallEmissiveStrengthToUse =
  (realWallFront.ready || realWallLeft.ready || realWallRight.ready)
    ? Math.max(wallPresetEmissiveStrength, 0.04)
    : wallPresetEmissiveStrength;


  const floorTex = useMemo(() => {
    const t = makeCheckerTexture({ c1: theme.floor.c1, c2: theme.floor.c2, squares: theme.floor.squares });
    const repsX = Math.max(1, roomW / theme.floor.tileSize);
    const repsZ = Math.max(1, roomD / theme.floor.tileSize);
    t.repeat.set(repsX, repsZ);
    return t;
  }, [theme, roomW, roomD]);

  // Prevent texture leaks when room/theme changes (stability on long sessions)
  useEffect(() => {
    return () => {
      try { floorTex?.dispose?.(); } catch {}
    };
  }, [floorTex]);

  const wallTexFront = useMemo(() => {
    const t = makeCheckerTexture({ c1: theme.wall.c1, c2: theme.wall.c2, squares: theme.wall.squares });
    const repsX = Math.max(1, roomW / theme.wall.tileSize);
    const repsY = Math.max(1, wallH / theme.wall.tileSize);
    t.repeat.set(repsX, repsY);
    return t;
  }, [theme, roomW, wallH]);

  useEffect(() => {
    return () => {
      try { wallTexFront?.dispose?.(); } catch {}
    };
  }, [wallTexFront]);

  const wallTexSide = useMemo(() => {
    const t = makeCheckerTexture({ c1: theme.wall.c1, c2: theme.wall.c2, squares: theme.wall.squares });
    const repsX = Math.max(1, roomD / theme.wall.tileSize);
    const repsY = Math.max(1, wallH / theme.wall.tileSize);
    t.repeat.set(repsX, repsY);
    return t;
  }, [theme, roomD, wallH]);

  useEffect(() => {
    return () => {
      try { wallTexSide?.dispose?.(); } catch {}
    };
  }, [wallTexSide]);


const wallFrontMapToUse = realWallFront.ready ? realWallFront.map : wallTexFront;
const wallFrontNormalToUse = realWallFront.ready ? realWallFront.normalMap : null;
const wallFrontRoughToUse = realWallFront.ready ? realWallFront.roughnessMap : null;
const wallFrontNormalScaleToUse = realWallFront.ready ? realWallFront.normalScale * 0.16 : 0.45;

const wallLeftMapToUse = realWallLeft.ready ? realWallLeft.map : wallTexSide;
const wallLeftNormalToUse = realWallLeft.ready ? realWallLeft.normalMap : null;
const wallLeftRoughToUse = realWallLeft.ready ? realWallLeft.roughnessMap : null;
const wallLeftNormalScaleToUse = realWallLeft.ready ? realWallLeft.normalScale * 0.16 : 0.45;

const wallRightMapToUse = realWallRight.ready ? realWallRight.map : wallTexSide;
const wallRightNormalToUse = realWallRight.ready ? realWallRight.normalMap : null;
const wallRightRoughToUse = realWallRight.ready ? realWallRight.roughnessMap : null;
const wallRightNormalScaleToUse = realWallRight.ready ? realWallRight.normalScale * 0.16 : 0.45;


  if (!__webglOk) {
    return (
      <div className="relative h-full w-full">
        <WebGLBlockedNotice />
      </div>
    );
  }

  
return (
  <div className="relative h-full w-full flex flex-col">
    <div className="relative flex-1">
      <WebGLErrorBoundary fallback={<WebGLBlockedNotice />} onError={() => set__webglOk(false)}>
        <Canvas camera={{ position: [Math.max(4, roomW * 1.2), Math.max(3.2, wallH * 1.25 + 1), Math.max(4, roomD * 1.2)], fov: 50 }} shadows gl={{ antialias: true }}>

        {/* Licht */}
        <ambientLight intensity={theme.light.ambient} />
        <hemisphereLight
          skyColor={"#ffffff"}
          groundColor={"#f3f3f3"}
          intensity={theme.light.fill || 0.35}
        />
                <ControlsDefaultStateSaver controlsRef={controlsRef} roomW={roomW} roomD={roomD} wallH={wallH} targetY={controlsTargetY} />
        <CameraActions controlsRef={controlsRef} objects={objects} selectedId={selectedId} roomW={roomW} roomD={roomD} wallH={wallH} cameraAction={cameraAction} targetY={controlsTargetY} />
<directionalLight
          position={[5, 9, 5]}
          intensity={theme.light.sun}
          castShadow
          shadow-bias={0.0005}
          shadow-normalBias={0.03}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />


        {/* Visible floor (theme) */}
        <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[Math.max(0.5, roomW), Math.max(0.5, roomD)]} />
          <meshStandardMaterial
            map={(isGardenTemplate && realGround.ready) ? realGround.map : (realFloor.ready ? realFloor.map : floorTex)}
            normalMap={(isGardenTemplate && realGround.ready) ? realGround.normalMap : (realFloor.ready ? realFloor.normalMap : null)}
            roughnessMap={(isGardenTemplate && realGround.ready) ? realGround.roughnessMap : (realFloor.ready ? realFloor.roughnessMap : null)}
            normalScale={(isGardenTemplate && realGround.ready) ? new THREE.Vector2(realGround.normalScale, realGround.normalScale) : (realFloor.ready ? new THREE.Vector2(realFloor.normalScale, realFloor.normalScale) : undefined)}
            color={floorPresetColorTint}
            emissive={floorPresetColorTint}
            emissiveIntensity={floorPresetEmissiveStrength}
            roughness={(isGardenTemplate && realGround.ready) ? groundPresetRoughness : (realFloor.ready ? floorPresetRoughness : 0.95)}
            metalness={0}
          />
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

            // Empty floor click deselects when not placing
            if (tool !== "place") {
              onEmptyFloorClick?.();
              return;
            }

            const p = e.point; // THREE.Vector3
            const x0 = snap(p.x, snapStep);
            const z0 = snap(p.z, snapStep);
            const rotY0 = (cameraFacingQuarterTurnDeg(controlsRef.current?.object || { position: { x: 0, z: -1 } }, controlsTargetY) + 180) % 360;
            onPlaceAt?.(x0, z0, rotY0);
          }}
          >
          <planeGeometry args={[Math.max(0.5, roomW), Math.max(0.5, roomD)]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>

        {/* Room walls */}
        <Room
          roomW={roomW}
          roomD={roomD}
          wallH={wallH}
          showWalls={showWalls}
          wallFrontMap={wallFrontMapToUse}
          wallFrontNormalMap={wallFrontNormalToUse}
          wallFrontRoughnessMap={wallFrontRoughToUse}
          wallFrontNormalScale={wallFrontNormalScaleToUse}
          wallLeftMap={wallLeftMapToUse}
          wallLeftNormalMap={wallLeftNormalToUse}
          wallLeftRoughnessMap={wallLeftRoughToUse}
          wallLeftNormalScale={wallLeftNormalScaleToUse}
          wallRightMap={wallRightMapToUse}
          wallRightNormalMap={wallRightNormalToUse}
          wallRightRoughnessMap={wallRightRoughToUse}
          wallRightNormalScale={wallRightNormalScaleToUse}
          wallRoughnessStrength={wallPresetRoughness}
          wallColorTint={wallPresetColorTint}
          wallEmissiveStrength={wallEmissiveStrengthToUse}
          wallOpacity={(!isGardenTemplate && (realWallFront.ready || realWallLeft.ready || realWallRight.ready) && effectiveWallMaterialId !== "default") ? 1 : theme.wall.opacity}
          controlsRef={controlsRef}
          cameraAction={cameraAction}
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
          target={[0, controlsTargetY, 0]}
        />

        </Canvas>
      </WebGLErrorBoundary>
    </div>

    {/* Zoom (in card footer, not over the 3D scene) */}
    <div className="pointer-events-none flex h-14 items-end justify-end px-3 pb-3">
      <ZoomOverlay controlsRef={controlsRef} minDistance={2.5} maxDistance={Math.max(10, roomW + roomD)} targetY={controlsTargetY} />
    </div>
  </div>
);
}
