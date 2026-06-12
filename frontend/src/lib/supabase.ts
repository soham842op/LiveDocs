// Server-only Supabase client.
// Never import this in a Client Component — the env vars have no NEXT_PUBLIC_ prefix
// and are intentionally not exposed to the browser.
//
// RLS is disabled for CP4 (no auth yet). CP5 adds JWT-based auth and row-level security.
// At that point we'll switch to @supabase/ssr and per-request clients with user sessions.
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export type Doc = {
  id: string
  title: string
  updated_at: string
}
