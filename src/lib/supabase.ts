import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  (import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  'https://fsutnzfqzbfvdjjzizzf.supabase.co'

const supabaseAnonKey =
  (import.meta.env &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.SUPABASE_ANON_KEY)) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdXRuemZxemJmdmRqanppenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjczMDEsImV4cCI6MjA5NzYwMzMwMX0.7BjvnIrcccp7gxJp0zo9nLJEU1HHk2nlFUb5Ul2tjr8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const getStoragePublicUrl = (
  bucket: 'avatars' | 'attendance-photos',
  path: string | null | undefined
): string | null => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || null
}

