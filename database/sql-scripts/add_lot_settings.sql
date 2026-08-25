-- Adds configuration settings directly to parking_lots to support per-lot configuration

ALTER TABLE public.parking_lots
ADD COLUMN IF NOT EXISTS pricing_scheme text DEFAULT 'hourly' CHECK (pricing_scheme IN ('hourly', 'fixed')),
ADD COLUMN IF NOT EXISTS fixed_rate numeric DEFAULT 150.00,
ADD COLUMN IF NOT EXISTS senior_discount_pct numeric DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS max_reservation_hours integer DEFAULT 6,
ADD COLUMN IF NOT EXISTS min_reservation_hours integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_concurrent_reservations integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_vehicles_per_user integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS slot_cleanup_minutes integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS overtime_fee_per_hour numeric DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS online_payments_enabled boolean DEFAULT true;
