import { createBrowserClient } from '@supabase/ssr'

// No Database generic here — use explicit type casts in queries.
// Replace with generated types via `supabase gen types typescript` once
// the Supabase project is configured.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
