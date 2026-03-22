'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { canManageUsers, canImportProjects, canViewActivity, canViewReports, canViewAnalytics } from '@/lib/auth/permissions'
import { Avatar } from '@/components/ui/Avatar'
import { useSidebar } from './SidebarContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  office: 'Office',
  project_manager: 'Project Manager',
  worker: 'Worker',
  client: 'Client',
}

const HomeIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)

const ProjectsIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
  </svg>
)

const UsersIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
)

const ImportIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const ActivityIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h2.25m0 0 2.25-4.5m-2.25 4.5 2.25 4.5m2.25-4.5h2.25m0 0 2.25-3m-2.25 3 2.25 3m2.25-3h3" />
  </svg>
)

const ReportsIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)

const AnalyticsIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
)

const MessagesIcon = () => (
  <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
  </svg>
)

// ── Shared nav content ────────────────────────────────────────

interface NavItem {
  label: string
  href:  string
  icon:  React.ReactNode
  badge?: number
}

function SidebarContent({ profile, unreadMessages, onClose }: { profile: Profile; unreadMessages?: number; onClose: () => void }) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { label: 'Dashboard',  href: '/dashboard',          icon: <HomeIcon /> },
    { label: 'Projects',   href: '/dashboard/projects', icon: <ProjectsIcon /> },
    { label: 'Messages',   href: '/dashboard/messages', icon: <MessagesIcon />, badge: unreadMessages },
    ...(canImportProjects(profile.role) ? [{ label: 'Import',   href: '/dashboard/import',   icon: <ImportIcon /> }]   : []),
    ...(canViewActivity(profile.role)   ? [{ label: 'Activity', href: '/dashboard/activity', icon: <ActivityIcon /> }] : []),
    ...(canViewAnalytics(profile.role)  ? [{ label: 'Analytics', href: '/dashboard/analytics', icon: <AnalyticsIcon /> }] : []),
    ...(canViewReports(profile.role)    ? [{ label: 'Reports',   href: '/dashboard/reports',  icon: <ReportsIcon /> }]  : []),
    ...(canManageUsers(profile.role)    ? [{ label: 'Users',    href: '/dashboard/users',    icon: <UsersIcon /> }]    : []),
  ]

  return (
    <>
      {/* ── Brand ── */}
      <div className="h-[60px] flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[9px] bg-[#1C3FAA] flex items-center justify-center shrink-0">
            <svg className="w-[15px] h-[15px] text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold text-white tracking-tight">ENE Builders</span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'relative flex items-center gap-3 px-3 py-[9px] rounded-lg text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-[#71717A] hover:bg-white/[0.04] hover:text-[#D4D4D8]'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#3B82F6] rounded-r-full" />
              )}
              <span className={cn('shrink-0 transition-colors', isActive ? 'text-[#3B82F6]' : 'text-[#52525B]')}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#3B82F6] text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── User ── */}
      <div className="px-3 pb-4 shrink-0">
        <div className="h-px bg-white/[0.06] mb-3" />
        <Link
          href="/dashboard/profile"
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all duration-150',
            pathname === '/dashboard/profile' ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
          )}
        >
          <Avatar name={profile.full_name} avatarUrl={profile.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#E4E4E7] truncate leading-tight">{profile.full_name}</p>
            <p className="text-[11px] text-[#52525B] mt-0.5 truncate">{ROLE_LABELS[profile.role] ?? profile.role}</p>
          </div>
          <svg className="w-3 h-3 text-[#52525B] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </>
  )
}

// ── Exported Sidebar ──────────────────────────────────────────

export function Sidebar({ profile, unreadMessages }: { profile: Profile; unreadMessages?: number }) {
  const { open, close } = useSidebar()

  return (
    <>
      {/* ── Mobile overlay ── */}
      <div className={cn('fixed inset-0 z-40 lg:hidden', open ? 'visible' : 'invisible')}>
        <div
          className={cn('absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
          onClick={close}
          aria-hidden
        />
        <aside className={cn(
          'absolute inset-y-0 left-0 w-[220px] bg-[#0C0C0E] flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}>
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-3.5 p-1.5 rounded-lg text-[#52525B] hover:text-[#D4D4D8] hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <SidebarContent profile={profile} unreadMessages={unreadMessages} onClose={close} />
        </aside>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col w-[220px] shrink-0 bg-[#0C0C0E]">
        <SidebarContent profile={profile} unreadMessages={unreadMessages} onClose={() => {}} />
      </aside>
    </>
  )
}
