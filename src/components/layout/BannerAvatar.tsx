'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface BannerAvatarProps {
  avatarUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
}

export default function BannerAvatar({
  avatarUrl,
  fullName,
  email,
  role,
  department,
}: BannerAvatarProps) {
  const [showLarge, setShowLarge] = useState(false);

  const displayDepartment =
    department === 'Staff OPS' || department === 'STAFF OPS'
      ? 'Staff Operasional'
      : department ||
        (role === 'director'
          ? 'Director'
          : role === 'finance'
          ? 'Finance'
          : 'Staff Operasional');

  return (
    <>
      {/* Tombol Foto Profil Bulat Murni tanpa Kotak & Teks */}
      <button
        type="button"
        onClick={() => setShowLarge(true)}
        className="shrink-0 rounded-full cursor-pointer focus:outline-none transition-transform duration-150 hover:scale-105 active:scale-95 select-none"
        title="Klik untuk melihat foto profil besar"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full border-[3px] border-white/95 shadow-2xl overflow-hidden bg-white/20 flex items-center justify-center shrink-0 ring-4 ring-white/30">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName || 'Foto Profil'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center text-white text-2xl sm:text-3xl lg:text-4xl font-black">
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
        </div>
      </button>

      {/* Modal Tampilan Foto Profil Ukuran Besar */}
      {showLarge && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowLarge(false)}
        >
          <div
            className="relative max-w-sm sm:max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLarge(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
              Foto Profil Akun
            </h3>

            <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-full border-4 border-orange-500 shadow-2xl shadow-orange-950/60 overflow-hidden bg-slate-950 flex items-center justify-center mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'Foto Profil'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white text-6xl font-black">
                  {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>

            <p className="text-base font-bold text-white">{fullName || 'Pengguna'}</p>
            {email && <p className="text-xs text-slate-400 mt-0.5">{email}</p>}
            <p className="text-xs font-semibold text-slate-400 mt-1">
              {displayDepartment}
            </p>

            <button
              type="button"
              onClick={() => setShowLarge(false)}
              className="mt-6 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
