import { cn } from '@/lib/utils'

// Deterministic calm color bucket — same name always same color.
function nameColor(name: string): string {
  // All muted, professional tones — no bright or playful colors
  const palette = [
    'bg-[#334155]', // slate-700
    'bg-[#1D4ED8]', // blue-700
    'bg-[#0369A1]', // sky-700
    'bg-[#0F766E]', // teal-700
    'bg-[#15803D]', // green-700
    'bg-[#6D28D9]', // violet-700 — only deep/muted
    'bg-[#1E40AF]', // blue-800
    'bg-[#374151]', // gray-700
    'bg-[#075985]', // sky-800
    'bg-[#166534]', // green-800
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const SIZES = {
  xs:  'w-6  h-6  text-[10px]',
  sm:  'w-8  h-8  text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-12 h-12 text-base',
}

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
}

export function Avatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  const sz = SIZES[size]

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover shrink-0', sz, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none',
        sz,
        nameColor(name),
        className,
      )}
      title={name}
    >
      {initials(name)}
    </div>
  )
}

// Compact stacked avatar row used in list views
interface AvatarStackProps {
  members: { id: string; full_name: string; avatar_url: string | null }[]
  max?: number
}

export function AvatarStack({ members, max = 3 }: AvatarStackProps) {
  if (members.length === 0) return <span className="text-xs text-[#9CA3AF]">—</span>

  const shown = members.slice(0, max)
  const extra = members.length - shown.length

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <Avatar
            key={m.id}
            name={m.full_name}
            avatarUrl={m.avatar_url}
            size="xs"
            className="ring-2 ring-white"
          />
        ))}
      </div>
      {extra > 0 && (
        <span className="text-[11px] font-medium text-[#9CA3AF]">+{extra}</span>
      )}
    </div>
  )
}
