-- Run this in your Supabase SQL Editor to add the push token column

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
