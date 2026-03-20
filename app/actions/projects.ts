'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { generateProjectCode } from '@/lib/projects/code'
import type { ProjectStatus } from '@/types/database'

export interface ProjectActionState {
  error?: string
}

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  address: z.string().optional(),
  status: z.enum(['planning', 'demolition', 'framing', 'finishing', 'completed']),
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

  revalidatePath('/dashboard/projects')
  redirect(`/dashboard/projects/${data.id}`)
}

const updateStatusSchema = z.object({
  project_id: z.string().uuid(),
  status: z.enum(['planning', 'demolition', 'framing', 'finishing', 'completed']),
})

export async function updateProjectStatusAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  await requireRole(['admin', 'project_manager'])

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

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  revalidatePath('/dashboard/projects')
  revalidatePath('/dashboard')

  return {}
}
