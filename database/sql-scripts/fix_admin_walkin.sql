-- Fix for "new row violates row-level security policy for table walk_in_records"
-- This adds support for the 'admin' and 'staff' roles to insert, select, and update walk-in records.
-- Previously only 'guard', 'manager', and 'super_admin' were allowed.

-- 1. Insert Policy
DROP POLICY IF EXISTS "Allow all admins to insert walk-ins" ON public.walk_in_records;
CREATE POLICY "Allow all admins to insert walk-ins" ON public.walk_in_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND role IN ('guard', 'manager', 'admin', 'staff', 'super_admin', 'superadmin')
  )
);

-- 2. Select Policy
DROP POLICY IF EXISTS "Allow all admins to read walk-ins" ON public.walk_in_records;
CREATE POLICY "Allow all admins to read walk-ins" ON public.walk_in_records
FOR SELECT
TO authenticated
USING (true);

-- 3. Update Policy
DROP POLICY IF EXISTS "Allow all admins to update walk-ins" ON public.walk_in_records;
CREATE POLICY "Allow all admins to update walk-ins" ON public.walk_in_records
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
