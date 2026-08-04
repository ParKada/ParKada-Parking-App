import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: lots, error: lotsError } = await supabase.from('parking_lots').select('*').limit(1);
  console.log("Lots columns:", Object.keys(lots?.[0] || {}));

  const { data: slots, error: slotsError } = await supabase.from('parking_slots').select('*').limit(1);
  console.log("Slots columns:", Object.keys(slots?.[0] || {}));

  if (lotsError) console.log("Lots Error:", lotsError);
  if (slotsError) console.log("Slots Error:", slotsError);
}

run();
