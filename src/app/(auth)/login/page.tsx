'use client';

import { useState, useTransition, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, signUp, requestPasswordReset } from '@/actions/auth';
import { authClient } from '@/lib/auth-client';
import { UserRole, DEPARTMENT_OPTIONS } from '@/types/database';
import NeonVortexLoader from '@/components/ui/NeonVortexLoader';
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Send,
  Eye,
  EyeOff,
  Briefcase,
} from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('employee');
  const [department, setDepartment] = useState('Staff Operasional');
  const [emailInput, setEmailInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'director') {
      setDepartment('Director');
    } else if (newRole === 'finance') {
      setDepartment('Finance');
    }
  };

  // Handle URL query parameters (e.g. ?reset=success or ?error=...)
  useEffect(() => {
    const resetParam = searchParams.get('reset');
    const errorParam = searchParams.get('error');

    if (resetParam === 'success') {
      setSuccess('Kata sandi Anda berhasil diperbarui! Silakan masuk menggunakan kata sandi baru.');
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const isSupabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('role', role);
    formData.set('department', department);

    startTransition(async () => {
      try {
        if (isForgotPassword) {
          formData.set('origin', typeof window !== 'undefined' ? window.location.origin : '');
          const res = await requestPasswordReset(null, formData);
          if (res?.error) {
            setError(res.error);
          } else if (res?.success) {
            setSuccess(res.success);
            setResetEmailSent(res.email || emailInput);
          }
        } else if (isRegister) {
          formData.set('origin', typeof window !== 'undefined' ? window.location.origin : '');
          const res = await signUp(null, formData);
          if (res?.error) {
            setError(res.error);
          } else if (res?.success) {
            setSuccess(res.success);
            setIsRegister(false);
          }
        } else {
          const rawEmail = formData.get('email') as string;
          const password = formData.get('password') as string;
          const email = (rawEmail || '').trim().toLowerCase();

          if (!email || !password) {
            setError('Email dan password wajib diisi.');
            return;
          }

          // 1. Coba login langsung via Better Auth client REST API (langsung simpan cookie di browser & kebal redeploy)
          try {
            const { data: authData, error: clientErr } = await authClient.signIn.email({
              email,
              password,
            });

            if (authData?.user) {
              const userRole = (authData.user as any).role || 'employee';
              const targetPath =
                userRole === 'director' ? '/director' : userRole === 'finance' ? '/finance' : '/employee';
              window.location.href = targetPath;
              return;
            }
          } catch {}

          // 2. Fallback ke Server Action (misal akun lama di Supabase)
          const res = await signIn(null, formData);
          if (res?.error) {
            setError(res.error);
          }
        }
      } catch (err: any) {
        if (
          err?.message?.includes('failed-to-find-server-action') ||
          err?.message?.includes('was not found on the server')
        ) {
          window.location.reload();
          return;
        }
        // Next.js redirect throws a digest error when redirecting from server actions, which is normal
        if (err?.message && !err.message.includes('NEXT_REDIRECT')) {
          setError(err.message || 'Terjadi kesalahan sistem.');
        }
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
          <h1 className="text-2xl font-black text-orange-500 dark:text-orange-400 tracking-tight">
            Sistem Reimbursement Enterprise
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
            {isForgotPassword
              ? 'Pemulihan Akun & Reset Kata Sandi'
              : isRegister
              ? 'Daftar akun baru untuk akses sistem'
              : 'Masuk ke portal operasional & reimbursement'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Tabs (Hanya ditampilkan saat bukan mode lupa password) */}
          {!isForgotPassword && (
            <div className="flex bg-slate-950/60 p-1.5 rounded-2xl mb-6 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setIsForgotPassword(false);
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  !isRegister
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setIsForgotPassword(false);
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  isRegister
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daftar Baru
              </button>
            </div>
          )}

          {/* Supabase connection warning banner if not configured */}
          {!isSupabaseConfigured && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold block">Supabase Belum Dihubungkan</span>
                <span className="text-[11px] text-amber-200/80">
                  Silakan isi URL & Key asli di file <code className="bg-black/40 px-1 py-0.5 rounded font-mono">.env.local</code>.
                </span>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="leading-relaxed">
                <span>{success}</span>
              </div>
            </div>
          )}

          {/* 1. FORM RESET PASSWORD (LUPA KATA SANDI) */}
          {isForgotPassword ? (
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Lupa Kata Sandi?</h2>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Masukkan alamat email yang terdaftar. Kami akan mengirimkan tautan reset kata sandi resmi melalui Supabase Authentication ke email Anda.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Alamat Email Terdaftar
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      name="email"
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold rounded-xl shadow-lg shadow-orange-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Tautan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Kirim Tautan Reset Password</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs text-slate-400 hover:text-orange-400 font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Halaman Masuk</span>
                </button>
              </div>
            </div>
          ) : (
            /* 2. FORM LOGIN & REGISTER */
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nama Lengkap
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        name="full_name"
                        type="text"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Peran / Role Akun
                    </label>
                    <div className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="font-bold text-orange-600 dark:text-orange-400">Employee (Staff)</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Role Direktur/Finance diset Admin</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                        <span>Departemen</span>
                      </span>
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <select
                        name="department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold cursor-pointer"
                      >
                        {DEPARTMENT_OPTIONS.map((dep) => (
                          <option key={dep} value={dep} className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">
                            {dep}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    name="email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kata Sandi (Password)
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-xs font-semibold text-orange-500 hover:text-orange-400 dark:text-orange-400 dark:hover:text-orange-300 transition cursor-pointer"
                    >
                      Lupa Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                    title={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold rounded-xl shadow-lg shadow-orange-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>{isRegister ? 'Buat Akun Sekarang' : 'Masuk ke Dashboard'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Full-screen Loading Overlay saat proses Login / Register / Lupa Password */}
      {isPending && (
        <NeonVortexLoader
          size="md"
          label={
            isForgotPassword
              ? 'Mengirim Tautan Pemulihan...'
              : isRegister
              ? 'Mendaftarkan Akun Baru...'
              : 'Memproses Masuk ke Akun...'
          }
          fullScreen
        />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
          <NeonVortexLoader
            size="md"
            label="Menyiapkan Halaman Login..."
          />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
