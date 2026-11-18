'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/database';
import {
  FileText,
  PlusCircle,
  Clock,
  CheckSquare,
  CreditCard,
  User,
} from 'lucide-react';

interface SidebarProps {
  role: UserRole;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const employeeLinks = [
    { href: '/employee', label: 'Daftar Pengajuan', icon: FileText },
    { href: '/employee/new', label: 'Buat Pengajuan', icon: PlusCircle },
    { href: '/employee/overtime', label: 'Form Lembur', icon: Clock },
    { href: '/profile', label: 'Profil & Rekening', icon: User },
  ];

  const directorLinks = [
    { href: '/director', label: 'Approval Pengajuan', icon: CheckSquare },
    { href: '/profile', label: 'Profil Saya', icon: User },
  ];

  const financeLinks = [
    { href: '/finance', label: 'Pencairan Dana (Paid)', icon: CreditCard },
    { href: '/profile', label: 'Profil Saya', icon: User },
  ];

  const links =
    role === 'director' ? directorLinks : role === 'finance' ? financeLinks : employeeLinks;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-white h-screen sticky top-0 p-4 shrink-0 overflow-y-auto z-40">
      <div>
        {/* Brand Logo - Official Ouffice.co.id Transparent (2x Size) */}
        <div className="px-1 py-4 mb-6 border-b border-slate-800 flex items-center justify-center">
          <img
            src="/ouffice-logo-white.png"
            alt="Ouffice.co.id"
            className="logo-dark h-16 md:h-20 w-auto max-w-full object-contain transition-transform hover:scale-105"
          />
          <img
            src="/ouffice-logo.png"
            alt="Ouffice.co.id"
            className="logo-light h-16 md:h-20 w-auto max-w-full object-contain transition-transform hover:scale-105"
          />
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
