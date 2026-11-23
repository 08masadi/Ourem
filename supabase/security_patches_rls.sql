-- ==========================================================
-- SKRIP PERBAIKAN KEAMANAN ROW LEVEL SECURITY (RLS)
-- Jalankan skrip ini di menu "SQL Editor" pada Supabase Console
-- ==========================================================

-- 1. PERBAIKAN RLS PROFILES (Cegah Eskalasi Role Sendiri - VULN-02)
DROP POLICY IF EXISTS "Allow users update own profile" ON public.profiles;
CREATE POLICY "Allow users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Allow insert profile" ON public.profiles;
CREATE POLICY "Allow insert profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2. PERBAIKAN RLS UPDATE REIMBURSEMENT (VULN-01 & VULN-05)
-- Karyawan hanya boleh mengedit pengajuannya saat status 'Menunggu Approval' & 'Unpaid'
-- Direktur dan Finance tetap berwenang menyetujui dan memproses pembayaran
DROP POLICY IF EXISTS "Allow update requests" ON public.reimbursement_requests;
CREATE POLICY "Allow update requests" ON public.reimbursement_requests
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'Menunggu Approval' AND payment_status = 'Unpaid') OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'finance')
    )
  );

-- 3. PERBAIKAN RLS DELETE REIMBURSEMENT (VULN-04)
-- Cabut USING (true)! Karyawan hanya bisa menghapus pengajuannya sendiri saat belum disetujui.
DROP POLICY IF EXISTS "Allow delete requests" ON public.reimbursement_requests;
CREATE POLICY "Allow delete requests" ON public.reimbursement_requests
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'Menunggu Approval' AND payment_status = 'Unpaid') OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'finance')
    )
  );
