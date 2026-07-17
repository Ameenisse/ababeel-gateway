
-- target_categories
CREATE TABLE public.target_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  weight_percent numeric(5,2) NOT NULL DEFAULT 0,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_categories TO authenticated;
GRANT ALL ON public.target_categories TO service_role;
ALTER TABLE public.target_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read categories" ON public.target_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage categories" ON public.target_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_target_categories_updated BEFORE UPDATE ON public.target_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- targets
CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.target_categories(id) ON DELETE RESTRICT,
  code text UNIQUE,
  title text NOT NULL,
  description text,
  unit text,
  max_value numeric(10,2),
  term_scope text NOT NULL DEFAULT 'both' CHECK (term_scope IN ('term1','term2','both')),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_targets_category ON public.targets(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO authenticated;
GRANT ALL ON public.targets TO service_role;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read targets" ON public.targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage targets" ON public.targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_targets_updated BEFORE UPDATE ON public.targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- badges
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage badges" ON public.badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_badges_updated BEFORE UPDATE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
