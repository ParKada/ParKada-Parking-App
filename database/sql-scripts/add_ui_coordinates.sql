-- Migration to add 2D Interactive Map and Multi-floor support

-- 1. Add floors array to parking_lots
ALTER TABLE public.parking_lots 
ADD COLUMN IF NOT EXISTS floors JSONB DEFAULT '["Main Floor"]'::jsonb;

-- 2. Add floor index to parking_slots to know which floor it is on (0 = Main Floor)
ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS floor_index INTEGER DEFAULT 0;

-- 3. Add UI Coordinate fields for the interactive map
-- Percentages (0 to 100) are used for X and Y to make it responsive across mobile/web
ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS ui_x NUMERIC DEFAULT 10;

ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS ui_y NUMERIC DEFAULT 10;

ALTER TABLE public.parking_slots 
ADD COLUMN IF NOT EXISTS ui_rotation NUMERIC DEFAULT 0;
