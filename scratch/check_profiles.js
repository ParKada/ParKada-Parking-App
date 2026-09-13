import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDc3NTIsImV4cCI6MjA5NjI4Mzc1Mn0.Iy0QbQe6eeU9y3xx_L6qCqLUFfoH9PQhq82gDtUjYPw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  // We can't easily get the currently logged-in user without the session token.
  // We can query all profiles and admin_profiles to see what exists.
  
  const { data: profiles } = await supabase.from('profiles').select('id, email, first_name');
  const { data: adminProfiles } = await supabase.from('admin_profiles').select('id, email, role');
  
  console.log('Profiles:', profiles);
  console.log('Admin Profiles:', adminProfiles);
}

checkUser();
