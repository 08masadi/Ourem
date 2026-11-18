'use client';

import { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const verifyRecoverySession = async () => {
      // 1. Cek sesi aktif yang sudah ditukar melalui /auth/callback
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && isMounted) {
        setHasValidSession(true);
        setIsCheckingSession(false);
        return;
      }

      // 2. Cek token di URL hash jika flow implicit (#access_token=...)
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            if (!isMounted) return;
            if (event === 'PASSWORD_RECOVERY' || newSession) {
              setHasValidSession(true);
              setIsCheckingSession(false);
            }
          }
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      }

      // 3. Fallback: beri toleransi 1 detik untuk inisialisasi cookie
      setTimeout(async () => {
        if (!isMounted) return;
        const {
          data: { session: retrySession },
        } = await supabase.auth.getSession();

        if (retrySession) {
          setHasValidSession(true);
        } else {
          setHasValidSession(false);
        }
        setIsCheckingSession(false);
      }, 1000);
    };

    verifyRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: updateErr } = await supabase.auth.updateUser({
          password,
        });

        if (updateErr) {
          setError(updateErr.message || 'Gagal memperbarui kata sandi.');
          return;
        }

        setSuccess('Kata sandi Anda berhasil diperbarui! Mengalihkan ke halaman masuk...');

        // Logout sesi recovery agar user login bersih dengan password barunya
        await supabase.auth.signOut();

        setTimeout(() => {
          router.push('/login?reset=success');
        }, 1800);
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan sistem.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/ouffice-logo-white.png"
              alt="Ouffice.co.id"
              className="logo-dark h-14 sm:h-16 w-auto object-contain"
            />
            <img
              src="/ouffice-logo.png"
              alt="Ouffice.co.id"
              className="logo-light h-14 sm:h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Atur Ulang Kata Sandi
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Buat kata sandi baru untuk akun Ouffice Anda
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {isCheckingSession ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">
                Memverifikasi sesi pemulihan kata sandi...
              </p>
            </div>
          ) : !hasValidSession && !success ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Sesi Pemulihan Tidak Ditemukan
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Tautan reset kata sandi mungkin tidak valid, sudah pernah digunakan, atau telah kedaluwarsa. Silakan minta tautan baru dari halaman login.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Halaman Masuk</span>
              </Link>
            </div>
          ) : (
            <div>
              {/* Icon & Title */}
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  Kata Sandi Baru
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Masukkan minimal 6 karakter kombinasi yang aman.
                </p>
              </div>

              {/* Feedback Alert */}
              {error && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span className="font-semibold leading-relaxed">{success}</span>
                </div>
              )}

              {!success && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Kata Sandi Baru */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Kata Sandi Baru
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Konfirmasi Kata Sandi Baru */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Ulangi Kata Sandi Baru
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold rounded-xl shadow-lg shadow-orange-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Kata Sandi...</span>
                      </>
                    ) : (
                      <>
                        <span>Simpan Kata Sandi Baru</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Back to Login Link */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                <Link
                  href="/login"
                  className="text-xs text-slate-400 hover:text-orange-400 font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Halaman Masuk</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
