'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

export interface DynamicIslandDetail {
  title: string;
  message?: string;
  durationMs?: number;
}

// Helper untuk memanggil notifikasi dari mana saja (client components)
export function triggerSuccessNotification(title: string, message?: string, durationMs = 3500) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ourem-dynamic-success', {
        detail: { title, message, durationMs },
      })
    );
  }
}

export default function DynamicIslandSuccess() {
  const [data, setData] = useState<DynamicIslandDetail | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<DynamicIslandDetail>;
      if (customEvent.detail) {
        setIsClosing(false);
        setData(customEvent.detail);
      }
    };

    window.addEventListener('ourem-dynamic-success', handleEvent);
    return () => window.removeEventListener('ourem-dynamic-success', handleEvent);
  }, []);

  useEffect(() => {
    if (!data) return;

    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        setData(null);
        setIsClosing(false);
      }, 250);
    }, data.durationMs || 3500);

    return () => clearTimeout(timer);
  }, [data]);

  if (!data) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200 select-none ${
        isClosing ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
      }`}
      onClick={() => {
        setIsClosing(true);
        setTimeout(() => {
          setData(null);
          setIsClosing(false);
        }, 200);
      }}
    >
      {/* Dynamic Island Capsule Card */}
      <div
        className={`relative bg-black/95 text-white border-2 border-emerald-500/40 shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_35px_rgba(16,185,129,0.25)] rounded-3xl p-6 sm:p-7 max-w-sm w-full mx-auto flex flex-col items-center text-center transition-all duration-300 ease-out cursor-pointer ${
          isClosing ? 'scale-75 opacity-0' : 'animate-in zoom-in-75 duration-300'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Island Top Mini Bar */}
        <div className="w-10 h-1 bg-white/25 rounded-full mb-4" />

        {/* Glowing Emerald Checkmark Icon */}
        <div className="relative mb-3.5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-lg animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-inner">
            <CheckCircle2 className="w-9 h-9 animate-in zoom-in-50 duration-300" />
          </div>
        </div>

        {/* Title & Message */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Berhasil Disimpan</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
            {data.title}
          </h3>
          {data.message && (
            <p className="text-xs text-slate-300/90 leading-relaxed max-w-xs mt-1">
              {data.message}
            </p>
          )}
        </div>

        {/* Tap to close pill button */}
        <button
          type="button"
          onClick={() => {
            setIsClosing(true);
            setTimeout(() => {
              setData(null);
              setIsClosing(false);
            }, 200);
          }}
          className="mt-5 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
        >
          Tutup
        </button>

        {/* Bottom Auto-Dismiss Progress Line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-b-3xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all ease-linear"
            style={{
              width: isClosing ? '0%' : '100%',
              transitionDuration: `${data.durationMs || 3500}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
