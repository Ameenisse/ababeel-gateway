-- ==============================================================================
-- Migration: Target Practice, Check Requests, Teacher Checking & Term Reports
-- Date: 2026-09-09
-- Idempotent upgrade for Ababeel Quran Class
-- ==============================================================================

-- 1. Helper function: check if role exists for auth user
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Helper function: is teacher assigned to class or student
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_teacher uuid, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_class_assignments sca
    WHERE sca.student_id = _student
      AND sca.is_current = true
      AND (sca.main_teacher_id = _teacher OR sca.assistant_teacher_id = _teacher)
  ) OR EXISTS (
    SELECT 1 FROM public.class_teachers ct
    JOIN public.students s ON s.class_id = ct.class_id
    WHERE s.id = _student AND ct.teacher_id = _teacher
  );
$$;

-- 2. Upgrade target_templates table
ALTER TABLE public.target_templates
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Sync template_name with name if missing
UPDATE public.target_templates
SET template_name = name
WHERE template_name IS NULL AND name IS NOT NULL;

-- 3. Create target_template_sections table
CREATE TABLE IF NOT EXISTS public.target_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_template_id uuid NOT NULL REFERENCES public.target_templates(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  section_name_dhivehi text,
  section_type text,
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_template_sections TO authenticated;
GRANT ALL ON public.target_template_sections TO service_role;
ALTER TABLE public.target_template_sections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "target_template_sections admin all" ON public.target_template_sections;
  CREATE POLICY "target_template_sections admin all" ON public.target_template_sections FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "target_template_sections read" ON public.target_template_sections;
  CREATE POLICY "target_template_sections read" ON public.target_template_sections FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Upgrade target_template_items table
ALTER TABLE public.target_template_items
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.target_template_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_code text,
  ADD COLUMN IF NOT EXISTS target_title text,
  ADD COLUMN IF NOT EXISTS target_title_dhivehi text,
  ADD COLUMN IF NOT EXISTS arabic_text text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_points numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Sync fields if previously using title_dv / title_en / sort_order
UPDATE public.target_template_items
SET 
  target_title = COALESCE(target_title, title_en),
  target_title_dhivehi = COALESCE(target_title_dhivehi, title_dv),
  display_order = COALESCE(display_order, sort_order)
WHERE target_title IS NULL OR target_title_dhivehi IS NULL;

-- 5. Upgrade student_target_assignments table
ALTER TABLE public.student_target_assignments
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.target_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS current_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_check_date timestamptz,
  ADD COLUMN IF NOT EXISTS last_teacher_comment text,
  ADD COLUMN IF NOT EXISTS completed_date timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS final_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS achieved_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_card_visible boolean DEFAULT true;

-- Sync current_status with previous status enum
UPDATE public.student_target_assignments
SET 
  current_status = CASE 
    WHEN status::text = 'completed' THEN 'completed'
    WHEN status::text = 'in_review' THEN 'check_requested'
    WHEN status::text = 'assigned' THEN 'practicing'
    ELSE 'not_started'
  END,
  completed_date = COALESCE(completed_date, completed_at),
  achieved_points = CASE WHEN status::text = 'completed' THEN 1 ELSE 0 END
WHERE current_status = 'not_started' AND status IS NOT NULL;

-- 6. Create target_check_requests table
CREATE TABLE IF NOT EXISTS public.target_check_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_target_assignment_id uuid NOT NULL REFERENCES public.student_target_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  student_message text,
  preferred_check_date date,
  request_status text NOT NULL DEFAULT 'pending', -- pending, accepted, under_checking, checked, cancelled
  accepted_by uuid,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index to enforce that only ONE request can be open at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_target_open_check_request 
  ON public.target_check_requests (student_target_assignment_id) 
  WHERE request_status IN ('pending', 'accepted', 'under_checking');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_check_requests TO authenticated;
GRANT ALL ON public.target_check_requests TO service_role;
ALTER TABLE public.target_check_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tcr admin all" ON public.target_check_requests;
  CREATE POLICY "tcr admin all" ON public.target_check_requests FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tcr teacher scope" ON public.target_check_requests;
  CREATE POLICY "tcr teacher scope" ON public.target_check_requests FOR ALL TO authenticated
    USING (public.is_teacher_of_student(auth.uid(), student_id))
    WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tcr student select own" ON public.target_check_requests;
  CREATE POLICY "tcr student select own" ON public.target_check_requests FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tcr student insert own" ON public.target_check_requests;
  CREATE POLICY "tcr student insert own" ON public.target_check_requests FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tcr student cancel own" ON public.target_check_requests;
  CREATE POLICY "tcr student cancel own" ON public.target_check_requests FOR UPDATE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
      AND request_status = 'pending'
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
      AND request_status = 'cancelled'
    );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 7. Upgrade target_check_attempts table
ALTER TABLE public.target_check_attempts
  ADD COLUMN IF NOT EXISTS target_check_request_id uuid REFERENCES public.target_check_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS student_target_assignment_id uuid REFERENCES public.student_target_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS teacher_id uuid,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'completed', -- completed, practice_again, progressing, not_ready, not_checked, exempted
  ADD COLUMN IF NOT EXISTS teacher_comment text,
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS next_check_date date,
  ADD COLUMN IF NOT EXISTS evidence_path text,
  ADD COLUMN IF NOT EXISTS private_teacher_note text,
  ADD COLUMN IF NOT EXISTS is_final_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS superseded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill legacy records in target_check_attempts
