'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { canManageUsers, canImportProjects } from '@/lib/auth/permissions'
import { Avatar } from '@/components/ui/Avatar'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const HomeIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.592 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)

const ProjectsIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
  </svg>
)

const UsersIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
)

const ImportIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  office: 'Office',
  project_manager: 'Project Manager',
  worker: 'Worker',
  client: 'Client',
}

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
    { label: 'Projects', href: '/dashboard/projects', icon: <ProjectsIcon /> },
  ]

  if (canImportProjects(profile.role)) {
    navItems.push({ label: 'Import Project', href: '/dashboard/import', icon: <ImportIcon /> })
  }

  if (canManageUsers(profile.role)) {
    navItems.push({ label: 'Users', href: '/dashboard/users', icon: <UsersIcon /> })
  }

  return (
    <aside className="w-60 shrink-0 bg-gray-950 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">ENE Builders</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-2">
          Menu
        </p>
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
              )}
            >
              <span className={cn('shrink-0 transition-colors', isActive ? 'text-indigo-400' : 'text-gray-600')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info — click to open profile */}
      <div className="px-3 py-4 border-t border-white/5">
        <Link
          href="/dashboard/profile"
          className={cn(
            'flex items-center gap-3 px-2 py-1.5 rounded-xl transition-all duration-150',
            pathname === '/dashboard/profile'
              ? 'bg-white/10'
              : 'hover:bg-white/5'
          )}
        >
          <Avatar
            name={profile.full_name}
            avatarUrl={profile.avatar_url}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate leading-tight">{profile.full_name}</p>
            <p className="text-xs text-gray-600 mt-0.5">{ROLE_LABELS[profile.role] ?? profile.role}</p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
