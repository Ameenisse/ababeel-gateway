-- 20260909040000_google_admission_and_student_accounts.sql
-- Google Admission Sign-In, Application Progress Tracking & Automatic Student Account Creation

-- 1. Upgrade admission_requests table
ALTER TABLE public.admission_requests
  ADD COLUMN IF NOT EXISTS applicant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicant_email TEXT,
  ADD COLUMN IF NOT EXISTS applicant_name TEXT,
  ADD COLUMN IF NOT EXISTS applicant_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS created_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicant_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_notes TEXT,
  ADD COLUMN IF NOT EXISTS email_delivery_status TEXT DEFAULT 'pending', -- 'sent' | 'failed' | 'pending' | 'pending_retry'
  ADD COLUMN IF NOT EXISTS email_delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 300.00;

-- 2. Upgrade students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 300.00;

-- 3. Upgrade student_accounts table
ALTER TABLE public.student_accounts
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS must_change_pin BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pin_last_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'disabled'
  ADD COLUMN IF NOT EXISTS reset_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_credentials_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credentials_email_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS credentials_email_error TEXT;

-- 4. Unique indexes and query acceleration
CREATE INDEX IF NOT EXISTS idx_admission_requests_applicant
  ON public.admission_requests(applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_admission_requests_identity
  ON public.admission_requests(identity_number);

CREATE INDEX IF NOT EXISTS idx_student_accounts_username_lower
  ON public.student_accounts(lower(username));

-- 5. Update RLS on admission_requests
-- Drop anonymous insert - applicants must be authenticated
DROP POLICY IF EXISTS "anon submit application" ON public.admission_requests;
DROP POLICY IF EXISTS "auth submit application" ON public.admission_requests;
DROP POLICY IF EXISTS "staff/admin read applications" ON public.admission_requests;
DROP POLICY IF EXISTS "applicant read own applications" ON public.admission_requests;
DROP POLICY IF EXISTS "applicant update own pending applications" ON public.admission_requests;

-- Authenticated Google user can submit their own application
CREATE POLICY "applicant submit own application" ON public.admission_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    agreed_to_rules = true
    AND (applicant_user_id IS NULL OR applicant_user_id = auth.uid())
  );

-- Applicant can read their own applications; staff & admin can read all
CREATE POLICY "applicant read own applications" ON public.admission_requests
  FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'staff')
  );

-- Applicant can update their own application while in editable state
CREATE POLICY "applicant update own pending applications" ON public.admission_requests
  FOR UPDATE TO authenticated
  USING (
    (applicant_user_id = auth.uid() AND status IN ('draft', 'submitted', 'pending', 'correction_requested'))
    OR public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    (applicant_user_id = auth.uid() AND status IN ('draft', 'submitted', 'pending', 'correction_requested'))
    OR public.has_role(auth.uid(),'admin')
  );
