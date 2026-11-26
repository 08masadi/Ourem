'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  getUserNotifications,
  AppNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationAction,
  clearAllNotificationsAction,
} from '@/actions/requests';
import { UserRole } from '@/types/database';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  ChevronRight,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

interface NotificationBellProps {
  role: UserRole;
}

export default function NotificationBell({ role }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load cached read & deleted notifications from localStorage on mount
  useEffect(() => {
    try {
      const storedRead = localStorage.getItem('ourem_read_notifications');
      if (storedRead) {
        setReadIds(JSON.parse(storedRead));
      }
    } catch {}
  }, []);

  // Fetch notifications for the user from server
  const loadNotifications = async () => {
    try {
      const data = await getUserNotifications(role);
      if (Array.isArray(data)) {
        // Gabungkan status read dari server (user_metadata)
        const serverReadIds = data.filter((n) => n.isRead).map((n) => n.id);
        setReadIds((prev) => {
          const merged = Array.from(new Set([...prev, ...serverReadIds]));
          try {
            localStorage.setItem('ourem_read_notifications', JSON.stringify(merged));
          } catch {}
          return merged;
        });
        setNotifications(data);
      }
    } catch {}
  };

  useEffect(() => {
    loadNotifications();

    // Poll setiap 30 detik (hemat baterai & kuota ponsel, tidak membebani server)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadNotifications();
      }
    }, 30000);

    const handleFocus = () => loadNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [role]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Tandai 1 notifikasi sebagai sudah dibaca (disimpan di LocalStorage & Server User Metadata)
  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem('ourem_read_notifications', JSON.stringify(updated));
      } catch {}
      markNotificationAsRead(id).catch(() => {});
    }
  };

  // Tandai semua notifikasi sebagai sudah dibaca
  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const merged = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(merged);
    try {
      localStorage.setItem('ourem_read_notifications', JSON.stringify(merged));
    } catch {}
    markAllNotificationsAsRead(allIds).catch(() => {});
  };

  // Hapus 1 notifikasi (Permanen di akun user)
  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationAction(id).catch(() => {});
  };

  // Hapus semua notifikasi (Permanen di akun user)
  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const allIds = notifications.map((n) => n.id);
    setNotifications([]);
    clearAllNotificationsAction(allIds).catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;
  const displayedNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !readIds.includes(n.id))
      : notifications;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'info':
      default:
        return <Clock className="w-4 h-4 text-orange-400" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      return `${diffDays} hari lalu`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        aria-label="Lonceng Notifikasi"
        className={`relative p-2 rounded-xl transition duration-150 flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/40 shadow-lg shadow-orange-950/30'
            : 'bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 shadow-sm'
        }`}
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

        {/* Unread Badge Indicator */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-md shadow-rose-950/50">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>
            <span className="relative">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Notifikasi</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {unreadCount} baru
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400">Pemberitahuan klaim & update sistem</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Tandai semua notifikasi sudah dibaca"
                  className="text-[10px] text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 hover:underline transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Dibaca</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="Hapus semua notifikasi"
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab Filter */}
          <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-900 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                activeTab === 'unread'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
            {displayedNotifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">Tidak ada notifikasi</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {activeTab === 'unread'
                    ? 'Semua notifikasi telah Anda baca.'
                    : 'Belum ada notifikasi atau aktivitas baru saat ini.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isRead = readIds.includes(notif.id);
                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 flex items-start gap-3 transition group relative ${
                      isRead
                        ? 'bg-slate-900/40 hover:bg-slate-800/50 opacity-80 hover:opacity-100'
                        : 'bg-orange-950/15 hover:bg-orange-950/25'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                        isRead
                          ? 'bg-slate-800/80 border-slate-700/80'
                          : 'bg-orange-500/10 border-orange-500/30'
                      }`}
                    >
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <Link
                          href={notif.link}
                          onClick={() => {
                            markAsRead(notif.id);
                            setIsOpen(false);
                            if (notif.requestId) {
                              window.dispatchEvent(
                                new CustomEvent('open-request-detail', {
                                  detail: { requestId: notif.requestId },
                                })
                              );
                            }
                          }}
                          className={`text-xs font-bold truncate hover:underline ${
                            isRead ? 'text-slate-300' : 'text-white'
                          }`}
                        >
                          {notif.title}
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                          )}
                          <button
                            type="button"
                            title="Hapus notifikasi ini"
                            onClick={(e) => handleDeleteNotification(notif.id, e)}
                            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <Link
                        href={notif.link}
                        onClick={() => {
                          markAsRead(notif.id);
                          setIsOpen(false);
                          if (notif.requestId) {
                            window.dispatchEvent(
                              new CustomEvent('open-request-detail', {
                                detail: { requestId: notif.requestId },
                              })
                            );
                          }
                        }}
                        className="block"
                      >
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40">
                          <span className="text-[10px] text-slate-500">
                            {formatTimeAgo(notif.date || notif.createdAt)}
                          </span>
                          <span className="text-[10px] text-orange-400/80 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
                            <span>Buka</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950/80 border-t border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-500">
              Ourem Notification Center &bull; Notifikasi Tersimpan Permanen
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
