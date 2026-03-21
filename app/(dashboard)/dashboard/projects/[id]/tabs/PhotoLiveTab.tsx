'use client'

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveMediaRecordAction, deleteLivePhotoAction, reviewLivePhotoAction } from '@/app/actions/media'
import { getSignedUploadUrlAction } from '@/app/actions/storage'
import { UPLOAD_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/upload-config'
import type { LivePhotoWithUploader, Profile } from '@/types/database'

// ── Constants ──────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif',  'image/heic', 'image/heif',
  'video/mp4',  'video/quicktime', 'video/webm',
  'video/mpeg', 'video/3gpp', 'video/x-msvideo',
]

// ── Helpers ────────────────────────────────────────────────────────────

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/${path}`
}

function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

function isAccepted(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg','jpeg','png','webp','gif','heic','heif','mp4','mov','webm','mpeg','3gpp','avi'].includes(ext)
}

function friendlyStorageError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('size') || m.includes('large') || m.includes('limit') || m.includes('exceed'))
    return `File exceeds the ${MAX_UPLOAD_MB} MB limit. Please use a smaller file.`
  if (m.includes('not found') || m.includes('does not exist') || m.includes('bucket'))
    return 'Storage is not configured. Please contact support.'
  if (m.includes('permission') || m.includes('policy') || m.includes('forbidden'))
    return 'Permission denied. Please log out and back in, then try again.'
  if (m.includes('mime') || m.includes('type') || m.includes('content-type'))
    return 'This file type is not supported. Please use JPG, PNG, HEIC, MP4, or MOV.'
  return 'Upload failed. Please check your connection and try again.'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function toDateKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA')
}

function formatDateLabel(key: string): string {
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Staged file type ───────────────────────────────────────────────────

interface StagedFile {
  key:        string
  file:       File
  previewUrl: string | null  // object URL for image preview; null for video
}

function buildStagedFile(file: File): StagedFile {
  return {
    key:        `${file.name}-${file.size}-${Date.now()}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }
}

// ── Sub-components ─────────────────────────────────────────────────────

function Spinner({ className = 'w-5 h-5 text-white' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function VideoPlayIcon() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  )
}

// ── Media feed card ────────────────────────────────────────────────────

interface MediaCardProps {
  file:      LivePhotoWithUploader
  canDelete: boolean
  canReview: boolean
  onDelete:  (file: LivePhotoWithUploader) => void
  onReview:  (file: LivePhotoWithUploader, reviewed: boolean) => void
  deleting:  boolean
  reviewing: boolean
}

