'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: 'planning',    label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'finishing',   label: 'Finishing' },
  { value: 'inspection',  label: 'Inspection' },
  { value: 'completed',   label: 'Completed' },
]

const iCls =
  'text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors text-gray-700 w-full'

interface FilterUser {
  id: string
  full_name: string
}

interface DashboardFiltersProps {
  showUserFilter: boolean
  users: FilterUser[]
}

export function DashboardFilters({ showUserFilter, users }: DashboardFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [from, setFrom]     = useState(searchParams.get('from') ?? '')
  const [to, setTo]         = useState(searchParams.get('to') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [userId, setUserId] = useState(searchParams.get('user_id') ?? '')

  const hasActive = !!(from || to || status || userId)

  function apply() {
    const params = new URLSearchParams()
    if (from)   params.set('from',    from)
    if (to)     params.set('to',      to)
    if (status) params.set('status',  status)
    if (userId) params.set('user_id', userId)
    router.push(`/dashboard${params.size > 0 ? `?${params.toString()}` : ''}`)
  }

  function clear() {
    setFrom(''); setTo(''); setStatus(''); setUserId('')
    router.push('/dashboard')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
          </svg>
          <span className="text-xs font-semibold text-gray-600">Filters</span>
          {hasActive && (
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">Active</span>
          )}
        </div>
        {hasActive && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
        {/* From date */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={iCls}
          />
        </div>

        {/* To date */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={iCls}
          />
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={iCls}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Team member — only for admin/office */}
        {showUserFilter && (
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
              Team Member
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={iCls}
            >
              <option value="">All members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Apply button */}
        <div className={showUserFilter ? '' : 'sm:col-start-4 lg:col-start-5'}>
          <label className="text-[10px] font-semibold text-transparent uppercase tracking-widest block mb-1.5">
            &nbsp;
          </label>
          <button
            type="button"
            onClick={apply}
            className="w-full text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors active:scale-[0.97]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
