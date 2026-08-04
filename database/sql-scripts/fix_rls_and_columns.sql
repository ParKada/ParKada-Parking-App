-- ========================================================
-- ParKada Full Database Fix (RLS, Constraints, Columns)
-- ========================================================

-- 1. Ensure all missing UI columns exist (including is_pwd)
ALTER TABLE public.parking_lots ADD COLUMN IF NOT EXISTS floors JSONB DEFAULT '["Main Floor"]'::jsonb;
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS floor_index INTEGER DEFAULT 0;
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS ui_x NUMERIC DEFAULT 10;
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS ui_y NUMERIC DEFAULT 10;
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS ui_rotation NUMERIC DEFAULT 0;
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT false;
ALTER TABLE public.parking_slots ADD COLUMN IF NOT EXISTS is_reservable BOOLEAN DEFAULT true;

-- 2. Fix the check constraint so 'unmapped' slots are legal
ALTER TABLE public.parking_slots DROP CONSTRAINT IF EXISTS parking_slots_status_check;
ALTER TABLE public.parking_slots ADD CONSTRAINT parking_slots_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'unmapped', 'maintenance'));

-- 3. FIX ROW LEVEL SECURITY (RLS)
-- Right now, Supabase is blocking ALL inserts and updates from the application because there are no RLS policies allowing it!
CREATE POLICY "Admins can insert parking slots" ON parking_slots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins can update parking slots" ON parking_slots FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins can delete parking slots" ON parking_slots FOR DELETE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins can update parking lots" ON parking_lots FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
);

-- 4. Reload PostgREST API Schema Cache
NOTIFY pgrst, 'reload schema';