UPDATE public.target_check_attempts
SET
  student_target_assignment_id = COALESCE(student_target_assignment_id, assignment_id),
  teacher_comment = COALESCE(teacher_comment, teacher_note),
  teacher_id = COALESCE(teacher_id, responded_by),
  checked_at = COALESCE(checked_at, responded_at, requested_at),
  result = CASE 
    WHEN outcome::text = 'completed' THEN 'completed'
    WHEN outcome::text = 'needs_improvement' THEN 'practice_again'
    ELSE 'progressing'
  END,
  is_final_completion = (outcome::text = 'completed')
WHERE student_target_assignment_id IS NULL AND assignment_id IS NOT NULL;

GRANT SELECT, INSERT ON public.target_check_attempts TO authenticated;
GRANT ALL ON public.target_check_attempts TO service_role;
ALTER TABLE public.target_check_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tca admin all" ON public.target_check_attempts;
  CREATE POLICY "tca admin all" ON public.target_check_attempts FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tca teacher scope" ON public.target_check_attempts;
  CREATE POLICY "tca teacher scope" ON public.target_check_attempts FOR ALL TO authenticated
    USING (public.is_teacher_of_student(auth.uid(), student_id))
    WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tca student read own" ON public.target_check_attempts;
  CREATE POLICY "tca student read own" ON public.target_check_attempts FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 8. Create target_status_history table
CREATE TABLE IF NOT EXISTS public.target_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_target_assignment_id uuid NOT NULL REFERENCES public.student_target_assignments(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  related_check_request_id uuid REFERENCES public.target_check_requests(id) ON DELETE SET NULL,
  related_attempt_id uuid REFERENCES public.target_check_attempts(id) ON DELETE SET NULL,
  changed_by uuid,
  change_reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.target_status_history TO authenticated;
GRANT ALL ON public.target_status_history TO service_role;
ALTER TABLE public.target_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tsh admin all" ON public.target_status_history;
  CREATE POLICY "tsh admin all" ON public.target_status_history FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tsh teacher read" ON public.target_status_history;
  CREATE POLICY "tsh teacher read" ON public.target_status_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.student_target_assignments sta
      WHERE sta.id = student_target_assignment_id AND public.is_teacher_of_student(auth.uid(), sta.student_id)
    ));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tsh student read own" ON public.target_status_history;
  CREATE POLICY "tsh student read own" ON public.target_status_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.student_target_assignments sta
      JOIN public.students s ON s.id = sta.student_id
      WHERE sta.id = student_target_assignment_id AND s.user_id = auth.uid()
    ));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 9. Create report_card_item_results table
CREATE TABLE IF NOT EXISTS public.report_card_item_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_term_report_id uuid REFERENCES public.progress_reports(id) ON DELETE CASCADE,
  student_target_assignment_id uuid REFERENCES public.student_target_assignments(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES public.target_template_items(id) ON DELETE CASCADE,
  final_attempt_id uuid REFERENCES public.target_check_attempts(id) ON DELETE SET NULL,
  achievement_status text NOT NULL,
  achievement_star boolean NOT NULL DEFAULT false,
  completion_date timestamptz,
  final_teacher_comment text,
  achieved_points numeric DEFAULT 0,
  snapshot_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_card_item_results TO authenticated;
GRANT ALL ON public.report_card_item_results TO service_role;
ALTER TABLE public.report_card_item_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "rcir admin all" ON public.report_card_item_results;
  CREATE POLICY "rcir admin all" ON public.report_card_item_results FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "rcir teacher read" ON public.report_card_item_results;
  CREATE POLICY "rcir teacher read" ON public.report_card_item_results FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.student_target_assignments sta
      WHERE sta.id = student_target_assignment_id AND public.is_teacher_of_student(auth.uid(), sta.student_id)
    ));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "rcir student read" ON public.report_card_item_results;
  CREATE POLICY "rcir student read" ON public.report_card_item_results FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.student_target_assignments sta
      JOIN public.students s ON s.id = sta.student_id
      WHERE sta.id = student_target_assignment_id AND s.user_id = auth.uid()
    ));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 10. Create in_app_notifications table
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  sender_id uuid,
  role_target text, -- 'student' | 'staff' | 'admin'
  title text NOT NULL,
  message text NOT NULL,
  link text,
  type text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notif user own" ON public.in_app_notifications;
  CREATE POLICY "notif user own" ON public.in_app_notifications FOR ALL TO authenticated
    USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 11. Create target_audit_logs table
CREATE TABLE IF NOT EXISTS public.target_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  performed_by uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.target_audit_logs TO authenticated;
GRANT ALL ON public.target_audit_logs TO service_role;
ALTER TABLE public.target_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "audit admin all" ON public.target_audit_logs;
  CREATE POLICY "audit admin all" ON public.target_audit_logs FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 12. Create private storage bucket for target evidence (Section 22)
INSERT INTO storage.buckets (id, name, public)
VALUES ('target-evidence', 'target-evidence', false)
ON CONFLICT (id) DO NOTHING;
