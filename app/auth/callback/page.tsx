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

  type Status = 'verifying' | 'set-password' | 'saving' | 'success' | 'error'

  const [status,   setStatus]   = useState<Status>('verifying')
  const [errMsg,   setErrMsg]   = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)

  // ── Token verification on mount ─────────────────────────────────
  useEffect(() => {
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')
    const code       = searchParams.get('code')

    async function verify() {
      // PKCE / OAuth code flow → exchange and go to dashboard
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setErrMsg('Link has expired or is invalid.'); setStatus('error'); return }
        router.replace('/dashboard')
        return
      }

      // Token hash flow (invite / magic link / recovery)
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'invite' | 'magiclink' | 'recovery' | 'email' | 'signup' | 'email_change',
        })
        if (error) {
          setErrMsg('This invite link has expired or has already been used.')
          setStatus('error')
          return
        }
        // For invites & recovery, let the user set a password
        setStatus('set-password')
        return
      }

      // No token params — check for an existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        setErrMsg('Invalid link. Please ask your admin to send a new invitation.')
        setStatus('error')
      }
    }

    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Password submit ─────────────────────────────────────────────
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
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setErrMsg(error.message)
      setStatus('set-password')
      return
    }

    setStatus('success')
    setTimeout(() => router.replace('/dashboard'), 1800)
  }

  // ── Verifying ───────────────────────────────────────────────────
  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Spinner />
        <p className="text-sm text-gray-500">Verifying your invitation…</p>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────
  if (status === 'error') {
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

  // ── Success ─────────────────────────────────────────────────────
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

  // ── Set password form (set-password | saving) ───────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center mb-1">
        <p className="text-[15px] font-semibold text-gray-800">Set your password</p>
        <p className="text-sm text-gray-400 mt-1">Choose a password to complete your account setup.</p>
      </div>

      {errMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{errMsg}</p>
        </div>
      )}

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-600" htmlFor="password">
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
            className="w-full px-4 py-2.5 pr-10 text-sm bg-gray-50 border border-black/[0.08] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
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
        <label className="text-xs font-semibold text-gray-600" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
          className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-black/[0.08] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'saving'}
        className="mt-1 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {status === 'saving' ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          'Set password & continue'
        )}
      </button>
    </form>
  )
}

// ── Page shell (Suspense boundary required for useSearchParams) ──────

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
