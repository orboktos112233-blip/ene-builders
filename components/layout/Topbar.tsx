'use client'

import { logoutAction } from '@/app/actions/auth'
import { useSidebar } from './SidebarContext'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { toggle } = useSidebar()

  return (
    <header className="h-[60px] bg-white/80 backdrop-blur-md border-b border-black/[0.06] flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="lg:hidden -ml-1 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-[15px] font-semibold text-gray-900 tracking-tight">{title}</h1>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100/80"
        >
          Sign out
        </button>
      </form>
    </header>
  )
}
