import React from 'react';
import NeonVortexLoader from '@/components/ui/NeonVortexLoader';

export default function DashboardLoading() {
  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
      <NeonVortexLoader size="md" label="Menyiapkan Workspace..." />
    </div>
  );
}
