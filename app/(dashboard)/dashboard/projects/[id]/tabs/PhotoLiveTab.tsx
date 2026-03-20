'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveMediaRecordAction, deleteLivePhotoAction, reviewLivePhotoAction } from '@/app/actions/media'
import type { LivePhotoWithUploader } from '@/types/database'

// ── Helpers ────────────────────────────────────────────────────────────

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-media/${path}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function toDateKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA') // YYYY-MM-DD
}

function formatDateLabel(key: string): string {
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Photo Card ─────────────────────────────────────────────────────────

interface PhotoCardProps {
  file: LivePhotoWithUploader
  canDelete: boolean
  canReview: boolean
  onDelete: (file: LivePhotoWithUploader) => void
  onReview: (file: LivePhotoWithUploader, reviewed: boolean) => void
  deleting: boolean
  reviewing: boolean
}

function PhotoCard({ file, canDelete, canReview, onDelete, onReview, deleting, reviewing }: PhotoCardProps) {
  const [open, setOpen] = useState(false)
  const url = publicUrl(file.file_path)
  const uploaderName = file.profiles?.full_name ?? 'Unknown'
  const reviewerName = file.reviewer_profile?.full_name

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">

        {/* Photo */}
        <div
          className="relative aspect-[4/3] bg-gray-100 overflow-hidden cursor-zoom-in"
          onClick={() => setOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={file.file_name} className="w-full h-full object-cover" />

          {/* Review badge overlay — top left */}
          <div className="absolute top-2 left-2">
            {file.reviewed ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50/90 border border-emerald-200 rounded-full px-2 py-0.5 backdrop-blur-sm">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Reviewed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50/90 border border-orange-200 rounded-full px-2 py-0.5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                Not reviewed
              </span>
            )}
          </div>

          {/* Delete button — top right */}
          {canDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={(e) => { e.stopPropagation(); onDelete(file) }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Delete photo"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {(deleting || reviewing) && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Card footer */}
        <div className="px-3 py-2.5 flex flex-col gap-1.5 flex-1">
          {/* Uploader row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                {file.profiles?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.profiles.avatar_url} alt={uploaderName} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="text-[8px] font-bold text-violet-600">{avatarInitials(uploaderName)}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-gray-800 truncate">{uploaderName}</span>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(file.created_at)}</span>
          </div>

          {/* Caption */}
          {file.description && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{file.description}</p>
          )}

          {/* Reviewer info */}
          {file.reviewed && reviewerName && (
            <p className="text-[9px] text-emerald-600 truncate">
              Reviewed by {reviewerName}
              {file.reviewed_at && <> · {timeAgo(file.reviewed_at)}</>}
            </p>
          )}

          {/* Review action */}
          {canReview && (
            <button
              type="button"
              disabled={reviewing || deleting}
              onClick={() => onReview(file, !file.reviewed)}
              className={`mt-0.5 w-full text-[11px] font-semibold py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                file.reviewed
                  ? 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50'
                  : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {file.reviewed ? 'Unmark reviewed' : '✓ Mark as reviewed'}
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={file.file_name}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 rounded-xl px-4 py-2.5 text-center space-y-0.5 max-w-xs">
            <p className="text-sm font-semibold text-white">{uploaderName}</p>
            <p className="text-xs text-white/60">{new Date(file.created_at).toLocaleString()}</p>
            {file.description && <p className="text-xs text-white/80">{file.description}</p>}
            {file.reviewed ? (
              <p className="text-[11px] text-emerald-400 font-semibold">
                ✓ Reviewed{reviewerName ? ` by ${reviewerName}` : ''}
              </p>
            ) : (
              <p className="text-[11px] text-orange-400 font-semibold">Not reviewed</p>
            )}
          </div>
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

// ── Main component ─────────────────────────────────────────────────────

interface PhotoLiveTabProps {
  projectId: string
  photos: LivePhotoWithUploader[]
  canUpload: boolean
  canDeleteAny: boolean
  canReview: boolean
  currentUserId: string
}

export function PhotoLiveTab({
  projectId,
  photos,
  canUpload,
  canDeleteAny,
  canReview,
  currentUserId,
}: PhotoLiveTabProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Action state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  // Filters
  const [filterUploader, setFilterUploader] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [filterReview, setFilterReview] = useState<'all' | 'reviewed' | 'not_reviewed'>('all')

  // Derive unique filter options from all photos
  const uploaderOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of photos) {
      if (p.uploaded_by && p.profiles?.full_name) {
        seen.set(p.uploaded_by, p.profiles.full_name)
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [photos])

  const dateOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const p of photos) seen.add(toDateKey(p.created_at))
    return Array.from(seen).sort((a, b) => b.localeCompare(a))
  }, [photos])

  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (filterUploader !== 'all' && p.uploaded_by !== filterUploader) return false
      if (filterDate !== 'all' && toDateKey(p.created_at) !== filterDate) return false
      if (filterReview === 'reviewed' && !p.reviewed) return false
      if (filterReview === 'not_reviewed' && p.reviewed) return false
      return true
    })
  }, [photos, filterUploader, filterDate, filterReview])

  const hasFilters = filterUploader !== 'all' || filterDate !== 'all' || filterReview !== 'all'
  const unreviewedCount = photos.filter((p) => !p.reviewed).length

  function clearFilters() {
    setFilterUploader('all')
    setFilterDate('all')
    setFilterReview('all')
  }

  // ── Upload ────────────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (fileList: FileList) => {
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()
    let anyError = false

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) {
        setUploadError('Only images are supported in Photo Live.')
        anyError = true
        continue
      }

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${projectId}/live/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('project-media')
        .upload(path, file)

      if (storageError) {
        setUploadError(storageError.message)
        anyError = true
        continue
      }

      const result = await saveMediaRecordAction({
        project_id: projectId,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category: 'live_photo',
        description: caption.trim() || null,
      })

      if (result.error) {
        setUploadError(result.error)
        anyError = true
      }
    }

    setUploading(false)
    if (!anyError) {
      setCaption('')
      router.refresh()
    }
  }, [projectId, caption, router])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  // ── Delete ────────────────────────────────────────────────────────────

  async function handleDelete(file: LivePhotoWithUploader) {
    setDeletingId(file.id)
    await deleteLivePhotoAction({
      file_id: file.id,
      project_id: projectId,
      file_path: file.file_path,
    })
    setDeletingId(null)
    router.refresh()
  }

  // ── Review ────────────────────────────────────────────────────────────

  async function handleReview(file: LivePhotoWithUploader, reviewed: boolean) {
    setReviewingId(file.id)
    await reviewLivePhotoAction({
      file_id: file.id,
      project_id: projectId,
      reviewed,
    })
    setReviewingId(null)
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Upload card */}
      {canUpload && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Upload Site Photos</h3>
              <p className="text-xs text-gray-400 mt-0.5">Share real-time photos from the field</p>
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleInputChange} />
          </div>

          <div className="px-6 py-4 space-y-3">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 placeholder:text-gray-300"
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-5 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              }`}
            >
              <p className="text-xs text-gray-400">
                {dragOver ? 'Drop to upload' : 'Drag photos here or click to browse'}
              </p>
            </div>
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </div>
        </div>
      )}

      {/* Feed card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

        {/* Feed header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Photo Live Feed</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {photos.length > 0
                  ? `${photos.length} photo${photos.length !== 1 ? 's' : ''}${unreviewedCount > 0 ? ` · ${unreviewedCount} not reviewed` : ' · all reviewed'}`
                  : 'No photos yet'}
              </p>
            </div>
            {photos.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Filters — only show when there are photos */}
          {photos.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Date filter */}
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600"
              >
                <option value="all">All dates</option>
                {dateOptions.map((d) => (
                  <option key={d} value={d}>{formatDateLabel(d)}</option>
                ))}
              </select>

              {/* Uploader filter */}
              {uploaderOptions.length > 1 && (
                <select
                  value={filterUploader}
                  onChange={(e) => setFilterUploader(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600"
                >
                  <option value="all">All workers</option>
                  {uploaderOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}

              {/* Review status filter */}
              <select
                value={filterReview}
                onChange={(e) => setFilterReview(e.target.value as typeof filterReview)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600"
              >
                <option value="all">All photos</option>
                <option value="not_reviewed">Not reviewed</option>
                <option value="reviewed">Reviewed</option>
              </select>

              {/* Clear filters */}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-violet-600 hover:text-violet-800 font-semibold underline underline-offset-2 transition-colors"
                >
                  Clear filters
                </button>
              )}

              {/* Result count when filtered */}
              {hasFilters && (
                <span className="text-[11px] text-gray-400 ml-auto">
                  {filteredPhotos.length} of {photos.length} shown
                </span>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="p-6">
          {photos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">No live photos yet</p>
              {canUpload && (
                <p className="text-xs text-gray-300 mt-1">Upload site photos to share real-time progress</p>
              )}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-medium text-gray-400">No photos match your filters</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-semibold underline underline-offset-2"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredPhotos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  file={photo}
                  canDelete={canDeleteAny || photo.uploaded_by === currentUserId}
                  canReview={canReview}
                  onDelete={handleDelete}
                  onReview={handleReview}
                  deleting={deletingId === photo.id}
                  reviewing={reviewingId === photo.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
