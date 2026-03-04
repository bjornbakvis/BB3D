import * as THREE from "three";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Edges, Html, Environment } from "@react-three/drei";

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


/**
 * Real PBR texture sets (recommended for professional look).
 * Place CC0 texture sets under /public/textures/... so they can be loaded by URL.
 * Each set should provide at least: albedo (basecolor), normal, roughness.
 *
 * Folder example:
 * public/textures/bathroom/tile_white_gloss/
 *   albedo.jpg
 *   normal.jpg
 *   roughness.jpg
 */
const REAL_PBR_PRESETS = {
  // Bathroom / toilet
  pbr_tile_white_gloss: {
    label: "Wandtegel – glanzend wit (PBR)",
    paths: {
      albedo: "/textures/bathroom/tile_white_gloss/albedo.jpg",
      normal: "/textures/bathroom/tile_white_gloss/normal.jpg",
      roughness: "/textures/bathroom/tile_white_gloss/roughness.jpg",
    },
    tileSizeM: 0.60, // 60cm
  },
  pbr_tile_grey_matte: {
    label: "Tegel – mat grijs (PBR)",
    paths: {
      albedo: "/textures/bathroom/tile_grey_matte/albedo.jpg",
      normal: "/textures/bathroom/tile_grey_matte/normal.jpg",
      roughness: "/textures/bathroom/tile_grey_matte/roughness.jpg",
    },
    tileSizeM: 0.60,
  },
  pbr_marble_gloss: {
    label: "Marmer – glanzend (PBR)",
    paths: {
      albedo: "/textures/bathroom/marble_gloss/albedo.jpg",
      normal: "/textures/bathroom/marble_gloss/normal.jpg",
      roughness: "/textures/bathroom/marble_gloss/roughness.jpg",
    },
    tileSizeM: 0.80,
  },

  // Garden
  pbr_grass: {
    label: "Gras (PBR)",
    paths: {
      albedo: "/textures/garden/grass/albedo.jpg",
      normal: "/textures/garden/grass/normal.jpg",
      roughness: "/textures/garden/grass/roughness.jpg",
    },
    tileSizeM: 1.0,
  },
  pbr_paving: {
    label: "Terrastegel / bestrating (PBR)",
    paths: {
      albedo: "/textures/garden/paving/albedo.jpg",
      normal: "/textures/garden/paving/normal.jpg",
      roughness: "/textures/garden/paving/roughness.jpg",
    },
    tileSizeM: 0.60,
  },
};

// Cache textures across renders to avoid reloading
const __realPbrCache = new Map();

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
 * Loads a real PBR set by URL with graceful fallback (no crash if missing files).
 * Returns { ready, failed, map, normalMap, roughnessMap, roughness, metalness }.
 */
