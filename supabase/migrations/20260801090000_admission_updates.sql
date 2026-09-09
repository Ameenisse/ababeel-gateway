-- Add new columns for admission requests and admission settings
ALTER TABLE public.admission_requests 
ADD COLUMN IF NOT EXISTS grade_studying TEXT,
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS student_id_url TEXT,
ADD COLUMN IF NOT EXISTS guardian_id_url TEXT;

ALTER TABLE public.admission_settings 
ADD COLUMN IF NOT EXISTS rules_pdf_url TEXT;
