'use client'

import { useActionState } from 'react'
import { loginAction, type AuthActionState } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'

const initialState: AuthActionState = {}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        required
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
      />
      <Button type="submit" loading={pending} className="w-full mt-2" size="lg">
        Sign in
      </Button>
    </form>
  )
}
