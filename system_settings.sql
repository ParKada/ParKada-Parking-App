-- TC-18 & TC-21: System Settings Table for Admin Overrides
CREATE TABLE public.system_settings (
  id integer PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  grace_period_minutes integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert the default global settings row
INSERT INTO public.system_settings (id, maintenance_mode, grace_period_minutes) 
VALUES (1, false, 10)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Only admins/managers can update
CREATE POLICY "Admins can update system settings"
  ON public.system_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE admin_profiles.id = auth.uid()
      AND admin_profiles.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Enable Realtime
alter publication supabase_realtime add table public.system_settings;
