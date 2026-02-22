import React from "react";

/**
 * BB logo (SVG) — modern/2026: strak, geometrisch, met subtiele "depth".
 * We gebruiken pure SVG zodat je geen fonts nodig hebt.
 */
export default function BBLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="BB"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="bbg" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="bbh" x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Outer rounded square */}
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#bbg)" />

      {/* Soft highlight */}
      <path
        d="M18 16c10-6 22-4 28 2 2 2 1 5-2 5-10-1-18 1-26 6-3 2-6-1-4-3 1-3 2-7 4-10z"
        fill="url(#bbh)"
      />

      {/* Monogram: two mirrored 'B' blocks */}
      <g fill="#ffffff" opacity="0.92">
        {/* Left B */}
        <path d="M22 20h10c5 0 8 3 8 7 0 3-2 5-4 6 3 1 5 3 5 6 0 5-4 8-10 8H22V20zm10 11c2 0 3-1 3-2 0-2-1-2-3-2h-4v4h4zm1 13c3 0 4-1 4-3s-1-3-4-3h-5v6h5z" />
        {/* Right B (slightly offset for depth) */}
        <path
          d="M33 20h9c5 0 8 3 8 7 0 3-2 5-4 6 3 1 5 3 5 6 0 5-4 8-10 8h-8V20zm9 11c2 0 3-1 3-2 0-2-1-2-3-2h-3v4h3zm1 13c3 0 4-1 4-3s-1-3-4-3h-4v6h4z"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}
