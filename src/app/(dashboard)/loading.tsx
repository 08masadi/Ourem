import React from 'react';
import ModernLoader from '@/components/ui/ModernLoader';

export default function DashboardLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6">
      <ModernLoader label="Menyiapkan Workspace..." sublabel="Sinkronisasi data Ourem" />
    </div>
  );
}
