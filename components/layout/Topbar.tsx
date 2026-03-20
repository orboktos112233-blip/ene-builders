'use client'

import { logoutAction } from '@/app/actions/auth'
import { useSidebar } from './SidebarContext'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { toggle } = useSidebar()

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-gray-200/80 flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Hamburger menu — mobile only */}
        <button
          type="button"
          onClick={toggle}
          className="lg:hidden -ml-1 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          Sign out
        </button>
      </form>
    </header>
  )
}
