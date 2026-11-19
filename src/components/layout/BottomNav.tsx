'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/database';
import { FileText, PlusCircle, Clock, CheckSquare, CreditCard, User } from 'lucide-react';

interface BottomNavProps {
  role: UserRole;
}

export default function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();

  const employeeLinks = [
    { href: '/employee', label: 'Pengajuan', icon: FileText },
    { href: '/employee/new', label: 'Ajukan', icon: PlusCircle },
    { href: '/employee/overtime', label: 'Lembur', icon: Clock },
    { href: '/profile', label: 'Profil', icon: User },
  ];

  const directorLinks = [
    { href: '/director', label: 'Approval', icon: CheckSquare },
    { href: '/profile', label: 'Profil', icon: User },
  ];

  const financeLinks = [
    { href: '/finance', label: 'Pencairan', icon: CreditCard },
    { href: '/profile', label: 'Profil', icon: User },
  ];

  const links =
    role === 'director' ? directorLinks : role === 'finance' ? financeLinks : employeeLinks;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40 px-4 py-2">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-2xl select-none transition-all duration-150 ease-out active:scale-75 active:opacity-70 active:bg-orange-500/10 cursor-pointer ${
                isActive ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 bg-orange-500/15 rounded-2xl border border-orange-500/25 animate-in fade-in zoom-in-95 duration-150 pointer-events-none"></span>
              )}
              <Icon
                className={`w-5 h-5 relative z-10 transition-transform duration-150 ${
                  isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : ''
                }`}
              />
              <span className="text-[10px] relative z-10">{link.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-0.5 animate-pulse"></span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