function MediaCard({ file, canDelete, canReview, onDelete, onReview, deleting, reviewing }: MediaCardProps) {
  const [open, setOpen]             = useState(false)
  const [videoError, setVideoError] = useState(false)
  const url          = publicUrl(file.file_path)
  const uploaderName = file.profiles?.full_name ?? 'Unknown'
  const reviewerName = file.reviewer_profile?.full_name
  const isVid        = isVideo(file.file_type)

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
        {/* Thumbnail */}
        <div
          className="relative aspect-[4/3] bg-gray-100 overflow-hidden cursor-pointer select-none"
          onClick={() => setOpen(true)}
        >
          {isVid ? (
            videoError ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <span className="text-xs text-gray-400">Video unavailable</span>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={url}
                  className="w-full h-full object-cover"
                  muted playsInline preload="metadata"
                  onError={() => setVideoError(true)}
                />
                <VideoPlayIcon />
              </>
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.file_name} className="w-full h-full object-cover" loading="lazy" />
          )}

          {/* Review badge */}
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
                Pending
              </span>
            )}
          </div>

          {/* Video badge */}
          {isVid && (
            <div className="absolute top-2 right-8">
              <span className="text-[10px] font-bold text-white bg-black/50 rounded-full px-2 py-0.5 backdrop-blur-sm">VIDEO</span>
            </div>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={(e) => { e.stopPropagation(); onDelete(file) }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Delete"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {(deleting || reviewing) && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2.5 flex flex-col gap-1.5 flex-1">
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

          {file.description && (
            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{file.description}</p>
          )}

          {file.reviewed && reviewerName && (
            <p className="text-[9px] text-emerald-600 truncate">
              Reviewed by {reviewerName}{file.reviewed_at && <> · {timeAgo(file.reviewed_at)}</>}
            </p>
          )}

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
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {isVid ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={url} controls autoPlay
              className="max-h-[80vh] max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url} alt={file.file_name}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 rounded-xl px-4 py-2.5 text-center space-y-0.5 max-w-[calc(100vw-2rem)]">
            <p className="text-sm font-semibold text-white truncate">{uploaderName}</p>
            <p className="text-xs text-white/60">{new Date(file.created_at).toLocaleString()}</p>
            {file.description && <p className="text-xs text-white/80 line-clamp-2">{file.description}</p>}
            {file.reviewed
              ? <p className="text-[11px] text-emerald-400 font-semibold">✓ Reviewed{reviewerName ? ` by ${reviewerName}` : ''}</p>
              : <p className="text-[11px] text-orange-400 font-semibold">Pending review</p>
            }
          </div>
          <button
            type="button" onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
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
  projectId:          string
  photos:             LivePhotoWithUploader[]
  canUpload:          boolean
  canDeleteAny:       boolean
  canReview:          boolean
  currentUserId:      string
  currentUserProfile: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export function PhotoLiveTab({
  projectId,
  photos,
  canUpload,
  canDeleteAny,
  canReview,
  currentUserId,
  currentUserProfile,
}: PhotoLiveTabProps) {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Staged upload state ──────────────────────────────────────────────
  const [staged,         setStaged]         = useState<StagedFile[]>([])
  const [caption,        setCaption]        = useState('')
  const [uploading,      setUploading]      = useState(false)
  const [uploadStatus,   setUploadStatus]   = useState<string | null>(null)
  const [uploadError,    setUploadError]    = useState<string | null>(null)
  const [uploadSuccess,  setUploadSuccess]  = useState(false)
  const [dragOver,       setDragOver]       = useState(false)

  // ── Optimistic feed state ────────────────────────────────────────────
  const [localPhotos, setLocalPhotos] = useState<LivePhotoWithUploader[]>([])

  // ── Action state ─────────────────────────────────────────────────────
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  // ── Filters ──────────────────────────────────────────────────────────
  const [filterUploader, setFilterUploader] = useState<string>('all')
  const [filterDate,     setFilterDate]     = useState<string>('all')
  const [filterReview,   setFilterReview]   = useState<'all' | 'reviewed' | 'not_reviewed'>('all')
  const [filterType,     setFilterType]     = useState<'all' | 'image' | 'video'>('all')

  // Revoke object URLs when staged files change (memory cleanup)
  useEffect(() => {
    return () => {
      staged.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function revokeStagedFile(s: StagedFile) {
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
  }

  // ── Merge optimistic + server photos (dedup by file_path) ────────────
  const allPhotos = useMemo<LivePhotoWithUploader[]>(() => {
    const serverPaths = new Set(photos.map((p) => p.file_path))
    const unconfirmed = localPhotos.filter((p) => !serverPaths.has(p.file_path))
    return [...unconfirmed, ...photos]
  }, [localPhotos, photos])

  const uploaderOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of allPhotos) {
      if (p.uploaded_by && p.profiles?.full_name) seen.set(p.uploaded_by, p.profiles.full_name)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [allPhotos])

  const dateOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const p of allPhotos) seen.add(toDateKey(p.created_at))
    return Array.from(seen).sort((a, b) => b.localeCompare(a))
  }, [allPhotos])

  const filteredMedia = useMemo(() => {
    return allPhotos.filter((p) => {
      if (filterUploader !== 'all' && p.uploaded_by !== filterUploader) return false
      if (filterDate     !== 'all' && toDateKey(p.created_at) !== filterDate) return false
      if (filterReview === 'reviewed'     && !p.reviewed) return false
      if (filterReview === 'not_reviewed' &&  p.reviewed) return false
      if (filterType === 'image' &&  isVideo(p.file_type)) return false
      if (filterType === 'video' && !isVideo(p.file_type)) return false
      return true
    })
  }, [allPhotos, filterUploader, filterDate, filterReview, filterType])

  const hasFilters      = filterUploader !== 'all' || filterDate !== 'all' || filterReview !== 'all' || filterType !== 'all'
  const unreviewedCount = allPhotos.filter((p) => !p.reviewed).length
  const videoCount      = allPhotos.filter((p) => isVideo(p.file_type)).length

  function clearFilters() {
    setFilterUploader('all'); setFilterDate('all')
    setFilterReview('all');   setFilterType('all')
  }

  // ── Stage files (selection — no upload yet) ──────────────────────────

  const stageFiles = useCallback((fileList: FileList) => {
    setUploadError(null)
    setUploadSuccess(false)

    const all      = Array.from(fileList)
    const accepted = all.filter(isAccepted)
    const rejected = all.filter((f) => !isAccepted(f))
    const oversized  = accepted.filter((f) => f.size > MAX_UPLOAD_BYTES)
    const valid      = accepted.filter((f) => f.size <= MAX_UPLOAD_BYTES)

    if (rejected.length > 0 && valid.length === 0 && oversized.length === 0) {
      setUploadError('Only images and videos are supported. Please use JPG, PNG, HEIC, MP4, or MOV.')
      return
    }
    if (oversized.length > 0 && valid.length === 0) {
      setUploadError(
        `${oversized.length === 1 ? `"${oversized[0].name}" is` : `${oversized.length} files are`} too large. Maximum file size is ${MAX_UPLOAD_MB} MB.`
      )
      return
    }
    if (oversized.length > 0) {
      setUploadError(`${oversized.length} file(s) skipped — exceeded the ${MAX_UPLOAD_MB} MB limit.`)
    }

    setStaged((prev) => [...prev, ...valid.map(buildStagedFile)])
  }, [])

  function removeStagedFile(key: string) {
    setStaged((prev) => {
      const removed = prev.find((s) => s.key === key)
      if (removed) revokeStagedFile(removed)
      return prev.filter((s) => s.key !== key)
    })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) stageFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) stageFiles(e.dataTransfer.files)
  }

  // ── Send Live Photo (upload all staged files) ────────────────────────

  const sendLivePhoto = useCallback(async () => {
    if (staged.length === 0 || uploading) return

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)
    setUploadStatus(null)

    const supabase  = createClient()
    let anyError    = false
    let uploaded    = 0

    for (let i = 0; i < staged.length; i++) {
      const { file } = staged[i]
      setUploadStatus(staged.length > 1 ? `Uploading ${i + 1} of ${staged.length}…` : 'Uploading…')

      // Step 1 — get signed upload URL
      const ext    = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const signed = await getSignedUploadUrlAction({ projectId, ext, mimeType: file.type })

      if (signed.error || !signed.path || !signed.token) {
        setUploadError(signed.error ?? 'Failed to prepare upload. Please try again.')
        anyError = true
        continue
      }

      // Step 2 — upload to Supabase Storage via signed URL
      const { error: storageError } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })

      if (storageError) {
        setUploadError(friendlyStorageError(storageError.message))
        anyError = true
        continue
      }

      // Step 3 — save DB record (admin client in server action bypasses RLS)
      const result = await saveMediaRecordAction({
        project_id:  projectId,
        file_path:   signed.path,
        file_name:   file.name,
        file_type:   file.type,
        file_size:   file.size,
        category:    'live_photo',
        description: caption.trim() || null,
      })

      if (result.error) {
        setUploadError('Upload saved but record could not be created. Please contact support.')
        anyError = true
        continue
      }

      // Step 4 — add to optimistic feed immediately
      const optimisticItem: LivePhotoWithUploader = {
        id:               `optimistic-${Date.now()}-${Math.random()}`,
        project_id:       projectId,
        uploaded_by:      currentUserProfile.id,
        file_path:        signed.path,
        file_name:        file.name,
        file_type:        file.type,
        file_size:        file.size,
        category:         'live_photo',
        description:      caption.trim() || null,
        reviewed:         false,
        reviewed_by:      null,
        reviewed_at:      null,
        created_at:       new Date().toISOString(),
        profiles:         { id: currentUserProfile.id, full_name: currentUserProfile.full_name, avatar_url: currentUserProfile.avatar_url },
        reviewer_profile: null,
      }
      setLocalPhotos((prev) => [optimisticItem, ...prev])
      uploaded++
    }

    setUploading(false)
    setUploadStatus(null)

    if (uploaded > 0) {
      // Clear staged files + their object URLs
      staged.forEach(revokeStagedFile)
      setStaged([])
      if (!anyError) {
        setCaption('')
        setUploadSuccess(true)
        setTimeout(() => setUploadSuccess(false), 4000)
      }
      router.refresh()
    }
  }, [staged, uploading, projectId, caption, router, currentUserProfile])

  // ── Delete / Review ──────────────────────────────────────────────────

  async function handleDelete(file: LivePhotoWithUploader) {
    if (file.id.startsWith('optimistic-')) {
      setLocalPhotos((prev) => prev.filter((p) => p.id !== file.id))
      return
    }
    setDeletingId(file.id)
    await deleteLivePhotoAction({ file_id: file.id, project_id: projectId, file_path: file.file_path })
    setDeletingId(null)
    router.refresh()
  }

  async function handleReview(file: LivePhotoWithUploader, reviewed: boolean) {
    setReviewingId(file.id)
    await reviewLivePhotoAction({ file_id: file.id, project_id: projectId, reviewed })
    setReviewingId(null)
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Upload card ── */}
      {canUpload && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

          {/* Header */}
          <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Upload Photos & Videos</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select files, add a caption, then tap Send</p>
          </div>

          <div className="px-4 sm:px-5 py-4 space-y-3">

            {/* Caption */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Caption (optional)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Describe what you're uploading…"
                disabled={uploading}
                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 placeholder:text-gray-300 disabled:opacity-50"
              />
            </div>

            {/* Drop zone / file selector */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-5 px-4 text-center transition-colors ${
                uploading
                  ? 'border-gray-200 bg-gray-50/50 cursor-not-allowed opacity-60'
                  : dragOver
                    ? 'border-violet-400 bg-violet-50 cursor-pointer'
                    : 'border-gray-200 bg-gray-50/50 hover:border-violet-300 hover:bg-violet-50/30 cursor-pointer'
              }`}
            >
              <div className="flex flex-col items-center gap-1.5">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">
                  {dragOver ? 'Drop files here' : 'Choose Photos or Videos'}
                </p>
                <p className="text-[11px] text-gray-400">JPG, PNG, HEIC, MP4, MOV · Max {MAX_UPLOAD_MB} MB per file</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />

            {/* Staged files list */}
            {staged.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">
                  {staged.length} file{staged.length !== 1 ? 's' : ''} selected
                </p>
                <div className="space-y-1.5">
                  {staged.map((s) => (
                    <div key={s.key} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2">
                      {/* Thumbnail or icon */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 shrink-0 flex items-center justify-center">
                        {s.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.previewUrl} alt={s.file.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{s.file.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {isVideo(s.file.type) ? 'Video' : 'Photo'} · {formatBytes(s.file.size)}
                        </p>
                      </div>
                      {/* Remove */}
                      {!uploading && (
                        <button
                          type="button"
                          onClick={() => removeStagedFile(s.key)}
                          className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors shrink-0"
                          aria-label="Remove file"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-xs text-red-600">{uploadError}</p>
              </div>
            )}

            {/* Success */}
            {uploadSuccess && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <p className="text-xs font-semibold text-emerald-700">Photos sent successfully!</p>
              </div>
            )}

            {/* Send button */}
            <button
              type="button"
              onClick={sendLivePhoto}
              disabled={staged.length === 0 || uploading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Spinner className="w-4 h-4 text-white" />
                  {uploadStatus ?? 'Uploading…'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                  {staged.length > 0
                    ? `Send Live Photo${staged.length > 1 ? 's' : ''} (${staged.length})`
                    : 'Send Live Photo'}
                </>
              )}
            </button>

          </div>
        </div>
      )}

      {/* ── Feed card ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

        <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Live Feed</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {allPhotos.length > 0
                  ? [
                      `${allPhotos.length} file${allPhotos.length !== 1 ? 's' : ''}`,
                      videoCount > 0 ? `${videoCount} video${videoCount !== 1 ? 's' : ''}` : null,
                      unreviewedCount > 0 ? `${unreviewedCount} pending` : 'all reviewed',
                    ].filter(Boolean).join(' · ')
                  : 'No uploads yet'}
              </p>
            </div>
            {allPhotos.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Filters */}
          {allPhotos.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600 max-w-[130px]"
              >
                <option value="all">All dates</option>
                {dateOptions.map((d) => <option key={d} value={d}>{formatDateLabel(d)}</option>)}
              </select>

              {uploaderOptions.length > 1 && (
                <select
                  value={filterUploader} onChange={(e) => setFilterUploader(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600 max-w-[130px]"
                >
                  <option value="all">All workers</option>
                  {uploaderOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}

              {videoCount > 0 && (
                <select
                  value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600 max-w-[130px]"
                >
                  <option value="all">All types</option>
                  <option value="image">Photos</option>
                  <option value="video">Videos</option>
                </select>
              )}

              <select
                value={filterReview} onChange={(e) => setFilterReview(e.target.value as typeof filterReview)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-gray-600 max-w-[130px]"
              >
                <option value="all">All status</option>
                <option value="not_reviewed">Pending</option>
                <option value="reviewed">Reviewed</option>
              </select>

              {hasFilters && (
                <button type="button" onClick={clearFilters}
                  className="text-xs text-violet-600 hover:text-violet-800 font-semibold underline underline-offset-2 transition-colors"
                >Clear</button>
              )}

              {hasFilters && (
                <span className="text-[11px] text-gray-400 ml-auto">{filteredMedia.length} of {allPhotos.length}</span>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="p-4 sm:p-5">
          {allPhotos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-500">No uploads yet</p>
              {canUpload && (
                <p className="text-xs text-gray-400 mt-1">Select photos or videos above and tap Send Live Photo</p>
              )}
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-medium text-gray-400">No files match your filters</p>
              <button type="button" onClick={clearFilters}
                className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-semibold underline underline-offset-2"
              >Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMedia.map((file) => (
                <MediaCard
                  key={file.id}
                  file={file}
                  canDelete={canDeleteAny || file.uploaded_by === currentUserId}
                  canReview={canReview && !file.id.startsWith('optimistic-')}
                  onDelete={handleDelete}
                  onReview={handleReview}
                  deleting={deletingId === file.id}
                  reviewing={reviewingId === file.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
