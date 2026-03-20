'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { generateProjectCode } from '@/lib/projects/code'
import type { ProjectStatus } from '@/types/database'
import { logActivity } from '@/lib/activity/log'
import { sendNotification } from '@/lib/notifications/send'

export interface ProjectActionState {
  error?: string
  success?: boolean
}

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  address: z.string().optional(),
  status: z.enum(['planning', 'in_progress', 'finishing', 'inspection', 'completed']),
  start_date: z.string().optional(),
  estimated_end_date: z.string().optional(),
  budget_total: z
    .string()
    .optional()
    .transform((v) => (v && v !== '' ? parseFloat(v) : null)),
  client_name: z.string().optional(),
  client_email: z
    .string()
    .optional()
    .refine((v) => !v || v === '' || z.string().email().safeParse(v).success, {
      message: 'Invalid client email',
    }),
  client_phone: z.string().optional(),
})

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const profile = await requireRole(['admin', 'project_manager'])

  const raw = Object.fromEntries(formData)
  const parsed = createProjectSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const project_code = await generateProjectCode(supabase)

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...parsed.data,
      project_code,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Failed to create project. Please try again.' }
  }

  // If a PM creates the project, assign themselves to it automatically.
  if (profile.role === 'project_manager') {
    await supabase.from('project_assignments').insert({
      project_id: data.id,
      user_id: profile.id,
      assignment_role: 'project_manager',
    })
  }

  await logActivity({
    user_id:     profile.id,
    action:      'project_created',
    description: `Created project ${project_code}`,
    project_id:  data.id,
    entity_type: 'project',
    entity_id:   data.id,
  })

  revalidatePath('/dashboard/projects')
  redirect(`/dashboard/projects/${data.id}`)
}

const updateDetailsSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  // Empty strings from unset form fields must become null (not ''), otherwise
  // Postgres rejects them for date/text columns or they corrupt stored values.
  address:            z.string().optional().transform((v) => v || null),
  status: z.enum(['planning', 'in_progress', 'finishing', 'inspection', 'completed']),
  start_date:         z.string().optional().transform((v) => v || null),
  estimated_end_date: z.string().optional().transform((v) => v || null),
  budget_total: z
    .string()
    .optional()
    .transform((v) => (v && v !== '' ? parseFloat(v) : null)),
  client_name:  z.string().optional().transform((v) => v || null),
  client_email: z
    .string()
    .optional()
    .refine((v) => !v || v === '' || z.string().email().safeParse(v).success, {
      message: 'Invalid client email',
    })
    .transform((v) => v || null),
  client_phone: z.string().optional().transform((v) => v || null),
})

