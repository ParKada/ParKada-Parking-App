-- Fix for "new row violates row-level security policy" when deleting a record
-- This adds support for the 'admin', 'manager', 'super_admin' roles to delete walk-in records.
-- Staff and guards are excluded from deleting based on app rules, but we can match frontend logic.

DROP POLICY IF EXISTS "Allow admins to delete walk-ins" ON public.walk_in_records;
CREATE POLICY "Allow admins to delete walk-ins" ON public.walk_in_records
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND role IN ('manager', 'admin', 'super_admin', 'superadmin')
  )
);
