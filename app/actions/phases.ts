'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/session'
import type { PhaseName, PhaseStatus } from '@/types/database'

export interface PhaseActionState {
  error?: string
  success?: boolean
}

const phaseSchema = z.object({
  project_id: z.string().uuid(),
  phase: z.enum([
    'progress', 'demo', 'foundation', 'underground_plumbing',
    'framing', 'plumbing', 'electric', 'windows', 'black_paper',
    'ac', 'insulation', 'dry_wall', 'tapping', 'paint', 'floor',
    'hot_mop', 'tile', 'kitchen_installation', 'finish_materials_install',
  ]),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  notes: z.string().optional().nullable().transform((v) => v || null),
})

export async function updatePhaseAction(data: {
  project_id: string
  phase: PhaseName
  status: PhaseStatus
  notes?: string | null
}): Promise<PhaseActionState> {
  const profile = await requireAuth()

  const parsed = phaseSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Permission check: admin always; PM must be assigned to the project
  if (profile.role !== 'admin') {
    if (profile.role !== 'project_manager') {
      return { error: 'Not authorized to update construction phases.' }
    }
    const supabase = await createClient()
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', parsed.data.project_id)
      .eq('user_id', profile.id)
      .single()
    if (!assignment) {
      return { error: 'You must be assigned to this project to update its phases.' }
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('construction_phases').upsert(
    {
      project_id: parsed.data.project_id,
      phase:      parsed.data.phase,
      status:     parsed.data.status,
      notes:      parsed.data.notes,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,phase' }
  )

  if (error) {
    return { error: `Failed to update phase: ${error.message}` }
  }

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return { success: true }
}
