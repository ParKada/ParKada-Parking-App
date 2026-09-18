ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS rep_home_number TEXT;
ALTER TABLE public.partner_applications ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'DTI';
