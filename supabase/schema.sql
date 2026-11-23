-- ==========================================================
-- SKEMA DATABASE SUPABASE UNTUK OUREM GEN 2 (OUFFICE REIMBURSE)
-- Jalankan script ini di menu "SQL Editor" pada Supabase Console
-- ==========================================================

-- 1. TABEL PROFILES (PENGGUNA & ROLE)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'director', 'finance')) DEFAULT 'employee',
    department TEXT DEFAULT 'Staff OPS',
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_holder TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrasi tambahan kolom jika tabel sudah ada sebelumnya:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Staff OPS';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- 2. TABEL REIMBURSEMENT_REQUESTS (PENGAJUAN BIAYA)
CREATE TABLE IF NOT EXISTS public.reimbursement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    reimbursement_type TEXT NOT NULL CHECK (reimbursement_type IN ('Petty Cash', 'Voucher')) DEFAULT 'Petty Cash',
    account TEXT,
    customer TEXT,
    department TEXT DEFAULT 'Staff OPS',
    signature_url TEXT,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('Menunggu Approval', 'Disetujui', 'Ditolak')) DEFAULT 'Menunggu Approval',
    rejection_reason TEXT,
    director_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    director_action_at TIMESTAMPTZ,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('Unpaid', 'Paid')) DEFAULT 'Unpaid',
    payment_note TEXT,
    finance_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payment_action_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrasi tambahan kolom untuk reimbursement_requests jika tabel sudah ada:
ALTER TABLE public.reimbursement_requests ADD COLUMN IF NOT EXISTS reimbursement_type TEXT DEFAULT 'Petty Cash';
ALTER TABLE public.reimbursement_requests ADD COLUMN IF NOT EXISTS account TEXT;
ALTER TABLE public.reimbursement_requests ADD COLUMN IF NOT EXISTS customer TEXT;
ALTER TABLE public.reimbursement_requests ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Staff OPS';
ALTER TABLE public.reimbursement_requests ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Lepas batasan check constraint agar fleksibel menerima tipe 'Lembur' dan nominal awal 0:
ALTER TABLE public.reimbursement_requests DROP CONSTRAINT IF EXISTS reimbursement_requests_amount_check;
ALTER TABLE public.reimbursement_requests ADD CONSTRAINT reimbursement_requests_amount_check CHECK (amount >= 0);

ALTER TABLE public.reimbursement_requests DROP CONSTRAINT IF EXISTS reimbursement_requests_reimbursement_type_check;

-- Lepas batasan check constraint lama pada category agar fleksibel menerima sub-account baru
ALTER TABLE public.reimbursement_requests DROP CONSTRAINT IF EXISTS reimbursement_requests_category_check;

-- Pastikan Foreign Key memiliki ON DELETE CASCADE / SET NULL agar penghapusan user di Supabase Auth berjalan lancar tanpa error:
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reimbursement_requests 
  DROP CONSTRAINT IF EXISTS reimbursement_requests_user_id_fkey,
  ADD CONSTRAINT reimbursement_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reimbursement_requests 
  DROP CONSTRAINT IF EXISTS reimbursement_requests_director_id_fkey,
  ADD CONSTRAINT reimbursement_requests_director_id_fkey FOREIGN KEY (director_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.reimbursement_requests 
  DROP CONSTRAINT IF EXISTS reimbursement_requests_finance_id_fkey,
  ADD CONSTRAINT reimbursement_requests_finance_id_fkey FOREIGN KEY (finance_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index performa query
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.reimbursement_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.reimbursement_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_payment_status ON public.reimbursement_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON public.reimbursement_requests(reimbursement_type);

-- 3. PERBAIKAN TRIGGER OTOMATIS SAAT USER BARU DAFTAR (AUTH.USERS -> PROFILES)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'Staff OPS')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department = COALESCE(EXCLUDED.department, public.profiles.department);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ROW LEVEL SECURITY (RLS) & POLICIES (HARDENED)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Security Fix (VULN-02): Cegah eskalasi role oleh user sendiri
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

DROP POLICY IF EXISTS "Allow read requests" ON public.reimbursement_requests;
CREATE POLICY "Allow read requests" ON public.reimbursement_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'finance')
    )
  );

DROP POLICY IF EXISTS "Allow insert requests" ON public.reimbursement_requests;
CREATE POLICY "Allow insert requests" ON public.reimbursement_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Security Fix (VULN-01 & VULN-05): Karyawan hanya boleh update pengajuannya saat belum disetujui/dibayar
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

-- Security Fix (VULN-04): Hanya pemilik pengajuan yang belum disetujui atau Direktur/Finance yang boleh menghapus
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

-- 5. BUCKET STORAGE UNTUK BUKTI NOTA / KWITANSI
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated upload receipts" ON storage.objects;
CREATE POLICY "Allow authenticated upload receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow public read receipts" ON storage.objects;
CREATE POLICY "Allow public read receipts" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'receipts');

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
