
-- Enums
DO $$ BEGIN
  CREATE TYPE public.term_status AS ENUM ('draft','active','completed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- academic_years
-- =========================================================
CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_name text NOT NULL UNIQUE,           -- e.g. "2026-2027"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX academic_years_one_current
  ON public.academic_years ((is_current))
  WHERE is_current = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage academic years"
  ON public.academic_years FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff and students view academic years"
  ON public.academic_years FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'student')
  );

CREATE TRIGGER set_updated_at_academic_years
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- academic_terms
-- =========================================================
CREATE TABLE public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_name text NOT NULL,                 -- "First Term" / "Second Term"
  term_sequence smallint NOT NULL,         -- 1, 2
  start_date date NOT NULL,
  end_date date NOT NULL,
  target_open_date date,
  target_deadline date,
  report_available_date date,
  status public.term_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, term_sequence),
  UNIQUE (academic_year_id, term_name),
  CHECK (end_date > start_date)
);

CREATE INDEX academic_terms_year_idx ON public.academic_terms(academic_year_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms TO authenticated;
GRANT ALL ON public.academic_terms TO service_role;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage academic terms"
  ON public.academic_terms FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff and students view academic terms"
  ON public.academic_terms FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'student')
  );

CREATE TRIGGER set_updated_at_academic_terms
  BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- student_class_assignments
-- =========================================================
CREATE TABLE public.student_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  session text,
  main_teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  assistant_teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX student_class_assignments_one_current
  ON public.student_class_assignments (student_id)
  WHERE is_current = true;

CREATE INDEX sca_student_idx ON public.student_class_assignments(student_id);
CREATE INDEX sca_class_idx ON public.student_class_assignments(class_id);
CREATE INDEX sca_year_term_idx ON public.student_class_assignments(academic_year_id, term_id);
CREATE INDEX sca_main_teacher_idx ON public.student_class_assignments(main_teacher_id);
CREATE INDEX sca_assistant_teacher_idx ON public.student_class_assignments(assistant_teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_class_assignments TO authenticated;
GRANT ALL ON public.student_class_assignments TO service_role;
ALTER TABLE public.student_class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage class assignments"
  ON public.student_class_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff view own class assignments"
  ON public.student_class_assignments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff')
    AND (
      main_teacher_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
      OR assistant_teacher_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Students view own class assignments"
  ON public.student_class_assignments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'student')
    AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE TRIGGER set_updated_at_sca
  BEFORE UPDATE ON public.student_class_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
