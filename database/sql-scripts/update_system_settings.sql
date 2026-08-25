-- Move max_concurrent_reservations, max_vehicles_per_user and maintenance_mode to global system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS max_concurrent_reservations integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_vehicles_per_user integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false;
