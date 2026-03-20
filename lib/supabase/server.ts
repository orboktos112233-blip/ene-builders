import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Use this in Server Components, Server Actions, and Route Handlers.
// Never import this in Client Components.
//
// No Database generic — use explicit type casts in queries.
// Replace with generated types via `supabase gen types typescript` once
// the Supabase project is configured.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies cannot be set.
            // Middleware handles session refresh so this is safe to ignore.
          }
        },
      },
    }
  )
}
