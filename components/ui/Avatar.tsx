import { cn } from '@/lib/utils'

// Deterministic color bucket from the person's name — same name always same color.
function nameColor(name: string): string {
  const palette = [
    'bg-indigo-500', 'bg-violet-500', 'bg-blue-500',  'bg-cyan-600',
    'bg-teal-500',   'bg-emerald-600','bg-orange-500', 'bg-rose-500',
    'bg-pink-500',   'bg-amber-600',
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
  if (members.length === 0) return <span className="text-xs text-gray-400">—</span>

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
        <span className="text-[11px] font-medium text-gray-400">+{extra}</span>
      )}
    </div>
  )
}
