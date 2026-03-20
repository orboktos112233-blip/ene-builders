'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import type { ActivityLogWithProfile, ActivityAction } from '@/types/database'

// ── Action config ──────────────────────────────────────────────────────

interface ActionConfig {
  label: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
}

const FolderPlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
  </svg>
)
const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
  </svg>
)
const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
)
const ArrowPathIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)
const ListBulletIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
)
const PhotoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
)
const CheckBadgeIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.745 3.745 0 0 1 3.296-1.043A3.745 3.745 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
  </svg>
)
const UserPlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
  </svg>
)
const UserMinusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
  </svg>
)
const ArrowDownTrayIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const ACTION_CONFIG: Record<ActivityAction, ActionConfig> = {
  project_created:  { label: 'Project Created',   icon: <FolderPlusIcon />,   iconBg: 'bg-emerald-100',  iconColor: 'text-emerald-600' },
  project_updated:  { label: 'Project Updated',   icon: <PencilIcon />,        iconBg: 'bg-blue-100',     iconColor: 'text-blue-600'    },
  project_deleted:  { label: 'Project Deleted',   icon: <TrashIcon />,         iconBg: 'bg-red-100',      iconColor: 'text-red-500'     },
  status_changed:   { label: 'Status Changed',    icon: <ArrowPathIcon />,     iconBg: 'bg-amber-100',    iconColor: 'text-amber-600'   },
  phase_updated:    { label: 'Phase Updated',     icon: <ListBulletIcon />,    iconBg: 'bg-violet-100',   iconColor: 'text-violet-600'  },
  media_uploaded:   { label: 'File Uploaded',     icon: <PhotoIcon />,         iconBg: 'bg-violet-100',   iconColor: 'text-violet-600'  },
  media_deleted:    { label: 'File Deleted',      icon: <TrashIcon />,         iconBg: 'bg-rose-100',     iconColor: 'text-rose-500'    },
  photo_reviewed:   { label: 'Photo Reviewed',    icon: <CheckBadgeIcon />,    iconBg: 'bg-teal-100',     iconColor: 'text-teal-600'    },
  member_added:     { label: 'Member Added',      icon: <UserPlusIcon />,      iconBg: 'bg-cyan-100',     iconColor: 'text-cyan-600'    },
  member_removed:   { label: 'Member Removed',    icon: <UserMinusIcon />,     iconBg: 'bg-orange-100',   iconColor: 'text-orange-500'  },
  import_completed: { label: 'Import Completed',  icon: <ArrowDownTrayIcon />, iconBg: 'bg-slate-100',    iconColor: 'text-slate-500'   },
}

const ACTION_LABELS: Record<ActivityAction, string> = Object.fromEntries(
  Object.entries(ACTION_CONFIG).map(([k, v]) => [k, v.label])
) as Record<ActivityAction, string>

// ── Helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86_400_000)
  if (days  < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByDate(logs: ActivityLogWithProfile[]): { label: string; items: ActivityLogWithProfile[] }[] {
  const today     = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

  const groups: Record<string, ActivityLogWithProfile[]> = {}
  for (const log of logs) {
    const d = new Date(log.created_at); d.setHours(0, 0, 0, 0)
    let label: string
    if (d.getTime() === today.getTime())     label = 'Today'
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(log)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

// ── Props ──────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  logs: ActivityLogWithProfile[]
  allUsers: { id: string; full_name: string }[]
  allProjects: { id: string; project_code: string; name: string }[]
}

// ── Component ──────────────────────────────────────────────────────────

export function ActivityFeed({ logs, allUsers, allProjects }: ActivityFeedProps) {
  const [search,        setSearch]        = useState('')
  const [filterAction,  setFilterAction]  = useState<string>('')
  const [filterUser,    setFilterUser]    = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')

  const filtered = useMemo(() => {
    let result = logs
    if (filterAction)  result = result.filter((l) => l.action === filterAction)
    if (filterUser)    result = result.filter((l) => l.user_id === filterUser)
    if (filterProject) result = result.filter((l) => l.project_id === filterProject)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.description.toLowerCase().includes(q) ||
          l.profiles?.full_name.toLowerCase().includes(q) ||
          l.projects?.project_code.toLowerCase().includes(q) ||
          l.projects?.name.toLowerCase().includes(q)
      )
    }
    return result
  }, [logs, filterAction, filterUser, filterProject, search])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  const hasFilters = search || filterAction || filterUser || filterProject

  function clearFilters() {
    setSearch('')
    setFilterAction('')
    setFilterUser('')
    setFilterProject('')
  }

  return (
    <div className="space-y-5">
      {/* ── Filter bar ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search activity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 bg-gray-50/60 placeholder:text-gray-400"
            />
          </div>

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            {/* Action type filter */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/60 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            >
              <option value="">All actions</option>
              {(Object.entries(ACTION_LABELS) as [ActivityAction, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* User filter */}
            {allUsers.length > 0 && (
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/60 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
              >
                <option value="">All users</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            )}

            {/* Project filter */}
            {allProjects.length > 0 && (
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/60 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
              >
                <option value="">All projects</option>
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_code} – {p.name}</option>
                ))}
              </select>
            )}

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Feed ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-16 text-center">
          <p className="text-sm text-gray-400">
            {hasFilters ? 'No activity matches your filters.' : 'No activity yet.'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-xs text-violet-600 hover:text-violet-700 font-medium">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label}>
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  {label}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Cards */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                {items.map((log, idx) => {
                  const cfg = ACTION_CONFIG[log.action]
                  return (
                    <div key={log.id} className={cn('flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors', idx === 0 && 'rounded-t-2xl', idx === items.length - 1 && 'rounded-b-2xl')}>
                      {/* Action icon */}
                      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.iconBg, cfg.iconColor)}>
                        {cfg.icon}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                              {log.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {log.profiles && (
                                <div className="flex items-center gap-1.5">
                                  <Avatar
                                    name={log.profiles.full_name}
                                    avatarUrl={log.profiles.avatar_url}
                                    size="xs"
                                  />
                                  <span className="text-xs text-gray-500">{log.profiles.full_name}</span>
                                </div>
                              )}
                              {log.projects && (
                                <>
                                  {log.profiles && <span className="text-gray-300 text-xs">·</span>}
                                  <Link
                                    href={`/dashboard/projects/${log.project_id}`}
                                    className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="font-mono">{log.projects.project_code}</span>
                                    <span className="text-violet-400/70">·</span>
                                    <span>{log.projects.name}</span>
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Time + badge */}
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">
                              {formatRelativeTime(log.created_at)}
                            </span>
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', cfg.iconBg, cfg.iconColor, 'border-transparent')}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Count */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-center pb-2">
          Showing {filtered.length} of {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </p>
      )}
    </div>
  )
}
