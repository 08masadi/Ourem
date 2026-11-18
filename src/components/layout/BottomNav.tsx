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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 px-4 py-2">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
                isActive ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px]">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
