-- Migration: Student Fee Management, Self-Payment Submission & Admin Approval
-- Supports: Fee due popups, bank account instructions, slip uploads, atomic approvals, receipts

-- 1. fee_settings table
CREATE TABLE IF NOT EXISTS public.fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL DEFAULT 'Bank of Maldives (BML)',
  account_name TEXT NOT NULL DEFAULT 'Ababeel Quran Class',
  account_number TEXT NOT NULL DEFAULT '7701123456789',
  secondary_account TEXT DEFAULT '7701987654321 (MVR Savings)',
  payment_instructions TEXT DEFAULT 'Please include Student Number and Fee Month in transfer remarks. Upload clear screenshot/PDF of transfer slip.',
  viber_contact TEXT DEFAULT '+960 7771234',
  default_fee_due_day INTEGER NOT NULL DEFAULT 10,
  require_payment_slip BOOLEAN NOT NULL DEFAULT true,
  allow_partial_payment BOOLEAN NOT NULL DEFAULT true,
  allow_cash_submission BOOLEAN NOT NULL DEFAULT true,
  fee_reminder_popup BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before_due INTEGER NOT NULL DEFAULT 5,
  overdue_reminder BOOLEAN NOT NULL DEFAULT true,
  singleton BOOLEAN UNIQUE NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.fee_settings (
  bank_name, account_name, account_number, secondary_account,
  payment_instructions, viber_contact, default_fee_due_day,
  require_payment_slip, allow_partial_payment, allow_cash_submission,
  fee_reminder_popup, reminder_days_before_due, overdue_reminder, singleton
) VALUES (
  'Bank of Maldives (BML)', 'Ababeel Quran Class', '7701123456789', '7701987654321 (MVR Savings)',
  'Please include Student ID and Fee Month in transfer remarks. Submit slip after transfer.', '+960 7771234',
  10, true, true, true, true, 5, true, true
) ON CONFLICT (singleton) DO NOTHING;

GRANT SELECT ON public.fee_settings TO authenticated;
GRANT ALL ON public.fee_settings TO service_role;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_settings_read_auth" ON public.fee_settings;
  CREATE POLICY "fee_settings_read_auth" ON public.fee_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_settings_admin_all" ON public.fee_settings;
  CREATE POLICY "fee_settings_admin_all" ON public.fee_settings FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. financial_accounts table
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank', -- 'bank', 'cash', 'other'
  account_number TEXT,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "financial_accounts_admin" ON public.financial_accounts;
  CREATE POLICY "financial_accounts_admin" ON public.financial_accounts FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Seed default financial accounts if not present
INSERT INTO public.financial_accounts (account_name, account_type, account_number, current_balance)
VALUES 
  ('BML Bank Account', 'bank', '7701123456789', 25000.00),
  ('Cash in Hand', 'cash', NULL, 3500.00),
  ('MIB Account', 'bank', '9010112345678', 5000.00)
ON CONFLICT DO NOTHING;

