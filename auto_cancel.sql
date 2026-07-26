-- TC-13 & TC-21: Auto-Cancellation with Dynamic Grace Period
-- This function will find any 'reserved' bookings that have exceeded 
-- their end_time by the dynamically configured grace_period_minutes.

CREATE OR REPLACE FUNCTION auto_cancel_expired_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grace_period integer;
BEGIN
  -- Get the current dynamic grace period from system settings (default to 10 if missing)
  SELECT grace_period_minutes INTO v_grace_period 
  FROM system_settings 
  WHERE id = 1;
  
  IF v_grace_period IS NULL THEN
    v_grace_period := 10;
  END IF;

  -- 1. Mark expired reservations as cancelled
  UPDATE reservations
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE status = 'reserved' 
    -- If the end time + grace period is in the past, cancel it!
    AND (end_time + (v_grace_period * interval '1 minute')) < NOW();

  -- 2. Free up the parking slots that were tied to these cancelled reservations
  -- (We do this by resetting any slot that has NO active or reserved bookings left)
  UPDATE parking_slots ps
  SET status = 'available',
      updated_at = NOW()
  WHERE status IN ('occupied', 'reserved')
    AND NOT EXISTS (
      SELECT 1 FROM reservations r 
      WHERE r.slot_id = ps.id 
      AND r.status IN ('active', 'reserved')
    );
END;
$$;