export async function updateProjectDetailsAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const profile = await requireRole(['admin', 'project_manager', 'office'])

  const raw = Object.fromEntries(formData)

  console.log('[updateProject] raw form data:', JSON.stringify(raw))

  const parsed = updateDetailsSchema.safeParse(raw)

  if (!parsed.success) {
    console.log('[updateProject] validation failed:', parsed.error.issues)
    return { error: parsed.error.issues[0].message }
  }

  const { project_id, ...fields } = parsed.data

  console.log('[updateProject] parsed payload:', JSON.stringify({ project_id, ...fields }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update(fields)
    .eq('id', project_id)

  if (error) {
    console.error('[updateProject] DB error:', error)
    return { error: `Update failed: ${error.message}` }
  }

  await logActivity({
    user_id:     profile.id,
    action:      'project_updated',
    description: `Updated project details`,
    project_id:  project_id,
    entity_type: 'project',
    entity_id:   project_id,
  })

  // Notify on budget change (budget_total is in parsed fields)
  if (fields.budget_total !== undefined) {
    const { data: projRow3 } = await supabase
      .from('projects').select('project_code').eq('id', project_id).single()
    const code3 = (projRow3 as { project_code: string } | null)?.project_code ?? ''
    await sendNotification({
      actor:       { id: profile.id, full_name: profile.full_name },
      projectId:   project_id,
      projectCode: code3,
      type:        'budget_updated',
      message:     `${profile.full_name} updated the budget for ${code3}`,
    })
  }

  revalidatePath(`/dashboard/projects/${project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')

  return { success: true }
}

const updateStatusSchema = z.object({
  project_id: z.string().uuid(),
  status: z.enum(['planning', 'in_progress', 'finishing', 'inspection', 'completed']),
})

export async function updateProjectStatusAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const profile = await requireRole(['admin', 'project_manager'])

  const parsed = updateStatusSchema.safeParse({
    project_id: formData.get('project_id'),
    status: formData.get('status'),
  })

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update({ status: parsed.data.status as ProjectStatus })
    .eq('id', parsed.data.project_id)

  if (error) {
    return { error: 'Failed to update status.' }
  }

  await logActivity({
    user_id:     profile.id,
    action:      'status_changed',
    description: `Changed status to ${parsed.data.status.replace('_', ' ')}`,
    project_id:  parsed.data.project_id,
    entity_type: 'project',
    entity_id:   parsed.data.project_id,
    metadata:    { status: parsed.data.status },
  })

  // Notify project stakeholders
  const { data: projRow } = await supabase
    .from('projects').select('project_code').eq('id', parsed.data.project_id).single()
  const code = (projRow as { project_code: string } | null)?.project_code ?? ''
  await sendNotification({
    actor:       { id: profile.id, full_name: profile.full_name },
    projectId:   parsed.data.project_id,
    projectCode: code,
    type:        'status_changed',
    message:     `${profile.full_name} changed ${code} status to ${parsed.data.status.replace(/_/g, ' ')}`,
  })

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')

  return {}
}

// ── Inline start date update — PM assignment enforced server-side ───────

export async function updateProjectStartDateAction(data: {
  project_id: string
  start_date: string | null
}): Promise<ProjectActionState> {
  const profile = await requireRole(['admin', 'project_manager'])

  if (!z.string().uuid().safeParse(data.project_id).success) {
    return { error: 'Invalid project.' }
  }

  const supabase = await createClient()

  if (profile.role === 'project_manager') {
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', data.project_id)
      .eq('user_id', profile.id)
      .single()

    if (!assignment) return { error: 'You are not assigned to this project.' }
  }

  const startDate = data.start_date && data.start_date !== '' ? data.start_date : null

  const { error } = await supabase
    .from('projects')
    .update({ start_date: startDate })
    .eq('id', data.project_id)

  if (error) return { error: 'Failed to update start date.' }

  revalidatePath(`/dashboard/projects/${data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')

  return { success: true }
}

// ── Inline status update — PM assignment enforced server-side ──────────

export async function updateProjectStatusInlineAction(data: {
  project_id: string
  status: ProjectStatus
}): Promise<ProjectActionState> {
  const profile = await requireRole(['admin', 'project_manager'])

  const parsed = updateStatusSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid status value.' }

  const supabase = await createClient()

  // PMs may only update status for projects they are assigned to
  if (profile.role === 'project_manager') {
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', data.project_id)
      .eq('user_id', profile.id)
      .single()

    if (!assignment) return { error: 'You are not assigned to this project.' }
  }

  const { error } = await supabase
    .from('projects')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.project_id)

  if (error) return { error: 'Failed to update status.' }

  await logActivity({
    user_id:     profile.id,
    action:      'status_changed',
    description: `Changed status to ${parsed.data.status.replace('_', ' ')}`,
    project_id:  parsed.data.project_id,
    entity_type: 'project',
    entity_id:   parsed.data.project_id,
    metadata:    { status: parsed.data.status },
  })

  const { data: projRow2 } = await supabase
    .from('projects').select('project_code').eq('id', parsed.data.project_id).single()
  const code2 = (projRow2 as { project_code: string } | null)?.project_code ?? ''
  await sendNotification({
    actor:       { id: profile.id, full_name: profile.full_name },
    projectId:   parsed.data.project_id,
    projectCode: code2,
    type:        'status_changed',
    message:     `${profile.full_name} changed ${code2} status to ${parsed.data.status.replace(/_/g, ' ')}`,
  })

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function deleteProjectAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const profile = await requireRole(['admin'])

  const projectId = formData.get('project_id') as string | null
  if (!projectId || !z.string().uuid().safeParse(projectId).success) {
    return { error: 'Invalid project ID.' }
  }

  const supabase = await createClient()

  // Collect media file paths for storage cleanup before the DB row is deleted
  const { data: mediaFiles } = await supabase
    .from('media_files')
    .select('file_path, file_type')
    .eq('project_id', projectId)

  // Delete project row — FK ON DELETE CASCADE handles:
  // project_sections → project_items, project_assignments, media_files, project_import_runs
  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) {
    return { error: `Failed to delete project: ${error.message}` }
  }

  // Storage cleanup (non-fatal — DB rows are already gone)
  if (mediaFiles && mediaFiles.length > 0) {
    const mediaPaths = (mediaFiles as { file_path: string; file_type: string }[])
      .filter((f) => f.file_type.startsWith('image/') || f.file_type.startsWith('video/'))
      .map((f) => f.file_path)
    const filePaths = (mediaFiles as { file_path: string; file_type: string }[])
      .filter((f) => !f.file_type.startsWith('image/') && !f.file_type.startsWith('video/'))
      .map((f) => f.file_path)

    if (mediaPaths.length > 0) await supabase.storage.from('project-media').remove(mediaPaths)
    if (filePaths.length > 0) await supabase.storage.from('project-files').remove(filePaths)
  }

  await logActivity({
    user_id:     profile.id,
    action:      'project_deleted',
    description: `Deleted project`,
    entity_type: 'project',
    entity_id:   projectId,
  })

  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')
  redirect('/dashboard/projects')
}
