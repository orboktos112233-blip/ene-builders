'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/ui/Badge'
import { ChangeRoleForm } from './ChangeRoleForm'
import { formatDate } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface Props {
  users: Profile[]
}

export function UserSearchList({ users }: Props) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? users.filter((u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      )
    : users

  return (
    <div>
      {/* Search bar */}
      <div className="px-6 py-3.5 border-b border-black/[0.05] bg-gray-50/60">
        <div className="relative max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-black/[0.08] rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-black/[0.04]">
        {filtered.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-6 py-4 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                <p className="text-xs text-gray-400">Joined {formatDate(user.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <RoleBadge role={user.role} />
              <ChangeRoleForm userId={user.id} currentRole={user.role} />
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-14">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600">No users found</p>
            <p className="text-xs text-gray-400 mt-1">
              {q ? `No results for "${query}"` : 'No users yet.'}
            </p>
            {q && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-4 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
