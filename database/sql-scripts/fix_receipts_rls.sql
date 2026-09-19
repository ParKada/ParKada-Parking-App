-- Create policy to allow all admins to read receipts
CREATE POLICY "Admins can view all receipts" 
ON public.receipts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE admin_profiles.id = auth.uid()
  )
);
