
-- Ensure pgcrypto for random ids/bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Link admission request to created student (single-use)
ALTER TABLE public.admission_requests
  ADD COLUMN IF NOT EXISTS linked_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admission_requests_linked_student_unique
  ON public.admission_requests(linked_student_id)
  WHERE linked_student_id IS NOT NULL;

-- Sequence + generator for student number: AQC-YYYY-####
CREATE SEQUENCE IF NOT EXISTS public.student_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_student_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.student_number_seq');
  RETURN 'AQC-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_student_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_student_number() TO service_role;
