import { redirect } from 'next/navigation'

// Root redirects to dashboard. Middleware handles auth checks.
export default function RootPage() {
  redirect('/dashboard')
}
