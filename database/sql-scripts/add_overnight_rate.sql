ALTER TABLE public.parking_lots
ADD COLUMN IF NOT EXISTS overnight_rate numeric DEFAULT 200.00;
