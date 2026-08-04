-- Migration to add 2D Interactive Map and Multi-floor support

-- 1. Add floors array to parking_lots
ALTER TABLE public.parking_lots 
ADD COLUMN IF NOT EXISTS floors JSONB DEFAULT '["Main Floor"]'::jsonb;

-- 2. Add floor index to parking_slots to know which floor it is on (0 = Main Floor)
ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS floor_index INTEGER DEFAULT 0;

-- 3. Add UI Coordinate fields for the interactive map
ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS ui_x NUMERIC DEFAULT 10;

ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS ui_y NUMERIC DEFAULT 10;

ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS ui_rotation NUMERIC DEFAULT 0;

-- 4. Fix missing columns from a previous update that were blocking slots from saving
ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT false;

ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS is_reservable BOOLEAN DEFAULT true;

-- 5. Fix the Status Check Constraint so that 'unmapped' is an allowed status
ALTER TABLE public.parking_slots 
DROP CONSTRAINT IF EXISTS parking_slots_status_check;

ALTER TABLE public.parking_slots 
ADD CONSTRAINT parking_slots_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'unmapped'));

-- Make sure to reload the cache so the API registers the changes immediately!
NOTIFY pgrst, 'reload schema';
