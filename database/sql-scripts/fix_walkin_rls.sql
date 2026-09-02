-- Enable RLS just to be sure
ALTER TABLE public.walk_in_records ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.walk_in_records;
DROP POLICY IF EXISTS "Enable insert for guards" ON public.walk_in_records;
DROP POLICY IF EXISTS "Allow all admins to insert walk-ins" ON public.walk_in_records;

-- Create policy to allow all admins (guard, manager, super_admin) to insert records
CREATE POLICY "Allow all admins to insert walk-ins" ON public.walk_in_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_profiles 
    WHERE id = auth.uid() 
    AND role IN ('guard', 'manager', 'super_admin')
  )
);

-- Note: Also ensure they can read records (if not already allowed)
DROP POLICY IF EXISTS "Allow all admins to read walk-ins" ON public.walk_in_records;
CREATE POLICY "Allow all admins to read walk-ins" ON public.walk_in_records
FOR SELECT
TO authenticated
USING (true);
-- Enable update for all admins
DROP POLICY IF EXISTS "Allow all admins to update walk-ins" ON public.walk_in_records;
CREATE POLICY "Allow all admins to update walk-ins" ON public.walk_in_records
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
