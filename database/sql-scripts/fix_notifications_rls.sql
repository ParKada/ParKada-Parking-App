-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policy if it exists to prevent duplicates
DROP POLICY IF EXISTS "Users and Admins can insert notifications" ON public.notifications;

-- Create policy to allow authenticated users to insert notifications
-- They can insert if the notification is for themselves (user_id = auth.uid()) 
-- OR if they are an admin/staff (exists in admin_profiles)
CREATE POLICY "Users and Admins can insert notifications" ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.admin_profiles WHERE id = auth.uid()
  )
);
