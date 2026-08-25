-- Enable RLS just to be sure
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent conflict
DROP POLICY IF EXISTS "Managers can insert guards" ON public.admin_profiles;
DROP POLICY IF EXISTS "Managers can update guards" ON public.admin_profiles;
DROP POLICY IF EXISTS "Managers can delete guards" ON public.admin_profiles;
DROP POLICY IF EXISTS "Super admins can insert anything" ON public.admin_profiles;
DROP POLICY IF EXISTS "Super admins can update anything" ON public.admin_profiles;
DROP POLICY IF EXISTS "Super admins can delete anything" ON public.admin_profiles;
DROP POLICY IF EXISTS "Anyone can read admin profiles" ON public.admin_profiles;

-- Create policy to allow ALL authenticated users to read admin_profiles
CREATE POLICY "Anyone can read admin profiles" ON public.admin_profiles
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow managers to insert guard profiles
CREATE POLICY "Managers can insert guards" ON public.admin_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'guard' AND 
  EXISTS (
    SELECT 1 FROM public.admin_profiles AS ap 
    WHERE ap.id = auth.uid() 
    AND ap.role = 'manager' 
    AND ap.assigned_lot_id = admin_profiles.assigned_lot_id
  )
);

-- Create policy to allow managers to update guard profiles
CREATE POLICY "Managers can update guards" ON public.admin_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles AS ap 
    WHERE ap.id = auth.uid() 
    AND ap.role = 'manager'
    AND (admin_profiles.assigned_lot_id = ap.assigned_lot_id OR admin_profiles.assigned_lot_id IS NULL)
  )
)
WITH CHECK (
  role = 'guard'
);

-- Create policy to allow managers to delete guard profiles
CREATE POLICY "Managers can delete guards" ON public.admin_profiles
FOR DELETE
TO authenticated
USING (
  role = 'guard' AND 
  EXISTS (
    SELECT 1 FROM public.admin_profiles AS ap 
    WHERE ap.id = auth.uid() 
    AND ap.role = 'manager' 
    AND ap.assigned_lot_id = admin_profiles.assigned_lot_id
  )
);

-- Note: Also ensure super admins can insert anything
CREATE POLICY "Super admins can insert anything" ON public.admin_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_profiles AS ap 
    WHERE ap.id = auth.uid() 
    AND ap.role = 'super_admin'
  )
);

-- Note: Also ensure super admins can update anything
CREATE POLICY "Super admins can update anything" ON public.admin_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles AS ap 
    WHERE ap.id = auth.uid() 
    AND ap.role = 'super_admin'
  )
);

-- Note: Also ensure super admins can delete anything
CREATE POLICY "Super admins can delete anything" ON public.admin_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles AS ap 
    WHERE ap.id = auth.uid() 
    AND ap.role = 'super_admin'
  )
);
