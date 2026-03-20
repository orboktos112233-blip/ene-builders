'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  getNotificationsAction,
  getUnreadCountAction,
  markAllReadAction,
} from '@/app/actions/notifications'
import type { Notification, NotificationType } from '@/types/database'

// ── Icon per notification type ──────────────────────────────────

function TypeIcon({ type }: { type: NotificationType }) {
  const cls = 'w-3.5 h-3.5'
  switch (type) {
    case 'photo_uploaded':
      return (
        <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      )
    case 'status_changed':
      return (
        <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      )
    case 'phase_updated':
      return (
        <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      )
    case 'item_added':
      return (
        <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      )
    case 'budget_updated':
      return (
        <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )
  }
}

const TYPE_COLORS: Record<NotificationType, string> = {
  photo_uploaded: 'bg-violet-100 text-violet-600',
  status_changed: 'bg-amber-100 text-amber-600',
  phase_updated:  'bg-blue-100 text-blue-600',
  item_added:     'bg-emerald-100 text-emerald-600',
  budget_updated: 'bg-orange-100 text-orange-600',
}

// ── Relative time ───────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ───────────────────────────────────────────────────

export function NotificationBell() {
  const [count,         setCount]         = useState(0)
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded,        setLoaded]        = useState(false)
  const [, startTransition]               = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  // ── Fetch unread count on mount + poll every 60s ──────────────
  useEffect(() => {
    let mounted = true
    async function refresh() {
      const n = await getUnreadCountAction()
      if (mounted) setCount(n)
    }
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // ── Close on outside click ────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── On bell click: load notifications and mark as read ────────
  function handleClick() {
    const opening = !open
    setOpen(opening)
    if (opening && !loaded) {
      startTransition(async () => {
        const notifs = await getNotificationsAction()
        setNotifications(notifs)
        setLoaded(true)
        if (count > 0) {
          await markAllReadAction()
          setCount(0)
        }
      })
    } else if (opening && count > 0) {
      startTransition(async () => {
        const notifs = await getNotificationsAction()
        setNotifications(notifs)
        await markAllReadAction()
        setCount(0)
      })
    }
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        className={cn(
          'relative p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
          open
            ? 'bg-gray-100 text-gray-700'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/80'
        )}
        aria-label="Notifications"
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-violet-600 text-white text-[9px] font-bold rounded-full px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] flex flex-col bg-white rounded-2xl border border-black/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.05] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Notifications</span>
              {count > 0 && (
                <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                  {count} new
                </span>
              )}
            </div>
            {notifications.some((n) => !n.is_read) && (
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await markAllReadAction()
                    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
                    setCount(0)
                  })
                }}
                className="text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {!loaded ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-5 h-5 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">Activity on your projects will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04]">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3.5 transition-colors',
                      !n.is_read ? 'bg-violet-50/40' : 'bg-white hover:bg-gray-50/60'
                    )}
                  >
                    {/* Type icon */}
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', TYPE_COLORS[n.type])}>
                      <TypeIcon type={n.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-snug', !n.is_read ? 'font-medium text-gray-900' : 'font-normal text-gray-700')}>
                        {n.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>

                    {/* Unread dot */}
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-black/[0.05] shrink-0 text-center">
              <p className="text-xs text-gray-400">Showing last {notifications.length} notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
