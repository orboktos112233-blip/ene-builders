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
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] select-none',
          {
            // Primary — deep calm navy
            'bg-[#1C3FAA] text-white hover:bg-[#162F82] focus-visible:ring-[#1C3FAA] focus-visible:ring-offset-2': variant === 'primary',
            // Secondary — clean white with warm border
            'bg-white text-[#374151] border border-[#E3E1DC] hover:bg-[#F5F4F0] focus-visible:ring-[#1C3FAA]': variant === 'secondary',
            // Ghost — minimal, no border
            'text-[#6B7280] hover:bg-[#EDEBE6] hover:text-[#374151] focus-visible:ring-[#9CA3AF]': variant === 'ghost',
            // Danger — subdued red
            'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus-visible:ring-[#DC2626] focus-visible:ring-offset-2': variant === 'danger',
          },
          {
            'text-xs px-3.5 py-1.5 gap-1.5 rounded-md': size === 'sm',
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
