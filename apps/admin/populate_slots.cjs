const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL || 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co', process.env.VITE_SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo');

async function main() {
  const lotId = '0dea029d-4f5e-4cf0-b892-6c154b541597';
  
  const { data: slots, error: fetchError } = await supabase.from('parking_slots').select('id').eq('lot_id', lotId);
  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }
  
  console.log(`Found ${slots.length} slots. Updating statuses...`);
  
  let availableCount = 0;
  let occupiedCount = 0;
  
  for (let i = 0; i < slots.length; i++) {
    // 25% available, 75% occupied
    const newStatus = Math.random() < 0.25 ? 'available' : 'occupied';
    
    if (newStatus === 'available') availableCount++;
    else occupiedCount++;
    
    const { error: updateError } = await supabase.from('parking_slots').update({ status: newStatus }).eq('id', slots[i].id);
    if (updateError) {
      console.error(`Error updating slot ${slots[i].id}:`, updateError);
    }
  }
  
  console.log(`Finished updating slots! Available: ${availableCount}, Occupied: ${occupiedCount}`);
}

main().catch(console.error);
