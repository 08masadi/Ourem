import React from 'react';
import NeonVortexLoader from '@/components/ui/NeonVortexLoader';

export default function DashboardLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6">
      <NeonVortexLoader size="xl" label="Menyiapkan Workspace..." />
    </div>
  );
}
