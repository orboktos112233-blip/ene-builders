'use client'

import { useActionState, useEffect, useRef } from 'react'
import { updateNameAction, type ProfileActionState } from '@/app/actions/profile'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const initial: ProfileActionState = {}

export function UpdateNameForm({ currentName }: { currentName: string }) {
  const [state, action, pending] = useActionState(updateNameAction, initial)
  const formRef = useRef<HTMLFormElement>(null)

  // Keep input in sync after successful save (the page revalidates server-side,
  // but the client needs a hint that the save landed)
  const saved = state.success && !pending

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div>
        <label htmlFor="full_name" className="block text-xs font-semibold text-gray-600 mb-1.5">
          Full Name
        </label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={currentName}
          placeholder="Your full name"
          required
          minLength={2}
          maxLength={100}
          className="max-w-sm"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-500 font-medium">{state.error}</p>
      )}

      {saved && (
        <p className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Name updated successfully
        </p>
      )}

      <Button type="submit" size="sm" loading={pending}>
        Save changes
      </Button>
    </form>
  )
}
