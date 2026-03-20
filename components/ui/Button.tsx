'use client'

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] select-none',
          {
            // Primary — violet gradient
            'bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 hover:to-violet-800 focus-visible:ring-violet-500': variant === 'primary',
            // Secondary — clean white
            'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-gray-300 shadow-sm': variant === 'secondary',
            // Ghost
            'text-gray-500 hover:bg-gray-100/80 hover:text-gray-700 focus-visible:ring-gray-300': variant === 'ghost',
            // Danger
            'bg-gradient-to-b from-red-500 to-red-700 text-white shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 focus-visible:ring-red-500': variant === 'danger',
          },
          {
            'text-xs px-3.5 py-1.5 gap-1.5 rounded-lg': size === 'sm',
            'text-sm px-4.5 py-2.5 gap-2':              size === 'md',
            'text-sm px-6 py-3 gap-2':                  size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
