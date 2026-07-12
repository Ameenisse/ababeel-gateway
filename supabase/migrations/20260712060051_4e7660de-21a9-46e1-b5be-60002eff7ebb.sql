
-- ============= EXTENSIONS =============
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============= UPDATED_AT HELPER =============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============= ROLES =============
CREATE TYPE public.app_role AS ENUM ('admin','staff','student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END LIMIT 1;
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  photo_url TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= CLASSES =============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code TEXT UNIQUE NOT NULL,
  class_name TEXT NOT NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assistant_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session TEXT,
  room TEXT,
  maximum_students INT DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT ON public.classes TO anon;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "admin manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ADMISSION SETTINGS =============
CREATE TABLE public.admission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Admissions',
  description TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  rules_version INT NOT NULL DEFAULT 1,
  opening_date DATE,
  closing_date DATE,
  is_open BOOLEAN NOT NULL DEFAULT false,
  minimum_age INT,
  maximum_age INT,
  success_message TEXT DEFAULT 'Your application has been received.',
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_settings TO authenticated;
GRANT SELECT ON public.admission_settings TO anon;
GRANT ALL ON public.admission_settings TO service_role;
ALTER TABLE public.admission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read admission settings" ON public.admission_settings FOR SELECT USING (true);
CREATE POLICY "admin manage admission settings" ON public.admission_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_admset_updated BEFORE UPDATE ON public.admission_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ADMISSION REQUESTS =============
CREATE TABLE public.admission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL DEFAULT ('ADM-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,6)),
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  guardian_identity_number TEXT,
  mobile TEXT NOT NULL,
  alternative_mobile TEXT,
  address TEXT,
  island TEXT,
  atoll TEXT,
  previous_experience TEXT,
  reading_level TEXT,
  preferred_class UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  preferred_session TEXT,
  medical_notes TEXT,
  remarks TEXT,
  photo_url TEXT,
  document_url TEXT,
  agreed_to_rules BOOLEAN NOT NULL DEFAULT false,
  rules_version INT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|under_review|approved|rejected|waiting_list
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_requests TO authenticated;
GRANT INSERT ON public.admission_requests TO anon;
GRANT ALL ON public.admission_requests TO service_role;
ALTER TABLE public.admission_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon submit application" ON public.admission_requests FOR INSERT TO anon
  WITH CHECK (agreed_to_rules = true);
CREATE POLICY "auth submit application" ON public.admission_requests FOR INSERT TO authenticated
  WITH CHECK (agreed_to_rules = true);
CREATE POLICY "staff/admin read applications" ON public.admission_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin manage applications" ON public.admission_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete applications" ON public.admission_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============= STUDENTS =============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_request_id UUID REFERENCES public.admission_requests(id) ON DELETE SET NULL,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  student_number TEXT UNIQUE NOT NULL DEFAULT ('STU-' || to_char(now(),'YYYY') || '-' || substring(gen_random_uuid()::text,1,6)),
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  identity_number TEXT,
  guardian_name TEXT,
  guardian_identity_number TEXT,
  mobile TEXT,
  alternative_mobile TEXT,
  address TEXT,
  island TEXT,
  atoll TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  session TEXT,
  admission_date DATE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active', -- active|inactive|graduated|suspended|left
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student read own" ON public.students FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= STUDENT ACCOUNTS (username + PIN metadata) =============
CREATE TABLE public.student_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_accounts TO authenticated;
GRANT ALL ON public.student_accounts TO service_role;
ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own student account" ON public.student_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage student accounts" ON public.student_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_studacc_updated BEFORE UPDATE ON public.student_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= STAFF =============
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_number TEXT UNIQUE NOT NULL DEFAULT ('STF-' || substring(gen_random_uuid()::text,1,6)),
  full_name TEXT NOT NULL,
  designation TEXT,
  phone TEXT,
  assigned_classes UUID[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read own or admin" ON public.staff FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage staff" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ATTENDANCE =============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL, -- present|absent|sick|excused|late
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student read own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'staff')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "staff/admin write attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "staff/admin update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin delete attendance" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============= COMPETITIONS =============
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  banner_url TEXT,
  competition_type TEXT,
  location TEXT,
  competition_date DATE,
  start_time TIME,
  end_time TIME,
  registration_open_date DATE,
  registration_close_date DATE,
  display_start_date DATE,
  display_end_date DATE,
  minimum_age INT,
  maximum_age INT,
  eligible_gender TEXT DEFAULT 'any',
  eligible_classes UUID[] DEFAULT '{}',
  maximum_participants INT,
  public_registration_enabled BOOLEAN NOT NULL DEFAULT true,
  student_registration_enabled BOOLEAN NOT NULL DEFAULT true,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  rules TEXT,
  rules_version INT NOT NULL DEFAULT 1,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|published|registration_open|registration_closed|completed|cancelled|archived
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT SELECT ON public.competitions TO anon;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published competitions in window" ON public.competitions FOR SELECT
  USING (
    status IN ('published','registration_open','registration_closed','completed')
    AND (display_start_date IS NULL OR display_start_date <= CURRENT_DATE)
    AND (display_end_date IS NULL OR display_end_date >= CURRENT_DATE)
  );
CREATE POLICY "auth read all competitions" ON public.competitions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'student'));
CREATE POLICY "admin manage competitions" ON public.competitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_comp_updated BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.competition_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  category_code TEXT NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT,
  minimum_age INT,
  maximum_age INT,
  eligible_gender TEXT DEFAULT 'any',
  eligible_classes UUID[] DEFAULT '{}',
  maximum_participants INT,
  registration_fee NUMERIC(10,2) DEFAULT 0,
  category_rules TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(competition_id, category_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_categories TO authenticated;
GRANT SELECT ON public.competition_categories TO anon;
GRANT ALL ON public.competition_categories TO service_role;
ALTER TABLE public.competition_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories of visible comps" ON public.competition_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.competitions c WHERE c.id = competition_id
    AND c.status IN ('published','registration_open','registration_closed','completed')
    AND (c.display_start_date IS NULL OR c.display_start_date <= CURRENT_DATE)
    AND (c.display_end_date IS NULL OR c.display_end_date >= CURRENT_DATE)
  ));
