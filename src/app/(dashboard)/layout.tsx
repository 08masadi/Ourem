import { getCurrentUserProfile, signOutAction } from '@/actions/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import NotificationBell from '@/components/layout/NotificationBell';
import DynamicIslandSuccess from '@/components/ui/DynamicIslandSuccess';
import SuccessUrlWatcher from '@/components/ui/SuccessUrlWatcher';
import PushNotificationSubscriber from '@/components/notifications/PushNotificationSubscriber';
import { LogOut } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  const role = profile.role || 'employee';
  const userName = profile.full_name || 'Pengguna Ourem';
  const userEmail = profile.email || '';
  const avatarUrl = profile.avatar_url || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar role={role} userName={userName} userEmail={userEmail} avatarUrl={avatarUrl} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar with Notification Bell */}
        <header className="hidden md:flex items-center justify-between px-6 lg:px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">
              Ouffice Reimbursement &bull;{' '}
              <span className="text-white capitalize font-bold">
                {role === 'director' ? 'Director Workspace' : role === 'finance' ? 'Finance Workspace' : 'Employee Workspace'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell on Desktop */}
            <NotificationBell role={role} />

            {/* Profile Pill */}
            <Link
              href="/profile"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition group"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate max-w-[140px]">
                {userName}
              </span>
            </Link>

            {/* Tombol Keluar Akun di Pojok Kanan Atas */}
            <form action={signOutAction}>
              <button
                type="submit"
                title="Keluar Akun"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </form>
          </div>
        </header>

        {/* Mobile / Android Header with Transparent 2x Logo & Notification Bell */}
        <header className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white px-4 py-2.5 shadow-md flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <img
              src="/ouffice-logo-white.png"
              alt="Ouffice.co.id"
              className="logo-dark h-8 sm:h-9 w-auto object-contain"
            />
            <img
              src="/ouffice-logo.png"
              alt="Ouffice.co.id"
              className="logo-light h-8 sm:h-9 w-auto object-contain"
            />
            <span className="text-[11px] font-bold text-slate-400 border-l border-slate-700 pl-2.5">
              Ourem Gen 2
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell on Mobile */}
            <NotificationBell role={role} />

            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 capitalize">
              {role}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Keluar"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-rose-400 flex items-center justify-center transition border border-slate-700/60 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </header>

        {/* Page Content: Full screen on desktop */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 w-full">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav role={role} />

        {/* Global Dynamic Island Success Alert & URL Watcher */}
        <DynamicIslandSuccess />
        <SuccessUrlWatcher />
        <PushNotificationSubscriber />
      </div>
    </div>
  );
}
