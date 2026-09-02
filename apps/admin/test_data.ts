import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://bwhhfzhrjtvkrrsdxfbh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo');
async function test() {
  const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('id, total_amount, status, created_at, start_time, lot_id, parking_lots (name, type, total_slots, operating_hours)');
  console.log("Res Error:", resErr);
  const { data: walkData, error: walkErr } = await supabase
        .from('walk_in_records')
        .select('id, amount_paid, entry_time, slot_id, parking_slots (lot_id, parking_lots (id, name, type))');
  console.log("Walk Error:", walkErr);
  const { data: ocrData, error: ocrErr } = await supabase
        .from('plate_validation_logs')
        .select('id, lot_id, camera_id, detected_plate, confidence_score, validation_status, created_at');
  console.log("OCR Error:", ocrErr);
}
test();
