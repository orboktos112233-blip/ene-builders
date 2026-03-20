import type { Role } from '@/types/database'

// Defines which roles can access which sections of the app.
// Used for sidebar visibility and route-level guards.
// RLS in Supabase is the enforcement layer — this controls UI only.

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  office: 'Office',
  project_manager: 'Project Manager',
  worker: 'Worker',
  client: 'Client',
}

export function canManageUsers(role: Role): boolean {
  return role === 'admin'
}

export function canCreateProject(role: Role): boolean {
  return role === 'admin' || role === 'project_manager'
}

export function canViewFinancials(role: Role): boolean {
  return role === 'admin' || role === 'office'
}

export function canManageAssignments(role: Role): boolean {
  return role === 'admin'
}

export function canEditProject(role: Role): boolean {
  return role === 'admin' || role === 'project_manager'
}

export function canImportProjects(role: Role): boolean {
  return role === 'admin' || role === 'office'
}

export function canManageSections(role: Role): boolean {
  return role === 'admin' || role === 'project_manager'
}

export function canManageItems(role: Role): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'office'
}

export function canDeleteItems(role: Role): boolean {
  return role === 'admin'
}

export function canUploadMedia(role: Role): boolean {
  return role === 'admin' || role === 'office' || role === 'project_manager' || role === 'worker'
}

export function canDeleteMedia(role: Role): boolean {
  return role === 'admin' || role === 'office' || role === 'project_manager'
}

export function canDeleteProject(role: Role): boolean {
  return role === 'admin'
}

// Phases: admin always; PM only when also assigned to the project (enforced in action)
export function canManagePhases(role: Role): boolean {
  return role === 'admin' || role === 'project_manager'
}

// Photo Live tab: visible to admin, PM, and workers (assigned users)
export function canUploadPhotoLive(role: Role): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'worker'
}

// Admin and PM can delete any live photo; workers can only delete their own (enforced in action + UI)
export function canDeleteAnyLivePhoto(role: Role): boolean {
  return role === 'admin' || role === 'project_manager'
}

// Only admin and assigned PM can mark photos as reviewed (PM assignment enforced in action)
export function canReviewLivePhoto(role: Role): boolean {
  return role === 'admin' || role === 'project_manager'
}

// Activity / audit log: visible to admin and office
export function canViewActivity(role: Role): boolean {
  return role === 'admin' || role === 'office'
}
