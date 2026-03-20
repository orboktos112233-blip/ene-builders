'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/log'
import { sendNotification } from '@/lib/notifications/send'

export interface ItemActionState {
  error?: string
}

// Reusable numeric parser for price/quantity fields
function parseNum(v: string | undefined | null): number | null {
  if (!v || v.trim() === '') return null
  const cleaned = v.replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

const numericField = z.string().optional().nullable().transform(parseNum)

const itemFields = {
  section_id:  z.string().uuid(),
  project_id:  z.string().uuid(),
  category:    z.string().max(200).optional(),
  worker:      z.string().max(200).optional(),
  material:    z.string().max(500).optional(),
  quantity:    numericField,
  unit:        z.string().max(50).optional(),
  unit_price:  numericField,
  total_price: numericField,
  vendor:      z.string().max(200).optional(),
  status:      z.string().max(100).optional(),
  notes:       z.string().max(2000).optional(),
}

// If total_price is not supplied, compute it from quantity × unit_price
function computeTotal(quantity: number | null, unit_price: number | null, total_price: number | null): number | null {
  if (total_price != null) return total_price
  if (quantity != null && unit_price != null) {
    return Math.round(quantity * unit_price * 100) / 100
  }
  return null
}

// ── Add Item ─────────────────────────────────────────────────

const addItemSchema = z.object(itemFields)

export async function addItemAction(
  _prev: ItemActionState,
  formData: FormData
): Promise<ItemActionState> {
  const profile = await requireRole(['admin', 'project_manager'])

  const raw = Object.fromEntries(formData)
  const parsed = addItemSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('project_items')
    .select('display_order')
    .eq('section_id', parsed.data.section_id)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0
    ? ((existing[0] as { display_order: number }).display_order + 1)
    : 0

  const total_price = computeTotal(parsed.data.quantity, parsed.data.unit_price, parsed.data.total_price)

  const { error } = await supabase.from('project_items').insert({
    project_id:  parsed.data.project_id,
    section_id:  parsed.data.section_id,
    category:    parsed.data.category  || null,
    worker:      parsed.data.worker    || null,
    material:    parsed.data.material  || null,
    quantity:    parsed.data.quantity,
    unit:        parsed.data.unit      || null,
    unit_price:  parsed.data.unit_price,
    total_price,
    vendor:      parsed.data.vendor    || null,
    status:      parsed.data.status    || null,
    notes:       parsed.data.notes     || null,
    display_order: nextOrder,
  })

  if (error) return { error: 'Failed to add item.' }

  await logActivity({
    user_id:     profile.id,
    action:      'item_added',
    description: `Added item "${parsed.data.material || parsed.data.category || 'item'}"`,
    project_id:  parsed.data.project_id,
    entity_type: 'item',
    metadata:    { section_id: parsed.data.section_id },
  })

  const { data: projItemRow } = await supabase
    .from('projects').select('project_code').eq('id', parsed.data.project_id).single()
  const itemCode = (projItemRow as { project_code: string } | null)?.project_code ?? ''
  await sendNotification({
    actor:       { id: profile.id, full_name: profile.full_name },
    projectId:   parsed.data.project_id,
    projectCode: itemCode,
    type:        'item_added',
    message:     `${profile.full_name} added a new item to ${itemCode}`,
  })

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}


// ── Update Item ───────────────────────────────────────────────

const updateItemSchema = z.object({
  item_id:     z.string().uuid(),
  project_id:  z.string().uuid(),
  category:    z.string().max(200).optional(),
  worker:      z.string().max(200).optional(),
  material:    z.string().max(500).optional(),
  quantity:    numericField,
  unit:        z.string().max(50).optional(),
  unit_price:  numericField,
  total_price: numericField,
  vendor:      z.string().max(200).optional(),
  status:      z.string().max(100).optional(),
  notes:       z.string().max(2000).optional(),
})

export async function updateItemAction(
  _prev: ItemActionState,
  formData: FormData
): Promise<ItemActionState> {
  await requireRole(['admin', 'project_manager', 'office'])

  const raw = Object.fromEntries(formData)
  const parsed = updateItemSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const total_price = computeTotal(parsed.data.quantity, parsed.data.unit_price, parsed.data.total_price)

  const supabase = await createClient()
  const { error } = await supabase
    .from('project_items')
    .update({
      category:    parsed.data.category   || null,
      worker:      parsed.data.worker     || null,
      material:    parsed.data.material   || null,
      quantity:    parsed.data.quantity,
      unit:        parsed.data.unit       || null,
      unit_price:  parsed.data.unit_price,
      total_price,
      vendor:      parsed.data.vendor     || null,
      status:      parsed.data.status     || null,
      notes:       parsed.data.notes      || null,
    })
    .eq('id', parsed.data.item_id)

  if (error) return { error: 'Failed to update item.' }

  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`)
  return {}
}


// ── Delete Item ───────────────────────────────────────────────

export async function deleteItemAction(
  _prev: ItemActionState,
  formData: FormData
): Promise<ItemActionState> {
  await requireRole(['admin'])

  const item_id   = formData.get('item_id') as string
  const project_id = formData.get('project_id') as string
  if (!item_id || !project_id) return { error: 'Invalid request.' }

  const supabase = await createClient()
  const { error } = await supabase.from('project_items').delete().eq('id', item_id)

  if (error) return { error: 'Failed to delete item.' }

  revalidatePath(`/dashboard/projects/${project_id}`)
  return {}
}