function useRealPBRSet(materialId, roomW, roomD) {
  const preset = REAL_PBR_PRESETS[materialId] || null;
  const [state, setState] = useState(() => ({ ready: false, failed: false, map: null, normalMap: null, roughnessMap: null }));

  useEffect(() => {
    if (!preset) {
      setState({ ready: false, failed: false, map: null, normalMap: null, roughnessMap: null });
      return;
    }

    const cacheKey = materialId;
    const cached = __realPbrCache.get(cacheKey);
    if (cached && cached.map) {
      setState({ ready: true, failed: false, map: cached.map, normalMap: cached.normalMap, roughnessMap: cached.roughnessMap });
      return;
    }

    let cancelled = false;
    const loader = new THREE.TextureLoader();

    const out = { map: null, normalMap: null, roughnessMap: null };
    let okCount = 0;
    let fail = false;

    const repsX = Math.max(1, roomW / preset.tileSizeM);
    const repsZ = Math.max(1, roomD / preset.tileSizeM);

    const done = () => {
      if (cancelled) return;
      if (fail) {
        // Dispose any partial loads
        try { out.map?.dispose?.(); } catch {}
        try { out.normalMap?.dispose?.(); } catch {}
        try { out.roughnessMap?.dispose?.(); } catch {}
        setState({ ready: false, failed: true, map: null, normalMap: null, roughnessMap: null });
        return;
      }
      __applyTexSettings(out.map, repsX, repsZ, true);
      __applyTexSettings(out.normalMap, repsX, repsZ, false);
      __applyTexSettings(out.roughnessMap, repsX, repsZ, false);

      __realPbrCache.set(cacheKey, out);
      setState({ ready: true, failed: false, map: out.map, normalMap: out.normalMap, roughnessMap: out.roughnessMap });
    };

    const loadOne = (key, url, isColorMap) => {
      loader.load(
        url,
        (tex) => {
          if (cancelled) {
            try { tex.dispose?.(); } catch {}
            return;
          }
          out[key] = tex;
          okCount += 1;
          if (okCount === 3) done();
        },
        undefined,
        () => {
          fail = true;
          done();
        }
      );
    };

    setState({ ready: false, failed: false, map: null, normalMap: null, roughnessMap: null });

    loadOne("map", preset.paths.albedo, true);
    loadOne("normalMap", preset.paths.normal, false);
    loadOne("roughnessMap", preset.paths.roughness, false);

    return () => {
      cancelled = true;
    };
  }, [materialId, preset, roomW, roomD]);

  return state;
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

// --- Procedural PBR-ish textures (stability-first, no external assets) ---
// Goal: avoid "flat colored" look by using basecolor + normal + roughness maps.
// These are lightweight CanvasTextures that repeat cleanly.

function _makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

function _clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Very small deterministic hash noise (no allocations)
function _hash2(x, y, seed) {
  // x,y are ints
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  // 0..1
  return (n >>> 0) / 4294967295;
}

// Creates a seamless-ish value noise (tileable when period divides size)
function _makeNoiseTexture({ size = 512, period = 64, seed = 1, contrast = 1.0 }) {
  const { canvas, ctx } = _makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x / size) * period);
      const gy = Math.floor((y / size) * period);
      const r = _hash2(gx % period, gy % period, seed);
      const v = _clamp01(0.5 + (r - 0.5) * contrast);
      const c = Math.floor(v * 255);
      const i = (y * size + x) * 4;
      data[i + 0] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Create a simple tile basecolor + roughness map + normal map (derived from grout height)
