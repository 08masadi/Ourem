import React from 'react';

interface ModernLoaderProps {
  label?: string;
  sublabel?: string;
  variant?: 'page' | 'inline' | 'card' | 'skeleton';
}

export default function ModernLoader({
  label = 'Memuat Data...',
  sublabel = 'Menghubungkan ke server Ourem',
  variant = 'page',
}: ModernLoaderProps) {
  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce"></span>
        </span>
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Top Subtle Shimmer Bar */}
      <div className="w-full max-w-sm h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-8 relative">
        <div className="h-full w-1/3 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 rounded-full animate-[shimmer_1.6s_infinite_ease-in-out] absolute"></div>
      </div>

      {/* Modern Center Floating Loader Card */}
      <div className="relative flex flex-col items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-950/5 dark:shadow-black/40 max-w-xs w-full text-center">
        {/* Animated Brand Pulse Badge */}
        <div className="relative flex items-center justify-center my-1">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 dark:bg-orange-500/20 animate-ping absolute opacity-60"></div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 p-0.5 shadow-md shadow-orange-500/25 relative flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-bounce"></span>
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-wider uppercase">
            {label}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {sublabel}
          </p>
        </div>

        {/* Shimmer Placeholder Skeletons */}
        <div className="w-full space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4 mx-auto animate-pulse"></div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2 mx-auto animate-pulse [animation-delay:0.2s]"></div>
        </div>
      </div>
    </div>
  );
}
