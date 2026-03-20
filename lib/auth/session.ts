import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/types/database'

// Returns the authenticated Supabase user or null.
// Use in Server Components when you need the raw auth identity.
export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Returns the profile row for the currently authenticated user.
// Returns null if not authenticated or profile not found.
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Profile | null)
}

// Ensures the user is authenticated and has one of the allowed roles.
// Redirects to /login if not authenticated.
// Redirects to /dashboard if authenticated but role not allowed.
// Returns the profile on success.
export async function requireRole(allowedRoles: Role[]): Promise<Profile> {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect('/dashboard')
  }

  return profile
}

// Ensures the user is authenticated (any role).
// Redirects to /login if not.
export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  return profile
}
