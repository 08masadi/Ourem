'use client';

import React from 'react';

interface NeonVortexLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  sublabel?: string;
  fullScreen?: boolean;
}

export default function NeonVortexLoader({
  size = 'lg',
  label,
  sublabel,
  fullScreen = false,
}: NeonVortexLoaderProps) {
  // Dimensions based on size - scaled down for compact, elegant aesthetics
  const dimensionClass = {
    sm: 'w-16 h-16',
    md: 'w-28 h-28 sm:w-32 sm:h-32',
    lg: 'w-36 h-36 sm:w-40 sm:h-40',
    xl: 'w-48 h-48 sm:w-52 sm:h-52',
  }[size];

  const strokeWidth = {
    sm: 3,
    md: 4,
    lg: 4.5,
    xl: 5,
  }[size];

  const loaderVisual = (
    <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
      {/* Concentric Neon Vortex SVG */}
      <div className={`relative ${dimensionClass} flex items-center justify-center select-none`}>
        {/* Ambient Orange Background Glow */}
        <div className="absolute inset-8 rounded-full bg-orange-500/15 dark:bg-orange-600/20 blur-3xl pointer-events-none animate-pulse"></div>

        <svg
          viewBox="0 0 320 320"
          className="w-full h-full transform-gpu overflow-visible"
          style={{
            filter: 'drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 15px rgba(255, 102, 0, 0.7))',
          }}
        >
          <defs>
            {/* Bright Electric Orange Neon Linear Gradient */}
            <linearGradient id="neonOrangeVortex" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffb020" />
              <stop offset="50%" stopColor="#ff6200" />
              <stop offset="100%" stopColor="#ff3d00" />
            </linearGradient>

            {/* Neon Glow SVG Filter */}
            <filter id="neonVortexGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur1" />
              <feGaussianBlur stdDeviation="6" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Central Pulsing Neon Core Dot (Tanpa Persentase) */}
          <circle
            cx="160"
            cy="160"
            r="4.5"
            fill="#ff7700"
            filter="url(#neonVortexGlow)"
            className="animate-pulse"
          />

          {/* Ring 1 - r=26, Circumference ≈ 163.4px (Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="26"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="100 64"
            className="animate-vortex-ring-1"
          />

          {/* Ring 2 - r=42, Circumference ≈ 263.9px (Counter-Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="42"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="88 37 73 66"
            className="animate-vortex-ring-2"
          />

          {/* Ring 3 - r=58, Circumference ≈ 364.4px (Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="58"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="81 40 101 41 61 41"
            className="animate-vortex-ring-3"
          />

          {/* Ring 4 - r=74, Circumference ≈ 465.0px (Counter-Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="74"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="206 65 129 65"
            className="animate-vortex-ring-4"
          />

          {/* Ring 5 - r=90, Circumference ≈ 565.5px (Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="90"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="173 63 141 63 78 47"
            className="animate-vortex-ring-5"
          />

          {/* Ring 6 - r=106, Circumference ≈ 666.0px (Counter-Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="106"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="314 93 166 93"
            className="animate-vortex-ring-6"
          />

          {/* Ring 7 - r=122, Circumference ≈ 766.6px (Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="122"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="277 85 192 85 85 43"
            className="animate-vortex-ring-7"
          />

          {/* Ring 8 - r=138, Circumference ≈ 867.1px (Counter-Clockwise) */}
          <circle
            cx="160"
            cy="160"
            r="138"
            fill="none"
            stroke="url(#neonOrangeVortex)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="457 145 169 96"
            className="animate-vortex-ring-8"
          />
        </svg>
      </div>

      {/* Optional Clean Typography */}
      {(label || sublabel) && (
        <div className="mt-5 text-center space-y-1 max-w-sm px-4">
          {label && (
            <p className="text-xs sm:text-sm font-bold tracking-wider text-orange-500 uppercase font-mono drop-shadow-[0_0_8px_rgba(255,102,0,0.5)]">
              {label}
            </p>
          )}
          {sublabel && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
        {loaderVisual}
      </div>
    );
  }

  return loaderVisual;
}
