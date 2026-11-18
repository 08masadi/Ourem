'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { triggerSuccessNotification } from './DynamicIslandSuccess';

function SuccessUrlWatcherContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const successType = searchParams.get('success');
    if (!successType) return;

    if (successType === 'created_reimbursement') {
      triggerSuccessNotification(
        'Pengajuan Biaya Berhasil Dikirim',
        'Klaim kas kecil / voucher operasional Anda telah berhasil diajukan dan diteruskan ke Direktur.'
      );
    } else if (successType === 'created_overtime') {
      triggerSuccessNotification(
        'Pengajuan Lembur Berhasil Dikirim',
        'Formulir kerja lembur resmi PT. Citra Sari Kencana telah berhasil dibuat dan diteruskan ke Direktur.'
      );
    } else if (successType === 'profile_saved') {
      triggerSuccessNotification(
        'Perubahan Berhasil Disimpan',
        'Informasi rekening bank dan profil Anda telah diperbarui.'
      );
    }

    // Bersihkan query param dari URL tanpa reload halaman
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }, [searchParams]);

  return null;
}

export default function SuccessUrlWatcher() {
  return (
    <Suspense fallback={null}>
      <SuccessUrlWatcherContent />
    </Suspense>
  );
}
