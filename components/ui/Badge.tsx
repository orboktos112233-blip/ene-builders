import { cn } from '@/lib/utils'
import type { ProjectStatus, Role } from '@/types/database'

type BadgeVariant = 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-gray-100 text-gray-700': variant === 'gray',
          'bg-blue-100 text-blue-700': variant === 'blue',
          'bg-yellow-100 text-yellow-700': variant === 'yellow',
          'bg-orange-100 text-orange-700': variant === 'orange',
          'bg-green-100 text-green-700': variant === 'green',
          'bg-red-100 text-red-700': variant === 'red',
          'bg-purple-100 text-purple-700': variant === 'purple',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

const STATUS_VARIANTS: Record<ProjectStatus, BadgeVariant> = {
  planning: 'blue',
  demolition: 'orange',
  framing: 'yellow',
  finishing: 'purple',
  completed: 'green',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  demolition: 'Demolition',
  framing: 'Framing',
  finishing: 'Finishing',
  completed: 'Completed',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const ROLE_VARIANTS: Record<Role, BadgeVariant> = {
  admin: 'red',
  office: 'blue',
  project_manager: 'purple',
  worker: 'yellow',
  client: 'gray',
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  office: 'Office',
  project_manager: 'Project Manager',
  worker: 'Worker',
  client: 'Client',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={ROLE_VARIANTS[role]}>
      {ROLE_LABELS[role]}
    </Badge>
  )
}

// Maps free-text status strings to badge color.
// Status values are not an enum — anything can be stored.
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
