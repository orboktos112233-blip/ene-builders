'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveMediaRecordAction, deleteMediaAction } from '@/app/actions/media'
import type { MediaFile, MediaCategory } from '@/types/database'

const MEDIA_CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: 'progress',     label: 'Progress' },
  { value: 'before',       label: 'Before' },
  { value: 'after',        label: 'After' },
  { value: 'final_result', label: 'Final Result' },
  { value: 'other',        label: 'Other' },
]

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-media/${path}`
}

function isVideo(fileType: string): boolean {
  return fileType.startsWith('video/')
}

interface MediaThumbnailProps {
  file: MediaFile
  canDelete: boolean
  onDelete: (file: MediaFile) => void
  deleting: boolean
}

function MediaThumbnail({ file, canDelete, onDelete, deleting }: MediaThumbnailProps) {
  const [open, setOpen] = useState(false)
  const url = publicUrl(file.file_path)

  return (
    <>
      <div className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-square">
        {isVideo(file.file_type) ? (
          <video
            src={url}
            className="w-full h-full object-cover"
            onClick={() => setOpen(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={file.file_name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setOpen(true)}
          />
        )}

        {/* Overlay: category badge + delete */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            <span className="text-[10px] font-semibold text-white/80 bg-black/30 rounded px-1.5 py-0.5 capitalize">
              {file.category.replace('_', ' ')}
            </span>
            {canDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(file)}
                className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {isVideo(file.file_type) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {isVideo(file.file_type) ? (
            <video src={url} controls className="max-h-[90vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.file_name} className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}

interface ProjectMediaSectionProps {
  projectId: string
  files: MediaFile[]
  canUpload: boolean
  canDelete: boolean
}

export function ProjectMediaSection({
  projectId,
  files,
  canUpload,
  canDelete,
}: ProjectMediaSectionProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [category, setCategory] = useState<MediaCategory>('progress')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    let anyError = false

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop() ?? ''
      const path = `${projectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('project-media')
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
        file_type: file.type,
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
      bucket: 'project-media',
    })
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Project Media</h3>
          <p className="text-xs text-gray-400 mt-0.5">Photos and videos from the project site</p>
        </div>
        {canUpload && (
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MediaCategory)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600"
            >
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '+ Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />
          </div>
        )}
      </div>

      {/* Upload zone (drag & drop) */}
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
            {dragOver ? 'Drop to upload' : 'Drag photos or videos here'}
          </p>
        </div>
      )}

      {uploadError && (
        <p className="mx-6 mt-2 text-xs text-red-500">{uploadError}</p>
      )}

      {/* Grid */}
      <div className="px-6 pb-6 pt-4">
        {files.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400 font-medium">No media uploaded yet</p>
            {canUpload && (
              <p className="text-xs text-gray-300 mt-1">Upload photos and videos using the button above</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {files.map((file) => (
              <MediaThumbnail
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
