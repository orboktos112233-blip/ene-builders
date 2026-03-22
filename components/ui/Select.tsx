import { cn } from '@/lib/utils'
import { type SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[#374151] leading-none">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'block w-full rounded-lg border border-[#E3E1DC] bg-[#FAFAF9] px-3.5 py-2.5 text-sm text-[#111018] shadow-none',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[#1C3FAA]/20 focus:border-[#1C3FAA]',
            'disabled:bg-[#F5F4F0] disabled:text-[#9CA3AF] disabled:cursor-not-allowed',
            error && 'border-[#DC2626] focus:ring-[#DC2626]/20 focus:border-[#DC2626]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export { Select }
