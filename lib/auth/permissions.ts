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
