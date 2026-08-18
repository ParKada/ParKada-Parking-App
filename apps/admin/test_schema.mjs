import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('cameras').select('*').limit(1);
  if (error) {
    console.error("cameras table doesn't exist:", error);
  } else {
    console.log("cameras table exists!", data);
  }
  const { data: d2, error: e2 } = await supabase.from('parking_cameras').select('*').limit(1);
  if (e2) {
    console.error("parking_cameras table doesn't exist:", e2);
  } else {
    console.log("parking_cameras table exists!", d2);
  }
}

run();
