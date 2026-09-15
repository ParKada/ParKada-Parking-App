-- Enable RLS on profiles table just in case it is disabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow super admins and regular admins to SELECT from profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE admin_profiles.id = auth.uid()
  )
);

-- Allow admins to UPDATE profiles (for verifications)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE admin_profiles.id = auth.uid()
  )
);
