'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { generateProjectCode } from '@/lib/projects/code'
import type { ParsedProjectFile } from '@/lib/import/parser'

export interface ImportActionState {
  error?: string
}

const importSchema = z.object({
  project_name: z.string().min(1, 'Project name is required').max(300),
  file_name: z.string().min(1),
  parsed_data: z.string().min(1),   // JSON-serialised ParsedProjectFile
})

// Receives the pre-parsed project data from the client,
// creates the project, sections, and items, records the import run,
// then redirects to the new project.
export async function importProjectAction(
  _prev: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  const profile = await requireRole(['admin', 'office'])

  const raw = {
    project_name: formData.get('project_name'),
    file_name: formData.get('file_name'),
    parsed_data: formData.get('parsed_data'),
  }

  const parsed = importSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let parsedFile: ParsedProjectFile
  try {
    parsedFile = JSON.parse(parsed.data.parsed_data) as ParsedProjectFile
  } catch {
    return { error: 'Invalid import data. Please try uploading again.' }
  }

  // Diagnostic: log what the parser returned
  console.log('[import] sections:', parsedFile.sections.length)
  console.log('[import] total items:', parsedFile.sections.reduce((n, s) => n + s.items.length, 0))
  console.log('[import] section names:', parsedFile.sections.map((s) => s.name))

  const supabase = await createClient()
  const project_code = await generateProjectCode(supabase)

  // ── 1. Create project ─────────────────────────────────────
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .insert({
      project_code,
      name: parsed.data.project_name,
      status: 'planning',
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (projectError || !projectData) {
    console.error('[import] project insert failed:', projectError)
    return { error: `Failed to create project: ${projectError?.message ?? 'unknown error'}` }
  }

  const projectId = (projectData as { id: string }).id
  let sectionsCreated = 0
  let itemsCreated = 0
  const sectionErrors: string[] = []

  // ── 2. Create sections and items ─────────────────────────
  for (const section of parsedFile.sections) {
    const { data: sectionData, error: sectionError } = await supabase
      .from('project_sections')
      .insert({
        project_id: projectId,
        name: section.name,
        display_order: section.display_order,
      })
      .select('id')
      .single()

    if (sectionError || !sectionData) {
      console.error(`[import] section "${section.name}" insert failed:`, sectionError)
      sectionErrors.push(`Section "${section.name}": ${sectionError?.message ?? 'unknown error'}`)
      continue
    }

    sectionsCreated++
    const sectionId = (sectionData as { id: string }).id

    if (section.items.length === 0) continue

    const itemRows = section.items.map((item) => ({
      project_id: projectId,
      section_id: sectionId,
      category:     item.category     || null,
      worker:       item.worker       || null,
      material:     item.material     || null,
      quantity:     item.quantity,
      raw_quantity: item.raw_quantity || null,
      unit:         item.unit         || null,
      unit_price:   item.unit_price,
      total_price:  item.total_price,
      vendor:       item.vendor       || null,
      status:       item.status       || null,
      notes:        item.notes        || null,
      display_order: item.display_order,
    }))

    const { error: itemsError, count } = await supabase
      .from('project_items')
      .insert(itemRows)

    if (itemsError) {
      console.error(`[import] items insert failed for section "${section.name}":`, itemsError)
      sectionErrors.push(`Items for "${section.name}": ${itemsError.message}`)
    } else {
      itemsCreated += section.items.length
    }
  }

  // If every section failed, abort and clean up
  if (sectionsCreated === 0 && parsedFile.sections.length > 0) {
    await supabase.from('projects').delete().eq('id', projectId)
    const firstError = sectionErrors[0] ?? 'Unknown error'
    return { error: `Import failed — could not create sections. ${firstError}` }
  }

  // ── 3. Record import run ──────────────────────────────────
  const { error: runError } = await supabase.from('project_import_runs').insert({
    project_id: projectId,
    imported_by: profile.id,
    source_file_name: parsed.data.file_name,
    source_file_path: null,
    total_rows_found: parsedFile.totalRowsFound,
    sections_created: sectionsCreated,
    items_created: itemsCreated,
    total_rows_skipped: parsedFile.totalRowsSkipped,
    empty_rows_skipped: parsedFile.emptyRowsSkipped,
    parse_warnings: parsedFile.parseWarnings.length > 0
      ? parsedFile.parseWarnings.map((w) => ({ row_number: w.rowNumber, message: w.message }))
      : null,
    status: sectionErrors.length > 0 ? 'failed_partial' : 'completed',
  })

  if (runError) {
    console.error('[import] import_run insert failed:', runError)
    // Non-fatal — data was saved, just the audit record failed
  }

  console.log(`[import] done. sections=${sectionsCreated}, items=${itemsCreated}, errors=${sectionErrors.length}`)

  redirect(`/dashboard/projects/${projectId}?tab=sections`)
}
