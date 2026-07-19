
-- Enums
DO $$ BEGIN
  CREATE TYPE public.class_level AS ENUM ('baby','nursery','lkg','ukg','ks1','ks2_3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.target_status AS ENUM ('assigned','in_review','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.check_outcome AS ENUM ('completed','needs_improvement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_publish_status AS ENUM ('draft','published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- classes gets a level
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_level public.class_level;

-- Helper: is teacher of student (current assignment)
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_teacher uuid, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_class_assignments sca
    WHERE sca.student_id = _student
      AND sca.is_current = true
      AND (sca.main_teacher_id = _teacher OR sca.assistant_teacher_id = _teacher)
  );
$$;

-- Target templates
CREATE TABLE public.target_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_level public.class_level NOT NULL,
  term_id uuid NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_level, term_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_templates TO authenticated;
GRANT ALL ON public.target_templates TO service_role;
ALTER TABLE public.target_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "target_templates admin all" ON public.target_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "target_templates read" ON public.target_templates FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_target_templates_updated BEFORE UPDATE ON public.target_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Template items
CREATE TABLE public.target_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.target_templates(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.target_categories(id) ON DELETE SET NULL,
  title_dv text NOT NULL,
  title_en text,
  star_group text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_template_items TO authenticated;
GRANT ALL ON public.target_template_items TO service_role;
ALTER TABLE public.target_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_items admin all" ON public.target_template_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "template_items read" ON public.target_template_items FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_template_items_updated BEFORE UPDATE ON public.target_template_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ON public.target_template_items(template_id, sort_order);

-- Student target assignments
CREATE TABLE public.student_target_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES public.target_template_items(id) ON DELETE CASCADE,
  status public.target_status NOT NULL DEFAULT 'assigned',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id, template_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_target_assignments TO authenticated;
GRANT ALL ON public.student_target_assignments TO service_role;
ALTER TABLE public.student_target_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sta admin all" ON public.student_target_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sta student self read" ON public.student_target_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "sta teacher scope" ON public.student_target_assignments FOR SELECT TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_id));
CREATE POLICY "sta teacher update" ON public.student_target_assignments FOR UPDATE TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_id))
  WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id));

CREATE TRIGGER trg_sta_updated BEFORE UPDATE ON public.student_target_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ON public.student_target_assignments(student_id, term_id);
CREATE INDEX ON public.student_target_assignments(status);

-- Check attempts
CREATE TABLE public.target_check_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.student_target_assignments(id) ON DELETE CASCADE,
  student_note text,
  teacher_note text,
  outcome public.check_outcome,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  requested_by uuid,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_check_attempts TO authenticated;
GRANT ALL ON public.target_check_attempts TO service_role;
ALTER TABLE public.target_check_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tca admin all" ON public.target_check_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tca student self read" ON public.target_check_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_target_assignments sa
    JOIN public.students s ON s.id = sa.student_id
    WHERE sa.id = assignment_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "tca student insert" ON public.target_check_attempts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.student_target_assignments sa
    JOIN public.students s ON s.id = sa.student_id
    WHERE sa.id = assignment_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "tca teacher scope" ON public.target_check_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_target_assignments sa
    WHERE sa.id = assignment_id AND public.is_teacher_of_student(auth.uid(), sa.student_id)
  ));
CREATE POLICY "tca teacher update" ON public.target_check_attempts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_target_assignments sa
    WHERE sa.id = assignment_id AND public.is_teacher_of_student(auth.uid(), sa.student_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.student_target_assignments sa
    WHERE sa.id = assignment_id AND public.is_teacher_of_student(auth.uid(), sa.student_id)
  ));
CREATE INDEX ON public.target_check_attempts(assignment_id, requested_at DESC);

-- Trigger: keep assignment.status in sync with latest attempt outcome
CREATE OR REPLACE FUNCTION public.sync_assignment_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.outcome IS NULL THEN
      UPDATE public.student_target_assignments SET status='in_review' WHERE id = NEW.assignment_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.outcome IS DISTINCT FROM OLD.outcome AND NEW.outcome IS NOT NULL THEN
    IF NEW.outcome = 'completed' THEN
      UPDATE public.student_target_assignments SET status='completed', completed_at=NEW.responded_at
        WHERE id = NEW.assignment_id;
    ELSE
      UPDATE public.student_target_assignments SET status='assigned', completed_at=NULL
        WHERE id = NEW.assignment_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_assignment_status
  AFTER INSERT OR UPDATE ON public.target_check_attempts
  FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_status();

-- Student badges (award instance of fixed ribbons)
CREATE TABLE public.student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_by uuid,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id, badge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_badges TO authenticated;
GRANT ALL ON public.student_badges TO service_role;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sb admin all" ON public.student_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sb student read" ON public.student_badges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "sb teacher scope" ON public.student_badges FOR ALL TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_id))
  WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id));

-- Progress reports
CREATE TABLE public.progress_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  status public.report_publish_status NOT NULL DEFAULT 'draft',
  teacher_comment text,
  parent_feedback jsonb,
  snapshot jsonb,
  pdf_path text,
  submitted_by uuid,
  submitted_at timestamptz,
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_reports TO authenticated;
GRANT ALL ON public.progress_reports TO service_role;
ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr admin all" ON public.progress_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pr teacher scope" ON public.progress_reports FOR ALL TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_id))
  WITH CHECK (public.is_teacher_of_student(auth.uid(), student_id));
CREATE POLICY "pr student read published" ON public.progress_reports FOR SELECT TO authenticated
  USING (status = 'published' AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE TRIGGER trg_progress_reports_updated BEFORE UPDATE ON public.progress_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the 6 fixed ribbon badges (idempotent)
INSERT INTO public.badges (code, name, description, icon, color, is_active) VALUES
  ('best_all_round','Best All Round','Best All Round','🏅','#dc2626',true),
  ('best_reciter','Best Reciter','Best Reciter','🎖️','#dc2626',true),
  ('discipline','Discipline Award','Discipline Award','🏵️','#dc2626',true),
  ('attendance','Attendance Award','Attendance Award','🎗️','#dc2626',true),
  ('best_handwriter','Best Hand Writer','Best Hand Writer','✍️','#dc2626',true),
  ('best_book','Best Book','Best Book','📖','#dc2626',true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;
