'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

export interface SectionActionState {
  error?: string
}

// ── Add Section ──────────────────────────────────────────────

const addSectionSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Section name is required').max(100),
})

export async function addSectionAction(
  _prev: SectionActionState,
  formData: FormData
): Promise<SectionActionState> {
  await requireRole(['admin', 'project_manager'])

  const parsed = addSectionSchema.safeParse({
    project_id: formData.get('project_id'),
    name: formData.get('name'),
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  // Get next display_order for this project
  const { data: existing } = await supabase
    .from('project_sections')
    .select('display_order')
    .eq('project_id', parsed.data.project_id)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0
    ? ((existing[0] as { display_order: number }).display_order + 1)
    : 0

  const { error } = await supabase.from('project_sections').insert({
    project_id: parsed.data.project_id,
    name: parsed.data.name,
    display_order: nextOrder,
  })

  if (error) {
    if (error.code === '23505') return { error: 'A section with this name already exists.' }
    return { error: 'Failed to add section.' }
  }

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}


// ── Rename Section ───────────────────────────────────────────

const renameSectionSchema = z.object({
  section_id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Section name is required').max(100),
})

export async function renameSectionAction(
  _prev: SectionActionState,
  formData: FormData
): Promise<SectionActionState> {
  await requireRole(['admin', 'project_manager'])

  const parsed = renameSectionSchema.safeParse({
    section_id: formData.get('section_id'),
    project_id: formData.get('project_id'),
    name: formData.get('name'),
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('project_sections')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.section_id)

  if (error) {
    if (error.code === '23505') return { error: 'A section with this name already exists.' }
    return { error: 'Failed to rename section.' }
  }

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}


// ── Delete Section ───────────────────────────────────────────

const deleteSectionSchema = z.object({
  section_id: z.string().uuid(),
  project_id: z.string().uuid(),
})

export async function deleteSectionAction(
  _prev: SectionActionState,
  formData: FormData
): Promise<SectionActionState> {
  await requireRole(['admin'])

  const parsed = deleteSectionSchema.safeParse({
    section_id: formData.get('section_id'),
    project_id: formData.get('project_id'),
  })

  if (!parsed.success) return { error: 'Invalid request.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('project_sections')
    .delete()
    .eq('id', parsed.data.section_id)

  if (error) return { error: 'Failed to delete section.' }

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}
