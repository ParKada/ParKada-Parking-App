-- Drop the old constraint
ALTER TABLE public.plate_validation_logs DROP CONSTRAINT IF EXISTS plate_validation_logs_validation_status_check;

-- Add the new constraint with 'detected' included
ALTER TABLE public.plate_validation_logs ADD CONSTRAINT plate_validation_logs_validation_status_check CHECK (validation_status IN ('matched', 'mismatched', 'detected', 'manual_review'));
