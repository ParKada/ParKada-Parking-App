-- Run this in the Supabase Dashboard -> SQL Editor
-- This adds a column to store the admin password so the applicant can view it on the portal dashboard

ALTER TABLE public.partner_applications 
ADD COLUMN IF NOT EXISTS current_password TEXT;
