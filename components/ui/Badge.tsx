import { cn } from '@/lib/utils'
import type { ProjectStatus, Role } from '@/types/database'

type BadgeVariant = 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red' | 'indigo'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-[3px] rounded-md text-[11px] font-semibold tracking-wide border',
        {
          'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]':                 variant === 'gray',
          'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]':                 variant === 'blue',
          'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]':                 variant === 'yellow',
          'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]':                 variant === 'orange',
          'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]':                 variant === 'green',
          'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]':                 variant === 'red',
          'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]':                 variant === 'indigo',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

const STATUS_VARIANTS: Record<ProjectStatus, BadgeVariant> = {
  planning:    'gray',
  in_progress: 'blue',
  finishing:   'orange',
  inspection:  'indigo',
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
  admin:           'indigo',
  office:          'blue',
  project_manager: 'blue',
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
  if (!status) return <span className="text-[#9CA3AF]">—</span>
  return (
    <Badge variant={resolveItemStatusVariant(status)}>
      {status}
    </Badge>
  )
}
