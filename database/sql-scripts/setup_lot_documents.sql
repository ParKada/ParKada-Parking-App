-- Add URL columns to parking_lots
ALTER TABLE public.parking_lots
ADD COLUMN IF NOT EXISTS front_view_url text,
ADD COLUMN IF NOT EXISTS business_permit_url text,
ADD COLUMN IF NOT EXISTS other_photos text[] DEFAULT '{}';

-- Create the lot-documents storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lot-documents', 'lot-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for lot-documents bucket
-- Note: Supabase storage policies require checking bucket_id

-- 1. Allow public to SELECT (download/view) images
DROP POLICY IF EXISTS "Public can view lot documents" ON storage.objects;
CREATE POLICY "Public can view lot documents" ON storage.objects
FOR SELECT
USING (bucket_id = 'lot-documents');

-- 2. Allow authenticated users to INSERT files
DROP POLICY IF EXISTS "Authenticated users can upload lot documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload lot documents" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lot-documents');

-- 3. Allow authenticated users to UPDATE their files
DROP POLICY IF EXISTS "Authenticated users can update lot documents" ON storage.objects;
CREATE POLICY "Authenticated users can update lot documents" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lot-documents');

-- 4. Allow authenticated users to DELETE files
DROP POLICY IF EXISTS "Authenticated users can delete lot documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete lot documents" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lot-documents');
