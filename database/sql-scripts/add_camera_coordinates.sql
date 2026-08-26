-- Migration: Add camera coordinates column to parking_slots
-- This stores the 4-point polygon drawn by the AI node to map slots to the camera view.

-- 1. Add the coordinates column (stores array of [x,y] points as JSONB)
ALTER TABLE public.parking_slots
ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL;

-- 2. Add physical_status column used by the AI node to track camera-level state
ALTER TABLE public.parking_slots
ADD COLUMN IF NOT EXISTS physical_status TEXT DEFAULT 'empty';

-- 3. Reload PostgREST schema cache so the new columns are immediately accessible
NOTIFY pgrst, 'reload schema';
