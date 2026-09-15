-- This script adds the missing columns to the profiles table
-- which are required for the Identity Verification and PWD Discount features.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT,
ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT,
ADD COLUMN IF NOT EXISTS selfie_photo_url TEXT,
ADD COLUMN IF NOT EXISTS valid_id_type TEXT,
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS discount_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS discount_id_number TEXT,
ADD COLUMN IF NOT EXISTS discount_id_url TEXT;

-- After running this, the "Apply for 20% Discount" in the mobile app 
-- and the "Identity Verifications" tab in the Admin Panel will work correctly.
