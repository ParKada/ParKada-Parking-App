-- Fix RLS Policies for Admin Reports

-- 1. Reservations Table
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Drop any existing conflicting policies (optional, but good for clean slate)
DROP POLICY IF EXISTS "Admins can view their lot's reservations" ON public.reservations;
DROP POLICY IF EXISTS "Super Admins can view all reservations" ON public.reservations;

-- Allow Super Admins to view ALL reservations
CREATE POLICY "Super Admins can view all reservations" 
ON public.reservations FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'superadmin')
  )
);

-- Allow Partner Admins and Staff to view reservations for their assigned lot
CREATE POLICY "Admins can view their lot's reservations" 
ON public.reservations FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND assigned_lot_id = reservations.lot_id
  )
);

-- 2. Walk-in Records Table
ALTER TABLE public.walk_in_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their lot's walk-ins" ON public.walk_in_records;
DROP POLICY IF EXISTS "Super Admins can view all walk-ins" ON public.walk_in_records;

-- Allow Super Admins to view ALL walk-in records
CREATE POLICY "Super Admins can view all walk-ins" 
ON public.walk_in_records FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'superadmin')
  )
);

-- Allow Partner Admins and Staff to view walk-in records for their assigned lot
CREATE POLICY "Admins can view their lot's walk-ins" 
ON public.walk_in_records FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND assigned_lot_id = walk_in_records.lot_id
  )
);

-- 3. Plate Validation Logs Table
ALTER TABLE public.plate_validation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their lot's plate logs" ON public.plate_validation_logs;
DROP POLICY IF EXISTS "Super Admins can view all plate logs" ON public.plate_validation_logs;

CREATE POLICY "Super Admins can view all plate logs" 
ON public.plate_validation_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'superadmin')
  )
);

CREATE POLICY "Admins can view their lot's plate logs" 
ON public.plate_validation_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND assigned_lot_id = plate_validation_logs.lot_id
  )
);
