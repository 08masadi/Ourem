import React from 'react';
import NeonVortexLoader from './NeonVortexLoader';

interface ModernLoaderProps {
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'page' | 'inline' | 'fullscreen';
}

export default function ModernLoader({
  label = 'Memuat Data...',
  sublabel = 'Menghubungkan ke server Ourem',
  size = 'lg',
  variant = 'page',
}: ModernLoaderProps) {
  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-2.5 text-xs font-semibold text-orange-500">
        <NeonVortexLoader size="sm" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === 'fullscreen') {
    return <NeonVortexLoader size="xl" label={label} sublabel={sublabel} fullScreen />;
  }

  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <NeonVortexLoader size={size} label={label} sublabel={sublabel} />
    </div>
  );
}
