-- Add scaling capability to parking slots for dynamic resizing in the map
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS ui_scale NUMERIC DEFAULT 0.8;

-- Reload schema cache to instantly apply the new column
NOTIFY pgrst, 'reload schema';
