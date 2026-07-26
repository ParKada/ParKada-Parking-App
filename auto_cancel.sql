-- TC-13: Auto-Cancellation with 5-Minute Grace Period
-- This function will find any 'reserved' bookings that have exceeded 
-- their end_time by 5 minutes without the user showing up.

-- 0. Enable the pg_cron extension (Required for the scheduler to work)
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION auto_cancel_expired_reservations()
RETURNS void AS $$
BEGIN
  -- 1. Free up the parking slots
  UPDATE parking_slots
  SET status = 'available'
  WHERE id IN (
    SELECT slot_id 
    FROM reservations
    WHERE status = 'reserved' 
    AND (end_time + interval '5 minutes') < NOW()
  );

  -- 2. Mark reservations as cancelled
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'reserved' 
  AND (end_time + interval '5 minutes') < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule the job to run every minute via pg_cron
-- IMPORTANT: Make sure the pg_cron extension is enabled in your database!
SELECT cron.schedule(
  'auto-cancel-reservations',
  '* * * * *',
  $$ SELECT auto_cancel_expired_reservations(); $$
);
