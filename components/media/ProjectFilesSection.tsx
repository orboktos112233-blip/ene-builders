'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveMediaRecordAction, deleteMediaAction } from '@/app/actions/media'
import type { MediaFile, MediaCategory } from '@/types/database'

const FILE_CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: 'plan',     label: 'Plan' },
  { value: 'contract', label: 'Contract' },
  { value: 'invoice',  label: 'Invoice' },
  { value: 'budget',   label: 'Budget' },
  { value: 'other',    label: 'Other' },
]

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-files/${path}`
}

// Derive a short badge label from MIME type
function fileTypeBadge(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'XLS'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT'
  if (mimeType.startsWith('text/')) return 'TXT'
  const ext = mimeType.split('/').pop()?.toUpperCase() ?? 'FILE'
  return ext.slice(0, 4)
}

function fileTypeColor(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'bg-red-100 text-red-700'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return 'bg-emerald-100 text-emerald-700'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'bg-blue-100 text-blue-700'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'bg-orange-100 text-orange-700'
  return 'bg-gray-100 text-gray-600'
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface FileRowProps {
  file: MediaFile
  canDelete: boolean
  onDelete: (file: MediaFile) => void
  deleting: boolean
}

function FileRow({ file, canDelete, onDelete, deleting }: FileRowProps) {
  const url = publicUrl(file.file_path)
  const badge = fileTypeBadge(file.file_type)
  const badgeColor = fileTypeColor(file.file_type)

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50/80 rounded-xl transition-colors group">
      {/* Type badge */}
      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${badgeColor}`}>
        {badge}
      </span>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-800 hover:text-violet-600 transition-colors truncate block"
        >
          {file.file_name}
        </a>
        <p className="text-xs text-gray-400 mt-0.5">
          <span className="capitalize">{file.category.replace('_', ' ')}</span>
          {file.file_size && <span> · {formatBytes(file.file_size)}</span>}
          <span> · {formatDate(file.created_at)}</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
          title="Open file"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
        {canDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete(file)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Delete file"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

interface ProjectFilesSectionProps {
  projectId: string
  files: MediaFile[]
  canUpload: boolean
  canDelete: boolean
}

export function ProjectFilesSection({
  projectId,
  files,
  canUpload,
  canDelete,
}: ProjectFilesSectionProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [category, setCategory] = useState<MediaCategory>('plan')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    let anyError = false

    for (const file of Array.from(fileList)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${projectId}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(path, file)

      if (uploadError) {
        setUploadError(uploadError.message)
        anyError = true
        continue
      }

      const result = await saveMediaRecordAction({
        project_id: projectId,
        file_path: path,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        category,
        description: null,
      })

      if (result.error) {
        setUploadError(result.error)
        anyError = true
      }
    }

    setUploading(false)
    if (!anyError) router.refresh()
  }, [projectId, category, router])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  async function handleDelete(file: MediaFile) {
    setDeletingId(file.id)
    await deleteMediaAction({
      file_id: file.id,
      project_id: projectId,
      file_path: file.file_path,
      bucket: 'project-files',
    })
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Project Files</h3>
          <p className="text-xs text-gray-400 mt-0.5">Plans, contracts, invoices, and other documents</p>
        </div>
        {canUpload && (
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MediaCategory)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600"
            >
              {FILE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '+ Upload File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt,.txt,.png,.jpg,.jpeg"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />
          </div>
        )}
      </div>

      {/* Drag zone */}
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mx-6 mt-4 mb-2 border-2 border-dashed rounded-xl py-3 text-center transition-colors ${
            dragOver ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50/50'
          }`}
        >
          <p className="text-xs text-gray-400">
            {dragOver ? 'Drop to upload' : 'Drag files here — PDF, Excel, Word, CSV…'}
          </p>
        </div>
      )}

      {uploadError && (
        <p className="mx-6 mt-2 text-xs text-red-500">{uploadError}</p>
      )}

      {/* File list */}
      <div className="px-2 pb-4 pt-2">
        {files.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400 font-medium">No project files yet</p>
            {canUpload && (
              <p className="text-xs text-gray-300 mt-1">Upload plans, contracts, and other documents above</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                canDelete={canDelete}
                onDelete={handleDelete}
                deleting={deletingId === file.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