-- 3. fee_bills table
CREATE TABLE IF NOT EXISTS public.fee_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  fee_month TEXT NOT NULL, -- e.g. "September 2026" or "2026-09"
  due_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  approved_paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  outstanding_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'pending_approval', 'paid', 'overdue', 'waived', 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_bills_student ON public.fee_bills(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_bills_status ON public.fee_bills(status);
CREATE INDEX IF NOT EXISTS idx_fee_bills_month ON public.fee_bills(fee_month);

GRANT SELECT ON public.fee_bills TO authenticated;
GRANT ALL ON public.fee_bills TO service_role;
ALTER TABLE public.fee_bills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_bills_admin" ON public.fee_bills;
  CREATE POLICY "fee_bills_admin" ON public.fee_bills FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_bills_student_read_own" ON public.fee_bills;
  CREATE POLICY "fee_bills_student_read_own" ON public.fee_bills FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. fee_payment_submissions table
CREATE TABLE IF NOT EXISTS public.fee_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_bill_id uuid NOT NULL REFERENCES public.fee_bills(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL, -- 'bank_transfer', 'online_transfer', 'cash'
  payment_account_text TEXT,
  transfer_reference TEXT,
  slip_path TEXT,
  student_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected', 'cancelled'
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_amount NUMERIC(10,2),
  receiving_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  admin_comment TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicate pending submissions per fee bill
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_submission_pending 
  ON public.fee_payment_submissions(fee_bill_id) 
  WHERE status IN ('pending', 'under_review');

CREATE INDEX IF NOT EXISTS idx_fee_submissions_student ON public.fee_payment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_submissions_status ON public.fee_payment_submissions(status);

GRANT SELECT, INSERT ON public.fee_payment_submissions TO authenticated;
GRANT ALL ON public.fee_payment_submissions TO service_role;
ALTER TABLE public.fee_payment_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_subs_admin" ON public.fee_payment_submissions;
  CREATE POLICY "fee_subs_admin" ON public.fee_payment_submissions FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_subs_student_read_own" ON public.fee_payment_submissions;
  CREATE POLICY "fee_subs_student_read_own" ON public.fee_payment_submissions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_subs_student_insert_own" ON public.fee_payment_submissions;
  CREATE POLICY "fee_subs_student_insert_own" ON public.fee_payment_submissions FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.fee_bills b WHERE b.id = fee_bill_id AND b.student_id = student_id)
      AND status = 'pending'
    );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. fee_payments table (official receipts)
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_bill_id uuid NOT NULL REFERENCES public.fee_bills(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payment_submission_id uuid UNIQUE REFERENCES public.fee_payment_submissions(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT NOT NULL,
  financial_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  transaction_id uuid,
  reference TEXT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_bill ON public.fee_payments(fee_bill_id);

GRANT SELECT ON public.fee_payments TO authenticated;
GRANT ALL ON public.fee_payments TO service_role;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_payments_admin" ON public.fee_payments;
  CREATE POLICY "fee_payments_admin" ON public.fee_payments FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_payments_student_read_own" ON public.fee_payments;
  CREATE POLICY "fee_payments_student_read_own" ON public.fee_payments FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6. account_transactions table
CREATE TABLE IF NOT EXISTS public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL DEFAULT 'fee_income',
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  description TEXT,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  fee_bill_id uuid REFERENCES public.fee_bills(id) ON DELETE SET NULL,
  fee_payment_id uuid REFERENCES public.fee_payments(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.account_transactions TO service_role;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "account_transactions_admin" ON public.account_transactions;
  CREATE POLICY "account_transactions_admin" ON public.account_transactions FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 7. Private storage bucket for payment slips
INSERT INTO storage.buckets (id, name, public)
VALUES ('fee-payment-slips', 'fee-payment-slips', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_slips_admin_all" ON storage.objects;
  CREATE POLICY "fee_slips_admin_all" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'fee-payment-slips' AND public.has_role(auth.uid(), 'admin'))
    WITH CHECK (bucket_id = 'fee-payment-slips' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_slips_student_upload" ON storage.objects;
  CREATE POLICY "fee_slips_student_upload" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'fee-payment-slips'
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
      )
    );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fee_slips_student_read" ON storage.objects;
  CREATE POLICY "fee_slips_student_read" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'fee-payment-slips'
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
      )
    );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 8. Seed sample fee bills for current active students if fee_bills is empty
DO $$
DECLARE
  v_student RECORD;
  v_bill_seq INT := 1001;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fee_bills LIMIT 1) THEN
    FOR v_student IN SELECT id, class_id FROM public.students WHERE status = 'active' LIMIT 15 LOOP
      -- Current month fee: September 2026
      INSERT INTO public.fee_bills (
        bill_number, student_id, class_id, fee_month, due_date,
        amount, approved_paid_amount, outstanding_amount, status, notes
      ) VALUES (
        'BILL-2026-09-' || LPAD(v_bill_seq::text, 4, '0'),
        v_student.id,
        v_student.class_id,
        'September 2026',
        DATE '2026-09-10',
        500.00,
        0.00,
        500.00,
        'unpaid',
        'Tuition fee for September 2026'
      );
      v_bill_seq := v_bill_seq + 1;

      -- Previous month fee: August 2026 (Overdue)
      INSERT INTO public.fee_bills (
        bill_number, student_id, class_id, fee_month, due_date,
        amount, approved_paid_amount, outstanding_amount, status, notes
      ) VALUES (
        'BILL-2026-08-' || LPAD(v_bill_seq::text, 4, '0'),
        v_student.id,
        v_student.class_id,
        'August 2026',
        DATE '2026-08-10',
        500.00,
        0.00,
        500.00,
        'overdue',
        'Overdue tuition fee for August 2026'
      );
      v_bill_seq := v_bill_seq + 1;
    END LOOP;
  END IF;
END $$;
