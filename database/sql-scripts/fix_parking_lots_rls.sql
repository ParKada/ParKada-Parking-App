-- Run this in the Supabase Dashboard -> SQL Editor
-- This allows Super Admins to insert new parking lots during partner approval

CREATE POLICY "Super Admins can insert parking lots" 
ON parking_lots
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Super Admins can update parking lots" 
ON parking_lots
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM admin_profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);
