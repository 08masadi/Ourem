'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle2,
  Camera,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Smartphone,
  Check,
  Sparkles,
  ChevronRight,
  Printer,
  QrCode,
  Building2,
  Lock,
  ArrowLeft,
} from 'lucide-react';

export default function ScrollCraftLandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeRoleTab, setActiveRoleTab] = useState<'employee' | 'director' | 'finance'>('employee');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    async function checkAuth() {
      try {
        const { getCurrentUserProfile } = await import('@/actions/auth');
        const profile = await getCurrentUserProfile();
        if (profile) {
          setUserRole(profile.role);
          setUserName(profile.full_name);
        }
      } catch {}
    }
    checkAuth();

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getDashboardHref = () => {
    if (userRole === 'director') return '/director';
    if (userRole === 'finance') return '/finance';
    return '/employee';
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden">
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-orange-500/15 via-amber-500/5 to-transparent rounded-full blur-[140px] opacity-70 transition-transform duration-700"
          style={{ transform: `translate(-50%, ${scrollY * 0.15}px)` }}
        />
        <div
          className="absolute top-[1200px] right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        />
      </div>

      {/* FIXED TOP NAVIGATION BAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080d1a]/85 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3 transition-all duration-300">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src="/ouffice-logo-white.png"
                alt="Ouffice"
                className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                Ourem Gen 2
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            {userRole ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-xs text-slate-400">
                  Halo, <strong className="text-white">{userName || 'Karyawan'}</strong>
                </span>
                <Link
                  href={getDashboardHref()}
                  className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-extrabold shadow-md shadow-orange-950/40 transition flex items-center gap-1.5 active:scale-95"
                >
                  <span>Buka Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-orange-950/40 transition flex items-center gap-1.5 active:scale-95"
                >
                  <span>Masuk Akun</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN SCROLL-CRAFT CONTENT */}
      <main className="relative z-10 pt-20">

        {/* =========================================================================
            ACT 1: DIMENSIONAL LAYERED HERO
            ========================================================================= */}
        <section className="relative min-h-[92vh] flex items-center justify-center px-4 py-16 sm:py-24 text-center">
          {/* Plane 1: Floating Chips (Depth cues) */}
          <div
            className="hidden md:flex absolute top-28 left-[10%] items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-2xl backdrop-blur-md pointer-events-none transition-transform duration-300"
            style={{ transform: `translateY(${scrollY * -0.1}px)` }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Voucher #084: Disetujui Direktur</span>
          </div>

          <div
            className="hidden md:flex absolute top-36 right-[10%] items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/80 border border-orange-500/30 text-orange-400 text-xs font-bold shadow-2xl backdrop-blur-md pointer-events-none transition-transform duration-300"
            style={{ transform: `translateY(${scrollY * -0.14}px)` }}
          >
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span>Lembur 4 Jam: Rp 120.000</span>
          </div>

          <div
            className="hidden sm:flex absolute bottom-24 right-[15%] items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-900/80 border border-blue-500/30 text-blue-400 text-xs font-bold shadow-2xl backdrop-blur-md pointer-events-none transition-transform duration-300"
            style={{ transform: `translateY(${scrollY * -0.08}px)` }}
          >
            <Check className="w-3.5 h-3.5 text-blue-400" />
            <span>Finance: Dana Dicairkan (Paid)</span>
          </div>

          {/* Plane 2: Subject & Content */}
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs sm:text-sm font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Sistem Operasional Resmi PT. Citra Sari Kencana</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-white">
              Reimbursement & Lembur.<br />
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Cepat, Tuntas & Paperless.
              </span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
              Foto nota di genggaman smartphone Android Anda, diverifikasi pimpinan dalam 3 detik, hingga pencairan kasir tanpa selembar kertas yang hilang.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <Link
                href={userRole ? getDashboardHref() : '/login'}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-orange-950/50 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{userRole ? 'Lanjutkan ke Workspace' : 'Mulai Sekarang'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#alur-kerja"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-sm font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Pelajari Alur Kerja</span>
              </a>
            </div>

            {/* Android Notice Pill */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Smartphone className="w-4 h-4 text-orange-400" />
              <span>Dioptimalkan untuk Android & Desktop &bull; Keypad Angka Otomatis &bull; 2-Kolom Ringkas</span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            ACT 2: TENSION (The Friction of Paper Bureaucracy)
            ========================================================================= */}
        <section id="alur-kerja" className="py-20 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black tracking-widest uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
              Tantangan Operasional
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
              Mengapa Cara Lama Menghambat Lapangan?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Birokrasi manual kertas memperlambat klaim operasional dan rentan kesalahan perhitungan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-rose-500/30 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-lg">
                ✕
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">Struk Fisik Cepat Pudar</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Struk bensin SPBU dan karcis tol dengan kertas termal pudar dalam 14 hari. Saat nota hilang, klaim karyawan tertolak.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-rose-500/30 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-lg">
                ✕
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">Lembur Manual & Selisih Jam</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Pencatatan lembur di kertas terpisah memicu salah hitung tarif hari kerja vs hari libur dan perdebatan audit.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-rose-500/30 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-lg">
                ✕
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">Antrean Tanda Tangan Basah</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Harus menunggu direktur kembali ke kantor hanya untuk tanda tangan dokumen cetak yang menumpuk di meja.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            ACT 3: TURN (The Paperless Architecture)
            ========================================================================= */}
        <section className="py-20 px-4 sm:px-6 bg-slate-950/40 border-y border-slate-800/80">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-black tracking-widest uppercase text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                Solusi Ourem Gen 2
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
                Alur Digital Cepat Dalam 3 Langkah
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Step 1 */}
              <div className="relative p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-orange-500/40 transition-all space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-700">01</span>
                </div>
                <h3 className="text-lg font-extrabold text-white">1. Potret & Input di HP</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Staf memotret nota langsung dengan kamera HP. Cropper interaktif internal merapikan sudut bukti bayar. Kolom nominal otomatis membuka keypad angka.
                </p>
                <div className="pt-2 text-xs font-bold text-orange-400 flex items-center gap-1">
                  <span>Khusus Staf Lapangan</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-blue-500/40 transition-all space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-700">02</span>
                </div>
                <h3 className="text-lg font-extrabold text-white">2. Verifikasi 1-Sentuhan</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Direktur memeriksa nota lampiran, menetapkan uang kompensasi lembur, dan menyetujui pengajuan secara instan dengan tanda tangan digital tersertifikasi.
                </p>
                <div className="pt-2 text-xs font-bold text-blue-400 flex items-center gap-1">
                  <span>Persetujuan Direktur</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-slate-700">03</span>
                </div>
                <h3 className="text-lg font-extrabold text-white">3. Pencairan & Dokumen PDF</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Finance mengecek rekening bank tujuan yang telah terkunci, mentransfer dana, menandai status PAID, dan mengunduh voucher resmi PDF & Word.
                </p>
                <div className="pt-2 text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <span>Pencairan Finance</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            ACT 4: THE SIGNATURE MOVE (Live Voucher Metamorphosis Simulation)
            ========================================================================= */}
        <section className="py-24 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black tracking-widest uppercase text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
              Signature Move &bull; Transformasi Dokumen
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
              Dari Foto Kamera Menjadi Voucher Resmi Ber-QR
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Setiap bukti nota langsung dikompilasi ke format voucher standar PT Citra Sari Kencana dengan QR verifikasi anti-pemalsuan.
            </p>
          </div>

          {/* Interactive Morphing Card Simulation */}
          <div className="relative max-w-2xl mx-auto p-4 sm:p-6 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl">
            {/* Morphing Voucher Canvas */}
            <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-7 shadow-lg space-y-4">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                <div>
                  <h4 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                    PT. CITRA SARI KENCANA
                  </h4>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Voucher Reimbursement Resmi &bull; Petty Cash
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                  PAID & APPROVED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500">No. Voucher:</span>{' '}
                  <strong className="font-mono text-slate-900">CSK-VCH/2026/XI/084</strong>
                </div>
                <div>
                  <span className="text-slate-500">Tanggal:</span>{' '}
                  <strong className="text-slate-900">24 November 2026</strong>
                </div>
                <div>
                  <span className="text-slate-500">Pemohon:</span>{' '}
                  <strong className="text-slate-900">Miskadi (Staff OPS)</strong>
                </div>
                <div>
                  <span className="text-slate-500">Bank:</span>{' '}
                  <strong className="text-slate-900">BCA (2760125710)</strong>
                </div>
              </div>

              <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                    <tr>
                      <th className="p-2 sm:p-2.5">Akun Beban</th>
                      <th className="p-2 sm:p-2.5">Keterangan</th>
                      <th className="p-2 sm:p-2.5 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 font-bold text-orange-600">Bensin (BBM)</td>
                      <td className="p-2 text-slate-700">Operasional Dinas KPU RI</td>
                      <td className="p-2 text-right font-mono font-bold">Rp 150.000</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-orange-600">Tol & Parkir</td>
                      <td className="p-2 text-slate-700">Tol Jagorawi & Parkir Gedung</td>
                      <td className="p-2 text-right font-mono font-bold">Rp 45.000</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Dana Dicairkan:</span>
                <span className="text-lg sm:text-xl font-black text-orange-600 font-mono">
                  Rp 195.000
                </span>
              </div>

              {/* Verified Digital Signature Stamps */}
              <div className="pt-3 border-t border-dashed border-slate-300 flex items-end justify-between">
                <div className="text-center space-y-0.5">
                  <span className="inline-block px-2 py-0.5 rounded border border-emerald-600 text-emerald-700 font-bold text-[9px] -rotate-3">
                    ✓ VERIFIED OPS
                  </span>
                  <div className="text-[11px] font-bold text-slate-800">Miskadi</div>
                  <div className="text-[9px] text-slate-500">Staf Pemohon</div>
                </div>

                <div className="text-center">
                  <div className="w-11 h-11 bg-slate-950 text-white rounded-lg flex flex-col items-center justify-center p-1 mx-auto shadow-sm">
                    <QrCode className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono">DOC-ID: #8492</span>
                </div>

                <div className="text-center space-y-0.5">
                  <span className="inline-block px-2 py-0.5 rounded border border-blue-600 text-blue-700 font-bold text-[9px] rotate-2">
                    ✓ APPROVED DIR
                  </span>
                  <div className="text-[11px] font-bold text-slate-800">Direktur Utama</div>
                  <div className="text-[9px] text-slate-500">Persetujuan Resmi</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            ACT 5: RANGE (Tiga Workspace Khusus untuk Semua Akun)
            ========================================================================= */}
        <section className="py-20 px-4 sm:px-6 bg-slate-950/50 border-t border-slate-800/80">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-black tracking-widest uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                Multi-Peran Terpadu
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
                Tiga Workspace Sesuai Tugas Anda
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Pilih peran di bawah ini untuk melihat fitur yang tersedia di akun Anda.
              </p>
            </div>

            {/* Role Switcher Tabs */}
            <div className="flex justify-center gap-2 mb-8 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setActiveRoleTab('employee')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  activeRoleTab === 'employee'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Employee (Staff)
              </button>
              <button
                type="button"
                onClick={() => setActiveRoleTab('director')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  activeRoleTab === 'director'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Director
              </button>
              <button
                type="button"
                onClick={() => setActiveRoleTab('finance')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  activeRoleTab === 'finance'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Finance
              </button>
            </div>

            {/* Active Tab Showcase Box */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-3xl mx-auto">
              {activeRoleTab === 'employee' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                    <h3 className="text-lg sm:text-xl font-bold text-white">Workspace Staf Operasional & Lapangan</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Dirancang dengan tata letak 2-kolom ringkas khusus layar smartphone Android, mempercepat penginputan tanpa banyak menggulir layar.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Keypad Angka Otomatis</div>
                        <div className="text-[11px] text-slate-400">Keyboard Android otomatis berubah menjadi tampilan angka saat mengetik nominal.</div>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Kalkulator Lembur Cerdas</div>
                        <div className="text-[11px] text-slate-400">Pengisian durasi jam lembur hari kerja vs libur dengan placeholder informatif.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeRoleTab === 'director' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <h3 className="text-lg sm:text-xl font-bold text-white">Workspace Direktur & Penyetuju</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Menghadirkan visibilitas menyeluruh atas arus kas operasional dengan kontrol approval 1-sentuhan dari mana saja.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Persetujuan Cepat & Audit Trail</div>
                        <div className="text-[11px] text-slate-400">Setujui atau tolak pengajuan lengkap dengan catatan dan tanda tangan digital.</div>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Penetapan Uang Lembur Resmi</div>
                        <div className="text-[11px] text-slate-400">Direktur menentukan nominal kompensasi lembur sebelum pencairan dana oleh finance.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeRoleTab === 'finance' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <h3 className="text-lg sm:text-xl font-bold text-white">Workspace Finance & Pencairan Kas</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Memastikan setiap pengeluaran perusahaan tervalidasi dengan rekening bank yang sah dan pelaporan voucher siap cetak.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Rekening Bank Terkunci</div>
                        <div className="text-[11px] text-slate-400">Nomor rekening buku tabungan staf langsung terpampang jelas untuk transfer akurat.</div>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Ekspor PDF & Word Resmi</div>
                        <div className="text-[11px] text-slate-400">Cetak voucher resmi satu halaman siap arsip pembukuan akuntansi.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================================
            ACT 6: COMMITMENT (Direct Access For All Accounts & Mobile)
            ========================================================================= */}
        <section className="py-24 px-4 text-center">
          <div className="max-w-xl mx-auto space-y-6">
            <span className="text-xs font-black tracking-widest uppercase text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
              Mulai Langkah Paperless Anda
            </span>

            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Satu Platform.<br />Tiga Peran. Nol Kertas.
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Telah digunakan oleh segenap tim operasional, direksi, dan keuangan PT Citra Sari Kencana.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={userRole ? getDashboardHref() : '/login'}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-base shadow-xl shadow-orange-950/50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{userRole ? 'Masuk ke Dashboard Saya' : 'Login ke Aplikasi'}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              {userRole && (
                <Link
                  href="/profile"
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-sm font-bold transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Profil</span>
                </Link>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 py-8 px-4 text-center text-xs text-slate-500">
        <p>&copy; 2026 PT Citra Sari Kencana &bull; Ourem Gen 2 Operational Platform. Didukung oleh Ouffice.co.id.</p>
      </footer>
    </div>
  );
}
