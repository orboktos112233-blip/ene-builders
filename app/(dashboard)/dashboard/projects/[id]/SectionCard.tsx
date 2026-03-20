'use client'

import { useState, useActionState } from 'react'
import { renameSectionAction, deleteSectionAction, type SectionActionState } from '@/app/actions/sections'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ItemsTable } from './ItemsTable'
import { AddItemForm } from './AddItemForm'
import { formatCurrency } from '@/lib/utils'
import { getItemTotal } from '@/types/database'
import type { SectionWithItems } from '@/types/database'

const initialState: SectionActionState = {}

interface SectionCardProps {
  section: SectionWithItems
  canManage: boolean
  canEdit: boolean
  canDelete: boolean
}

export function SectionCard({ section, canManage, canEdit, canDelete }: SectionCardProps) {
  const [open, setOpen] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [renameState, renameAction, renamePending] = useActionState(renameSectionAction, initialState)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSectionAction, initialState)

  const sectionTotal = section.project_items.reduce((sum, i) => {
    const t = getItemTotal(i)
    return sum + (t ?? 0)
  }, 0)
  const hasPricing = section.project_items.some((i) => getItemTotal(i) != null)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Section name / rename form */}
        {renaming ? (
          <form
            action={async (fd) => {
              await renameAction(fd)
              setRenaming(false)
            }}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="section_id" value={section.id} />
            <input type="hidden" name="project_id" value={section.project_id} />
            <Input
              name="name"
              defaultValue={section.name}
              autoFocus
              className="text-sm py-1 h-8"
              required
            />
            {renameState.error && (
              <span className="text-xs text-red-600">{renameState.error}</span>
            )}
            <Button type="submit" size="sm" loading={renamePending}>Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(false)}>Cancel</Button>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-800 truncate">{section.name}</span>
            <span className="text-xs text-gray-400 shrink-0">
              {section.project_items.length} item{section.project_items.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Actions */}
        {!renaming && (
          <div className="flex items-center gap-1 shrink-0">
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setShowAddItem((v) => !v); setOpen(true) }}
                className="text-xs"
              >
                + Add Item
              </Button>
            )}
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRenaming(true)}
                className="text-xs text-gray-400"
              >
                Rename
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between gap-4">
          <p className="text-sm text-red-700">
            Delete <strong>{section.name}</strong>? All {section.project_items.length} items will be permanently removed.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <form action={deleteAction}>
              <input type="hidden" name="section_id" value={section.id} />
              <input type="hidden" name="project_id" value={section.project_id} />
              {deleteState.error && (
                <span className="text-xs text-red-600 mr-2">{deleteState.error}</span>
              )}
              <Button type="submit" variant="danger" size="sm" loading={deletePending}>
                Delete Section
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Body */}
      {open && (
        <>
          {showAddItem && (
            <div className="border-b border-gray-100">
              <AddItemForm
                projectId={section.project_id}
                sectionId={section.id}
                onClose={() => setShowAddItem(false)}
              />
            </div>
          )}

          <ItemsTable
            items={section.project_items}
            projectId={section.project_id}
            canEdit={canEdit}
            canDelete={canDelete}
          />

          {/* Section footer: USD total */}
          {section.project_items.length > 0 && hasPricing && (
            <div className="px-4 py-2.5 border-t border-gray-100 flex justify-end items-center gap-2">
              <span className="text-xs text-gray-400">Section Total</span>
              <span className="text-sm font-semibold text-gray-800">{formatCurrency(sectionTotal)}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
