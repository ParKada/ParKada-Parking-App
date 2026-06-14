import { createClient } from '@supabase/supabase-js';

// Support both Expo and Vite environment variables safely
const getEnvVar = (expoKey: string, viteKey: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[expoKey]) {
    return process.env[expoKey];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    return import.meta.env[viteKey];
  }
  return undefined;
};

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

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