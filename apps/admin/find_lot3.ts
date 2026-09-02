import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env from apps/admin
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const anonKey = envContent.split('\n').find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))?.split('=')[1]?.trim();
const url = envContent.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL='))?.split('=')[1]?.trim();

const supabase = createClient(url, anonKey);
async function test() {
  const { data, error } = await supabase.from('parking_lots').select('id, name');
  console.log("Error:", error);
  console.log("Lots:", data);
}
test();