function makeTileTextureSet({
  size = 1024,
  tileSizePx = 160,       // tile size in pixels
  groutPx = 6,
  cTileA = "#f2f2f2",
  cTileB = "#e9e9e9",
  cGrout = "#bdbdbd",
  gloss = 0.25,           // base roughness for tiles (lower = glossier)
  matte = 0.75,           // base roughness for grout (higher = rougher)
  seed = 1,
  microNoise = 0.08,      // subtle variation inside tiles
}) {
  const { canvas, ctx } = _makeCanvas(size);

  // Basecolor
  ctx.fillStyle = cGrout;
  ctx.fillRect(0, 0, size, size);

  const cols = Math.ceil(size / tileSizePx);
  const rows = Math.ceil(size / tileSizePx);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const x0 = x * tileSizePx + groutPx;
      const y0 = y * tileSizePx + groutPx;
      const w = tileSizePx - groutPx * 2;
      const h = tileSizePx - groutPx * 2;

      const mix = _hash2(x, y, seed);
      ctx.fillStyle = mix > 0.5 ? cTileA : cTileB;
      ctx.fillRect(x0, y0, w, h);

      // subtle "speckle" / tone variation
      const speck = Math.floor(_hash2(x + 11, y + 7, seed + 9) * 12) + 4;
      ctx.fillStyle = `rgba(0,0,0,${microNoise})`;
      for (let k = 0; k < speck; k++) {
        const rx = x0 + Math.floor(_hash2(x + k, y, seed + 3) * w);
        const ry = y0 + Math.floor(_hash2(x, y + k, seed + 5) * h);
        const rr = Math.floor(_hash2(x + k, y + k, seed + 7) * 2) + 1;
        ctx.fillRect(rx, ry, rr, rr);
      }
    }
  }

  const baseMap = new THREE.CanvasTexture(canvas);
  baseMap.wrapS = THREE.RepeatWrapping;
  baseMap.wrapT = THREE.RepeatWrapping;
  baseMap.anisotropy = 8;
  baseMap.needsUpdate = true;

  // Roughness map: grout rough, tile smooth
  const { canvas: rCanvas, ctx: rCtx } = _makeCanvas(size);
  rCtx.fillStyle = `rgb(${Math.floor(matte * 255)},${Math.floor(matte * 255)},${Math.floor(matte * 255)})`;
  rCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const x0 = x * tileSizePx + groutPx;
      const y0 = y * tileSizePx + groutPx;
      const w = tileSizePx - groutPx * 2;
      const h = tileSizePx - groutPx * 2;

      // per-tile slight roughness variation
      const v = _clamp01(gloss + (_hash2(x, y, seed + 21) - 0.5) * 0.06);
      const c = Math.floor(v * 255);
      rCtx.fillStyle = `rgb(${c},${c},${c})`;
      rCtx.fillRect(x0, y0, w, h);
    }
  }

  const roughMap = new THREE.CanvasTexture(rCanvas);
  roughMap.wrapS = THREE.RepeatWrapping;
  roughMap.wrapT = THREE.RepeatWrapping;
  roughMap.anisotropy = 8;
  roughMap.needsUpdate = true;

  // Height map for normals: grout lines higher contrast
  const { canvas: hCanvas, ctx: hCtx } = _makeCanvas(size);
  // Start with mid gray (flat)
  hCtx.fillStyle = "rgb(128,128,128)";
  hCtx.fillRect(0, 0, size, size);

  // Draw grout as darker (lower) => edges produce normal variation
  hCtx.fillStyle = "rgb(90,90,90)";
  hCtx.lineWidth = groutPx;
  for (let y = 0; y <= rows; y++) {
    const yy = y * tileSizePx;
    hCtx.beginPath();
    hCtx.moveTo(0, yy);
    hCtx.lineTo(size, yy);
    hCtx.stroke();
  }
  for (let x = 0; x <= cols; x++) {
    const xx = x * tileSizePx;
    hCtx.beginPath();
    hCtx.moveTo(xx, 0);
    hCtx.lineTo(xx, size);
    hCtx.stroke();
  }

  // Convert height -> normal (very simple finite difference)
  const hImg = hCtx.getImageData(0, 0, size, size);
  const hData = hImg.data;

  const { canvas: nCanvas, ctx: nCtx } = _makeCanvas(size);
  const nImg = nCtx.createImageData(size, size);
  const nData = nImg.data;

  const strength = 3.0;
  const getH = (x, y) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return hData[(yy * size + xx) * 4] / 255.0;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = getH(x - 1, y);
      const hr = getH(x + 1, y);
      const hd = getH(x, y - 1);
      const hu = getH(x, y + 1);

      const dx = (hl - hr) * strength;
      const dy = (hd - hu) * strength;

      // normal = normalize([dx, dy, 1])
      let nx = dx, ny = dy, nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen; ny *= invLen; nz *= invLen;

      const i = (y * size + x) * 4;
      nData[i + 0] = Math.floor((nx * 0.5 + 0.5) * 255);
      nData[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      nData[i + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      nData[i + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(nCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = 8;
  normalMap.needsUpdate = true;

  return { map: baseMap, roughnessMap: roughMap, normalMap };
}

function makeGrassTextureSet({
  size = 1024,
  seed = 11,
  baseA = "#3f7a45",
  baseB = "#2f6a3a",
}) {
  const { canvas, ctx } = _makeCanvas(size);

  // Base green
  ctx.fillStyle = baseA;
  ctx.fillRect(0, 0, size, size);

  // Add noise blades
  const blades = 22000;
  for (let i = 0; i < blades; i++) {
    const x = Math.floor(_hash2(i, i + 1, seed) * size);
    const y = Math.floor(_hash2(i + 3, i + 7, seed + 2) * size);
    const h = 2 + Math.floor(_hash2(i + 13, i + 17, seed + 5) * 5);
    const w = 1;
    ctx.fillStyle = _hash2(i, i + 9, seed + 3) > 0.5 ? baseB : baseA;
    ctx.globalAlpha = 0.20;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  // Roughness: grass is rough (high roughness)
  const rough = _makeNoiseTexture({ size, period: 96, seed: seed + 19, contrast: 0.55 });
  // Normal: derived from noise
  const normal = _makeNoiseTexture({ size, period: 96, seed: seed + 31, contrast: 0.95 });
  // Convert grayscale -> normal-ish by treating noise as height (cheap approximation)
  // We keep it simple: reuse the noise as a pseudo-normal in shader by mapping channels.
  // Better normals are possible, but this is stable and lightweight.
  try {
    // paint into canvas to build RGB normal
    const img = rough.image; // canvas
  } catch {}

  return { map, roughnessMap: rough, normalMap: null };
}

function getProceduralSurfaceMaterialPreset(materialId) {
  // Return a preset describing how to build textures + scalar props.
  // Keep ids stable (used by UI dropdowns).
  const id = String(materialId || "");
  if (id === "tile_gloss_white") {
    return { kind: "tile", tileSize: 0.3, gloss: 0.22, matte: 0.86, cA: "#f5f5f5", cB: "#efefef", grout: "#b8b8b8", seed: 3 };
  }
  if (id === "tile_matte_grey") {
    return { kind: "tile", tileSize: 0.3, gloss: 0.55, matte: 0.92, cA: "#d9d9d9", cB: "#cfcfcf", grout: "#a9a9a9", seed: 7 };
  }
  if (id === "tile_marble_gloss") {
    return { kind: "tile", tileSize: 0.6, gloss: 0.18, matte: 0.86, cA: "#f1f1f1", cB: "#e6e6e6", grout: "#b0b0b0", seed: 13 };
  }
  if (id === "paving") {
    return { kind: "tile", tileSize: 0.6, gloss: 0.55, matte: 0.95, cA: "#bdbdbd", cB: "#a9a9a9", grout: "#7f7f7f", seed: 17 };
  }
  if (id === "grass") {
    return { kind: "grass", tileSize: 0.5, seed: 11 };
  }
  // fallback: checker (theme)
  return { kind: "checker" };
}



function getThemeConfig(templateId) {
  // Normalize Dutch template ids used in UI
  const raw = templateId || "bathroom";
  const id = raw === "tuin" ? "garden" : raw === "badkamer" ? "bathroom" : raw;

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


function Room({ roomW, roomD, wallH, showWalls, wallMap, wallNormalMap, wallRoughnessMap, wallRoughness = 0.92, wallOpacity, controlsRef, cameraAction }) {
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

  const wallMat = (
    <meshStandardMaterial
      map={wallMap}
      normalMap={wallNormalMap}
      roughnessMap={wallRoughnessMap}
      color="#ffffff"
      roughness={wallRoughness}
      metalness={0}
      transparent={wallOpacity < 1}
      opacity={wallOpacity}
      depthWrite={wallOpacity >= 1}
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




function ControlsDefaultStateSaver({ controlsRef, roomW, roomD, wallH }) {
  // Save the "template default" OrbitControls state so Reset can return EXACTLY to it.
  // This avoids drift from damping/velocity and guarantees pixel-identical reset.
  useEffect(() => {
    const c = controlsRef?.current;
    if (!c) return;
    // Ensure target is consistent with our default view
    try {
      c.target.set(0, 0, 0);
      c.update();
      c.saveState();
    } catch {}
  }, [controlsRef, roomW, roomD, wallH]);

  return null;
}


function CameraActions({ controlsRef, objects, selectedId, roomW, roomD, wallH, cameraAction }) {
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
      setView(defaultPos, [0, 0, 0]);
      return;
    }

    // Presets: behoud zo veel mogelijk je huidige zoom (distance), zodat er niet "random" in/uit gezoomd wordt.
    if (type === "iso" || type === "top" || type === "front") {
      const target = new THREE.Vector3(0, 0, 0);
      const dist = Math.max(3.0, Math.min(isoDist * 1.25, getCurrentDistance(target)));

      if (type === "iso") {
        const dir = new THREE.Vector3(1, 0.85, 1).normalize();
        const pos = target.clone().add(dir.multiplyScalar(dist));
        setView([pos.x, pos.y, pos.z], [0, 0, 0]);
        return;
      }

      if (type === "top") {
        // Kleine z-offset om singulariteit te voorkomen (OrbitControls houdt hier niet van)
        const pos = target.clone().add(new THREE.Vector3(0, 1, 0).multiplyScalar(dist));
        setView([pos.x, pos.y, pos.z + 0.001], [0, 0, 0]);
        return;
      }

      if (type === "front") {
        // Front = kijk vanaf +Z richting oorsprong, met een klein beetje hoogte.
        const pos = target.clone().add(new THREE.Vector3(0, 0.18, 1).normalize().multiplyScalar(dist));
        setView([pos.x, pos.y, pos.z], [0, 0, 0]);
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
  }, [cameraAction, camera, controlsRef, objects, selectedId, roomW, roomD, wallH]);

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
  floorMaterialId = null,
  wallMaterialId = null,
  cameraAction = null,
}) {
  const __webglInitial = useMemo(() => isWebGLAvailable(), []);
  const [__webglOk, set__webglOk] = useState(__webglInitial);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const controlsRef = useRef(null);
  const theme = useMemo(() => getThemeConfig(templateId), [templateId]);

  
  // --- Surface materials (procedural, PBR-ish) ---
  // Attempt real PBR textures first (fallback to procedural if missing)
  const realFloor = useRealPBRSet(floorMaterialId, roomW, roomD);
  const realWall = useRealPBRSet(wallMaterialId, roomW, roomD);
  const floorMatSet = useMemo(() => {
    // Real PBR (if available)
    if (realFloor && realFloor.ready) {
      return { kind: "real", map: realFloor.map, normalMap: realFloor.normalMap, roughnessMap: realFloor.roughnessMap, roughness: 0.9, metalness: 0 };
    }
    const preset = getProceduralSurfaceMaterialPreset(floorMaterialId || (theme.id === "garden" ? "grass" : "tile_matte_grey"));
    if (preset.kind === "tile") {
      const size = 1024;
      const tileSizePx = Math.max(80, Math.floor((preset.tileSize / 0.3) * 160));
      const groutPx = Math.max(4, Math.floor(tileSizePx * 0.04));
      const set = makeTileTextureSet({
        size,
        tileSizePx,
        groutPx,
        cTileA: preset.cA,
        cTileB: preset.cB,
        cGrout: preset.grout,
        gloss: preset.gloss,
        matte: preset.matte,
        seed: preset.seed,
      });
      const repsX = Math.max(1, roomW / preset.tileSize);
      const repsZ = Math.max(1, roomD / preset.tileSize);
      set.map.repeat.set(repsX, repsZ);
      set.roughnessMap.repeat.set(repsX, repsZ);
      set.normalMap.repeat.set(repsX, repsZ);
      return { kind: "tile", ...set, roughness: preset.gloss, metalness: 0 };
    }
    if (preset.kind === "grass") {
      const set = makeGrassTextureSet({ size: 1024, seed: preset.seed, baseA: theme.floor.c1, baseB: theme.floor.c2 });
      const repsX = Math.max(1, roomW / preset.tileSize);
      const repsZ = Math.max(1, roomD / preset.tileSize);
      set.map.repeat.set(repsX, repsZ);
      if (set.roughnessMap) set.roughnessMap.repeat.set(repsX, repsZ);
      return { kind: "grass", ...set, roughness: 0.95, metalness: 0 };
    }
    // fallback checker (theme)
    const t = makeCheckerTexture({ c1: theme.floor.c1, c2: theme.floor.c2, squares: theme.floor.squares });
    const repsX = Math.max(1, roomW / theme.floor.tileSize);
    const repsZ = Math.max(1, roomD / theme.floor.tileSize);
    t.repeat.set(repsX, repsZ);
    return { kind: "checker", map: t, normalMap: null, roughnessMap: null, roughness: 0.95, metalness: 0 };
  }, [floorMaterialId, realFloor.ready, theme, roomW, roomD]);

  useEffect(() => {
    return () => {
      try { floorMatSet?.map?.dispose?.(); } catch {}
      try { floorMatSet?.normalMap?.dispose?.(); } catch {}
      try { floorMatSet?.roughnessMap?.dispose?.(); } catch {}
    };
  }, [floorMatSet]);

  const wallMatSet = useMemo(() => {
    // Real PBR (if available)
    if (realWall && realWall.ready) {
      return { kind: "real", map: realWall.map, normalMap: realWall.normalMap, roughnessMap: realWall.roughnessMap, roughness: 0.9, metalness: 0 };
    }
    const preset = getProceduralSurfaceMaterialPreset(wallMaterialId || (theme.id === "garden" ? "tile_matte_grey" : "tile_gloss_white"));
    if (preset.kind === "tile") {
      const size = 1024;
      const tileSizePx = Math.max(80, Math.floor((preset.tileSize / 0.3) * 160));
      const groutPx = Math.max(4, Math.floor(tileSizePx * 0.04));
      const set = makeTileTextureSet({
        size,
        tileSizePx,
        groutPx,
        cTileA: preset.cA,
        cTileB: preset.cB,
        cGrout: preset.grout,
        gloss: preset.gloss,
        matte: preset.matte,
        seed: preset.seed + 101,
      });
      const repsX = Math.max(1, roomW / preset.tileSize);
      const repsZ = Math.max(1, roomD / preset.tileSize);
      set.map.repeat.set(repsX, repsZ);
      set.roughnessMap.repeat.set(repsX, repsZ);
      set.normalMap.repeat.set(repsX, repsZ);
      return { kind: "tile", ...set, roughness: preset.gloss, metalness: 0 };
    }
    // fallback checker (theme)
    const t = makeCheckerTexture({ c1: theme.wall.c1, c2: theme.wall.c2, squares: theme.wall.squares });
    const repsX = Math.max(1, roomW / theme.wall.tileSize);
    const repsZ = Math.max(1, roomD / theme.wall.tileSize);
    t.repeat.set(repsX, repsZ);
    return { kind: "checker", map: t, normalMap: null, roughnessMap: null, roughness: 0.92, metalness: 0 };
  }, [wallMaterialId, realWall.ready, theme, roomW, roomD]);

  useEffect(() => {
    return () => {
      try { wallMatSet?.map?.dispose?.(); } catch {}
      try { wallMatSet?.normalMap?.dispose?.(); } catch {}
      try { wallMatSet?.roughnessMap?.dispose?.(); } catch {}
    };
  }, [wallMatSet]);

  const floorTex = floorMatSet.map;
  const wallTex = wallMatSet.map;


  if (!__webglOk) {
    return (
      <div className="relative h-full w-full">
        <WebGLBlockedNotice />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <WebGLErrorBoundary fallback={<WebGLBlockedNotice />} onError={() => set__webglOk(false)}>
        <Canvas camera={{ position: [Math.max(4, roomW * 1.2), Math.max(3.2, wallH * 1.25 + 1), Math.max(4, roomD * 1.2)], fov: 50 }} shadows gl={{ antialias: true }}>
        {/* Licht */}
        <ambientLight intensity={theme.light.ambient} />
                <ControlsDefaultStateSaver controlsRef={controlsRef} roomW={roomW} roomD={roomD} wallH={wallH} />
        <CameraActions controlsRef={controlsRef} objects={objects} selectedId={selectedId} roomW={roomW} roomD={roomD} wallH={wallH} cameraAction={cameraAction} />
<directionalLight
          position={[6, 10, 4]}
          intensity={theme.light.sun}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />


        {/* Visible floor (theme) */}
        <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[Math.max(0.5, roomW), Math.max(0.5, roomD)]} />
          <meshStandardMaterial
            map={floorMatSet.map}
            normalMap={floorMatSet.normalMap}
            roughnessMap={floorMatSet.roughnessMap}
            color="#ffffff"
            roughness={floorMatSet.roughness}
            metalness={floorMatSet.metalness}
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

            // Place only when the tool is "place"
            if (tool !== "place") return;

            const p = e.point; // THREE.Vector3
            const x0 = snap(p.x, snapStep);
            const z0 = snap(p.z, snapStep);
            onPlaceAt?.(x0, z0);
          }}
          >
          <planeGeometry args={[Math.max(0.5, roomW), Math.max(0.5, roomD)]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>

        {/* Room walls */}
        <Room roomW={roomW} roomD={roomD} wallH={wallH} showWalls={showWalls} wallMap={wallMatSet.map} wallNormalMap={wallMatSet.normalMap} wallRoughnessMap={wallMatSet.roughnessMap} wallRoughness={wallMatSet.roughness} wallOpacity={theme.wall.opacity} controlsRef={controlsRef} cameraAction={cameraAction} />


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
      </WebGLErrorBoundary>

      {/* Zoom UI overlay (DOM) */}
      <ZoomOverlay controlsRef={controlsRef} minDistance={2.5} maxDistance={Math.max(10, roomW + roomD)} />
    </div>
  );
}
