import { getCurrentUserProfile } from '@/actions/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import NotificationBell from '@/components/layout/NotificationBell';
import { LogoutButton } from '@/components/layout/LogoutButton';
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar role={role} userName={userName} userEmail={userEmail} avatarUrl={avatarUrl} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar with Notification Bell */}
        <header className="hidden md:flex items-center justify-between px-6 lg:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Ouffice Reimbursement &bull;{' '}
              <span className="text-slate-900 dark:text-white capitalize font-bold">
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
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800/60 transition group shadow-sm"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-white truncate max-w-[140px]">
                {userName}
              </span>
            </Link>

            {/* Tombol Keluar Akun di Pojok Kanan Atas */}
            <LogoutButton variant="desktop" />
          </div>
        </header>

        {/* Mobile / Android Header with Transparent 2x Logo & Notification Bell */}
        <header className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-2.5 shadow-sm flex justify-between items-center sticky top-0 z-40">
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
            <LogoutButton variant="mobile" />
          </div>
        </header>

        {/* Page Content: Centered responsive desktop container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 max-w-7xl w-full mx-auto">
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
