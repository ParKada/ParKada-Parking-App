import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://bwhhfzhrjtvkrrsdxfbh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo');
async function test() {
  const { data, error } = await supabase.from('parking_lots').select('id, name');
  console.log("Error:", error);
  console.log("Lots:", data);
}
test();
