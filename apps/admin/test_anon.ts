import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://bwhhfzhrjtvkrrsdxfbh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDc3NTIsImV4cCI6MjA5NjI4Mzc1Mn0.Iy0QbQe6eeU9y3xx_L6qCqLUFfoH9PQhq82gDtUjYPw');
async function test() {
  const { data, error } = await supabase.from('reservations').select('*');
  console.log("Anon Data length:", data?.length, "Error:", error);
}
test();
