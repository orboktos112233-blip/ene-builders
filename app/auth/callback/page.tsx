'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Shared UI pieces ─────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 tracking-tight">ENE Builders</h1>
    </div>
  )
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ──

function CallbackContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const supabase     = createClient()

  type Status = 'verifying' | 'success' | 'error'

  const [status, setStatus] = useState<Status>('verifying')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const code       = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')

    console.log('[auth/callback] Params received:', { code, token_hash, type })

    async function verify() {
      // ── 1. Try code (PKCE flow) ─────────────────────────────────
      if (code) {
        console.log('[auth/callback] Trying exchangeCodeForSession...')
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        console.log('[auth/callback] exchangeCodeForSession result:', { session: data?.session?.user?.email, error: error?.message })

        if (!error) {
          console.log('[auth/callback] Code exchange succeeded → /dashboard')
          router.replace('/dashboard')
          return
        }

        console.log('[auth/callback] Code exchange failed:', error.message)
      }

      // ── 2. Try token_hash (invite / magic link) ─────────────────
      if (token_hash && type) {
        console.log('[auth/callback] Trying verifyOtp with type:', type)
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'invite',
        })
        console.log('[auth/callback] verifyOtp result:', { session: data?.session?.user?.email, error: error?.message })

        if (!error) {
          console.log('[auth/callback] verifyOtp succeeded → /dashboard')
          setStatus('success')
          router.replace('/dashboard')
          return
        }

        console.log('[auth/callback] verifyOtp failed:', error.message)
      }

      // ── 3. Both failed (or no params at all) ────────────────────
      console.log('[auth/callback] All flows failed. code:', code, 'token_hash:', token_hash, 'type:', type)
      setErrMsg('This invite link has expired or has already been used.')
      setStatus('error')
    }

    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Verifying ───────────────────────────────────────────────────
  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Spinner />
        <p className="text-sm text-gray-500">Verifying your invitation…</p>
      </div>
    )
  }

  // ── Success (shown briefly before redirect) ─────────────────────
  if (status === 'success') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Verified!</p>
        <p className="text-sm text-gray-400">Taking you to your dashboard…</p>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">Link expired</p>
      <p className="text-sm text-gray-500 mb-6">{errMsg}</p>
      <a
        href="/login"
        className="text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors"
      >
        Back to login
      </a>
    </div>
  )
}

// ── Page shell ───────────────────────────────────────────────────

export default function CallbackPage() {
  return (
    <main className="min-h-screen bg-[#F4F2EF] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="bg-white rounded-2xl border border-black/[0.07] shadow-[0_4px_16px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)] p-8">
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-4 py-8">
                <Spinner />
                <p className="text-sm text-gray-500">Loading…</p>
              </div>
            }
          >
            <CallbackContent />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
