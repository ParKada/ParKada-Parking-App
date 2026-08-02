-- Create the partner_applications table
CREATE TABLE public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'submitted', 'documents_under_review',
      'verification', 'needs_revision', 'approved', 'rejected', 'account_activated'
    )),

  -- Step 1: Representative Info
  rep_first_name TEXT,
  rep_last_name TEXT,
  rep_contact_number TEXT,
  rep_email TEXT,

  -- Step 2: Establishment Details
  establishment_name TEXT,
  establishment_address TEXT,
  establishment_city TEXT,
  establishment_zip TEXT,
  total_capacity INTEGER,
  operating_hours TEXT,

  -- Step 3: Business & Legal Info
  business_registration_number TEXT,
  tin TEXT,
  business_type TEXT,
  year_established INTEGER,

  -- Step 4: Document URLs (stored in Supabase Storage)
  documents JSONB DEFAULT '{}'::jsonb,

  -- Step 5: Terms acceptance
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT DEFAULT 'v1.0',

  -- Admin review fields
  reviewed_by uuid REFERENCES public.admin_profiles(id),
  review_notes TEXT,
  rejection_reason TEXT,

  -- Post-approval
  parkada_email TEXT,
  linked_lot_id uuid REFERENCES public.parking_lots(id),
  activated_at TIMESTAMPTZ,

  -- Timestamps
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the audit log table
CREATE TABLE public.partner_application_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.partner_applications(id) ON DELETE CASCADE,
  changed_by_role TEXT,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for partner_applications
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants manage own applications"
ON public.partner_applications
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Super Admins can manage all applications"
ON public.partner_applications
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for partner_application_audit_log
ALTER TABLE public.partner_application_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants can read own audit logs"
ON public.partner_application_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.partner_applications
    WHERE id = application_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Super Admins can read all audit logs"
ON public.partner_application_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Insert policy for audit logs (can be triggered by Edge Functions / triggers, but let's allow authenticated inserts)
CREATE POLICY "Super Admins and Applicants can insert audit logs"
ON public.partner_application_audit_log
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Trigger to update updated_at timestamp on partner_applications
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_partner_applications_modtime
BEFORE UPDATE ON public.partner_applications
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
