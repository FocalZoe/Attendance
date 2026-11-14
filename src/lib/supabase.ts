import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

// createClient throws on an empty URL, which would leave a blank page before any error UI can mount.
// Use unreachable placeholders so the app renders and requests fail with a normal network error.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local or in the Vercel project environment variables.');
}

export const supabase = createClient(supabaseUrl || 'https://missing-config.invalid', supabaseAnonKey || 'missing-config', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * 建立不污染全域會話的暫時客戶端（用於學校主管或管理員建立其他成員帳號）
 */
export function createIsolatedClient() {
  return createClient(supabaseUrl || 'https://missing-config.invalid', supabaseAnonKey || 'missing-config', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
