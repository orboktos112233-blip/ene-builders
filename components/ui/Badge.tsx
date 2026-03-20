import { cn } from '@/lib/utils'
import type { ProjectStatus, Role } from '@/types/database'

type BadgeVariant = 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red' | 'purple' | 'violet'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-semibold tracking-wide border',
        {
          'bg-gray-100 text-gray-600 border-gray-200/60':       variant === 'gray',
          'bg-sky-50 text-sky-700 border-sky-200/60':           variant === 'blue',
          'bg-amber-50 text-amber-700 border-amber-200/60':     variant === 'yellow',
          'bg-orange-50 text-orange-700 border-orange-200/60':  variant === 'orange',
          'bg-emerald-50 text-emerald-700 border-emerald-200/60': variant === 'green',
          'bg-red-50 text-red-700 border-red-200/60':           variant === 'red',
          'bg-purple-50 text-purple-700 border-purple-200/60':  variant === 'purple',
          'bg-violet-50 text-violet-700 border-violet-200/60':  variant === 'violet',
        },
        className
      )}
    >
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', {
        'bg-gray-400':    variant === 'gray',
        'bg-sky-500':     variant === 'blue',
        'bg-amber-500':   variant === 'yellow',
        'bg-orange-400':  variant === 'orange',
        'bg-emerald-500': variant === 'green',
        'bg-red-400':     variant === 'red',
        'bg-purple-500':  variant === 'purple',
        'bg-violet-500':  variant === 'violet',
      })} />
      {children}
    </span>
  )
}

const STATUS_VARIANTS: Record<ProjectStatus, BadgeVariant> = {
  planning:    'gray',
  in_progress: 'blue',
  finishing:   'orange',
  inspection:  'purple',
  completed:   'green',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:    'Planning',
  in_progress: 'In Progress',
  finishing:   'Finishing',
  inspection:  'Inspection',
  completed:   'Completed',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const ROLE_VARIANTS: Record<Role, BadgeVariant> = {
  admin:           'violet',
  office:          'blue',
  project_manager: 'purple',
  worker:          'yellow',
  client:          'gray',
}

const ROLE_LABELS: Record<Role, string> = {
  admin:           'Admin',
  office:          'Office',
  project_manager: 'Project Manager',
  worker:          'Worker',
  client:          'Client',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={ROLE_VARIANTS[role]}>
      {ROLE_LABELS[role]}
    </Badge>
  )
}

function resolveItemStatusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase().trim()
  if (['done', 'complete', 'completed', 'finished'].includes(s)) return 'green'
  if (['in progress', 'in-progress', 'ongoing', 'started'].includes(s)) return 'blue'
  if (['pending', 'not started', 'waiting'].includes(s)) return 'yellow'
  if (['cancelled', 'canceled', 'n/a'].includes(s)) return 'gray'
  return 'gray'
}

export function ItemStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-300">—</span>
  return (
    <Badge variant={resolveItemStatusVariant(status)}>
      {status}
    </Badge>
  )
}
