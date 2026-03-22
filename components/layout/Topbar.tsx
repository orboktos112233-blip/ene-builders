'use client'

import { logoutAction } from '@/app/actions/auth'
import { useSidebar } from './SidebarContext'
import { NotificationBell } from './NotificationBell'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { toggle } = useSidebar()

  return (
    <header className="h-[60px] bg-white border-b border-[#E3E1DC] flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="lg:hidden -ml-1 p-2 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#EDEBE6] transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-[15px] font-semibold text-[#111018] tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <div className="w-px h-4 bg-[#E3E1DC] mx-1" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs font-medium text-[#9CA3AF] hover:text-[#374151] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#EDEBE6]"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