CREATE POLICY "auth read all categories" ON public.competition_categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'student'));
CREATE POLICY "admin manage categories" ON public.competition_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE NOT NULL DEFAULT ('REG-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,6)),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.competition_categories(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  participant_type TEXT NOT NULL DEFAULT 'public', -- public|student
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  identity_number TEXT,
  guardian_name TEXT,
  mobile TEXT,
  address TEXT,
  island TEXT,
  atoll TEXT,
  school_or_class TEXT,
  experience TEXT,
  notes TEXT,
  photo_url TEXT,
  document_url TEXT,
  agreed_to_rules BOOLEAN NOT NULL DEFAULT false,
  rules_version INT,
  approval_status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected|waiting_list
  participation_status TEXT NOT NULL DEFAULT 'registered', -- registered|checked_in|participated|absent|disqualified|completed
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX ON public.competition_participants(competition_id, category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_participants TO authenticated;
GRANT INSERT ON public.competition_participants TO anon;
GRANT ALL ON public.competition_participants TO service_role;
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon submit participation" ON public.competition_participants FOR INSERT TO anon
  WITH CHECK (agreed_to_rules = true AND participant_type = 'public');
CREATE POLICY "student submit participation" ON public.competition_participants FOR INSERT TO authenticated
  WITH CHECK (agreed_to_rules = true);
CREATE POLICY "read own or admin/staff" ON public.competition_participants FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = competition_participants.student_id AND s.user_id = auth.uid())
  );
CREATE POLICY "admin/staff manage participants" ON public.competition_participants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin delete participants" ON public.competition_participants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.competition_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.competition_categories(id) ON DELETE SET NULL,
  participant_id UUID NOT NULL REFERENCES public.competition_participants(id) ON DELETE CASCADE,
  rank INT,
  score NUMERIC(10,2),
  grade TEXT,
  judge_remarks TEXT,
  result_status TEXT NOT NULL DEFAULT 'pending',
  certificate_number TEXT,
  prize_details TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_results TO authenticated;
GRANT ALL ON public.competition_results TO service_role;
ALTER TABLE public.competition_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own result or admin/staff" ON public.competition_results FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
    OR (is_published AND EXISTS (
      SELECT 1 FROM public.competition_participants cp
      JOIN public.students s ON s.id = cp.student_id
      WHERE cp.id = competition_results.participant_id AND s.user_id = auth.uid()
    ))
  );
CREATE POLICY "admin/staff manage results" ON public.competition_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_results_updated BEFORE UPDATE ON public.competition_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ANNOUNCEMENTS =============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  audience TEXT NOT NULL DEFAULT 'public', -- public|all_students|class|staff|competition|custom
  audience_reference TEXT,
  priority TEXT NOT NULL DEFAULT 'normal', -- normal|important|urgent
  publish_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'published',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active public announcements" ON public.announcements FOR SELECT
  USING (
    audience = 'public' AND status = 'published'
    AND (publish_date IS NULL OR publish_date <= CURRENT_DATE)
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
  );
CREATE POLICY "auth read announcements" ON public.announcements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'student')
  );
CREATE POLICY "admin/staff manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_ann_updated BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= WEBSITE SETTINGS =============
CREATE TABLE public.website_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_name TEXT DEFAULT 'Ababeel Quran Class',
  logo_url TEXT,
  favicon_url TEXT,
  hero_title TEXT DEFAULT 'Ababeel Quran Class',
  hero_description TEXT DEFAULT 'Nurturing hearts through the light of the Qur''an.',
  contact_number TEXT,
  contact_email TEXT,
  address TEXT,
  social_facebook TEXT,
  social_instagram TEXT,
  social_youtube TEXT,
  landing_images TEXT[] DEFAULT '{}',
  about_section TEXT,
  footer_text TEXT,
  theme TEXT DEFAULT 'light',
  student_pin_min_length INT NOT NULL DEFAULT 4,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_settings TO authenticated;
GRANT SELECT ON public.website_settings TO anon;
GRANT ALL ON public.website_settings TO service_role;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read website settings" ON public.website_settings FOR SELECT USING (true);
CREATE POLICY "admin manage website settings" ON public.website_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_web_updated BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= AUDIT LOG =============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
