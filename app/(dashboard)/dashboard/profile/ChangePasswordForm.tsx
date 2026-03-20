'use client'

import { useActionState, useEffect, useRef } from 'react'
import { changePasswordAction, type ProfileActionState } from '@/app/actions/profile'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const initial: ProfileActionState = {}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the form on success so passwords aren't left in inputs
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
    }
  }, [state.success])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div>
        <label htmlFor="current_password" className="block text-xs font-semibold text-gray-600 mb-1.5">
          Current Password
        </label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          placeholder="Enter current password"
          required
          autoComplete="current-password"
          className="max-w-sm"
        />
      </div>

      <div>
        <label htmlFor="new_password" className="block text-xs font-semibold text-gray-600 mb-1.5">
          New Password
        </label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          placeholder="Min. 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
          className="max-w-sm"
        />
      </div>

      <div>
        <label htmlFor="confirm_password" className="block text-xs font-semibold text-gray-600 mb-1.5">
          Confirm New Password
        </label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          placeholder="Repeat new password"
          required
          minLength={8}
          autoComplete="new-password"
          className="max-w-sm"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-500 font-medium flex items-center gap-1.5">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Password updated successfully
        </p>
      )}

      <Button type="submit" size="sm" loading={pending}>
        Update password
      </Button>
    </form>
  )
}
