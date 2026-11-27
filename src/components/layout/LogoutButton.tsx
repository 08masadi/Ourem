'use client';

import React, { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { signOutAction } from '@/actions/auth';

interface LogoutButtonProps {
  variant?: 'desktop' | 'mobile' | 'profile';
  className?: string;
}

export function LogoutButton({ variant = 'desktop', className }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoggingOut) return;

    // Respon instan: langsung set status loading agar tombol bereaksi seketika
    setIsLoggingOut(true);

    try {
      // Bersihkan data lokal sesi (kecuali cache notifikasi agar status read tidak hilang)
      if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('ourem_') && !key.includes('notifications')) {
              localStorage.removeItem(key);
            }
          });
          sessionStorage.clear();
        } catch {}
      }

      // Pasang fallback pengalihan darurat jika network lambat
      const fallbackTimer = setTimeout(() => {
        window.location.href = '/login';
      }, 1200);

      await signOutAction();
      clearTimeout(fallbackTimer);
    } catch {
      // Jika terjadi error atau redirect dari server, pastikan diarahkan ke /login
      window.location.href = '/login';
    }
  };

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        title="Keluar"
        className={
          className ||
          'w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-rose-400 flex items-center justify-center transition border border-slate-700/60 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed'
        }
      >
        {isLoggingOut ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
        ) : (
          <LogOut className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  if (variant === 'profile') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={
          className ||
          'w-full py-2.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed'
        }
      >
        {isLoggingOut ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
            <span>Sedang Keluar...</span>
          </>
        ) : (
          <>
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun</span>
          </>
        )}
      </button>
    );
  }

  // Desktop default
  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      title="Keluar Akun"
      className={
        className ||
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 text-xs font-semibold transition cursor-pointer shadow-sm disabled:opacity-70 disabled:cursor-not-allowed'
      }
    >
      {isLoggingOut ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Keluar...</span>
        </>
      ) : (
        <>
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </>
      )}
    </button>
  );
}
