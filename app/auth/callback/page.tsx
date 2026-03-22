'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Shared UI ────────────────────────────────────────────────────

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <svg className={`animate-spin ${size} text-blue-500`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-12 h-12 rounded-2xl bg-[#111018] flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 tracking-tight">ENE Builders</h1>
    </div>
  )
}

// ── Email OTP types that are valid for token_hash flow ───────────
type EmailOtpType = 'invite' | 'signup' | 'magiclink' | 'recovery' | 'email' | 'email_change'

const VALID_OTP_TYPES = new Set<string>([
  'invite', 'signup', 'magiclink', 'recovery', 'email', 'email_change',
])

// ── Inner component (must be inside Suspense for useSearchParams) ─

function CallbackContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  type Status = 'verifying' | 'set-password' | 'saving' | 'success' | 'error'

  const [status,   setStatus]   = useState<Status>('verifying')
  const [errMsg,   setErrMsg]   = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)

  // ── Token verification on mount ─────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    // Query params (PKCE or token_hash flow)
    const code       = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')

    // Hash fragment — Supabase implicit grant sends tokens in the URL hash
    // e.g. #access_token=xxx&refresh_token=yyy&type=invite
    const hashStr      = window.location.hash.replace(/^#/, '')
    const hashParams   = new URLSearchParams(hashStr)
    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const hashType     = hashParams.get('type')

    console.log('[auth/callback] ── incoming params ──────────────────')
    console.log('[auth/callback] code        :', code ? `${code.slice(0, 12)}…` : null)
    console.log('[auth/callback] token_hash  :', token_hash ? `${token_hash.slice(0, 12)}…` : null)
    console.log('[auth/callback] type        :', type)
    console.log('[auth/callback] hash present:', !!hashStr)
    console.log('[auth/callback] access_token:', accessToken ? `${accessToken.slice(0, 12)}…` : null)
    console.log('[auth/callback] hash type   :', hashType)

    async function verify() {
      // ── Flow A: hash fragment (implicit grant) ──────────────────
      // Sent by older Supabase projects or when PKCE is disabled.
      // Tokens live in window.location.hash, not in query params.
      if (accessToken && refreshToken) {
        console.log('[auth/callback] Trying Flow A: implicit grant (hash tokens)')
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          console.error('[auth/callback] Flow A failed:', error.message)
        } else {
          console.log('[auth/callback] Flow A succeeded')
          setStatus('set-password')
          return
        }
      }

      // ── Flow B: PKCE code exchange ──────────────────────────────
      // Supabase ≥ 2.x with PKCE enabled sends ?code=xxx
      if (code) {
        console.log('[auth/callback] Trying Flow B: exchangeCodeForSession')
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[auth/callback] Flow B failed:', error.message)
        } else {
          console.log('[auth/callback] Flow B succeeded')
          setStatus('set-password')
          return
        }
      }

      // ── Flow C: token_hash OTP ──────────────────────────────────
      // Most common for inviteUserByEmail — ?token_hash=xxx&type=invite
      if (token_hash && type && VALID_OTP_TYPES.has(type)) {
        console.log('[auth/callback] Trying Flow C: verifyOtp with type:', type)
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as EmailOtpType,
        })
        if (error) {
          console.error('[auth/callback] Flow C failed:', error.message)
          setErrMsg(error.message)
        } else {
          console.log('[auth/callback] Flow C succeeded')
          setStatus('set-password')
          return
        }
      } else if (token_hash && type) {
        // type exists but isn't a valid email OTP type
        console.warn('[auth/callback] Flow C skipped: unrecognised type value:', type)
      }

      // ── No params at all → maybe already signed in ───────────────
      if (!code && !token_hash && !accessToken) {
        console.log('[auth/callback] No token params found — checking existing session')
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('[auth/callback] Existing session found — redirecting')
          router.replace('/dashboard')
          return
        }
        setErrMsg('No authentication parameters were found in the link. Please ask your admin to send a new invitation.')
      }

      // ── All flows failed ─────────────────────────────────────────
      console.log('[auth/callback] All flows exhausted — showing error')
      setStatus('error')
    }

    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Set password submit ─────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')

    if (password.length < 8) {
      setErrMsg('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setErrMsg('Passwords do not match.')
      return
    }

    setStatus('saving')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('[auth/callback] updateUser error:', error.message)
      setErrMsg(error.message)
      setStatus('set-password')
      return
    }

    console.log('[auth/callback] Password set successfully')
    setStatus('success')
    setTimeout(() => router.replace('/dashboard'), 1500)
  }

  // ── Render ──────────────────────────────────────────────────────

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Spinner />
        <p className="text-sm text-gray-500">Verifying your invitation…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Password set!</p>
        <p className="text-sm text-gray-400">Taking you to your dashboard…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-2">Invalid invite link</p>
        <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{errMsg || 'This link has expired or has already been used.'}</p>
        <a href="/login" className="text-sm font-semibold text-[#1C3FAA] hover:text-[#162F82] transition-colors">
          Back to login
        </a>
      </div>
    )
  }

  // ── Set password form (status === 'set-password' | 'saving') ────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center mb-1">
        <p className="text-base font-semibold text-gray-900">Welcome to ENE Builders</p>
        <p className="text-sm text-gray-400 mt-1">Set a password to activate your account.</p>
      </div>

      {errMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{errMsg}</p>
        </div>
      )}

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600" htmlFor="cb-password">
          New password
        </label>
        <div className="relative">
          <input
            id="cb-password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
            autoFocus
            className="w-full px-4 py-2.5 pr-10 text-sm bg-gray-50 border border-black/[0.08] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1C3FAA]/20 focus:border-[#1C3FAA] transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Confirm */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600" htmlFor="cb-confirm">
          Confirm password
        </label>
        <input
          id="cb-confirm"
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
          className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-black/[0.08] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1C3FAA]/20 focus:border-[#1C3FAA] transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'saving'}
        className="mt-1 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C3FAA] hover:bg-[#162F82] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {status === 'saving' ? (
          <>
            <Spinner small />
            Saving…
          </>
        ) : (
          'Set password & continue'
        )}
      </button>
    </form>
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
