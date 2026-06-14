import { createClient } from '@supabase/supabase-js';

// Support both Expo and Vite environment variables during migration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// This prevents the "Uncaught Error" white screen
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase keys are missing! Check your .env.local file.");
}

// We use an empty string fallback so the app still 'runs' (renders the UI) 
// instead of crashing completely.
export const supabase = createClient(
  supabaseUrl || 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co', 
  supabaseAnonKey || 'sb_publishable_Lgi26VHDjiQqHV2OM7HhmA_G9dkxdGH'
);