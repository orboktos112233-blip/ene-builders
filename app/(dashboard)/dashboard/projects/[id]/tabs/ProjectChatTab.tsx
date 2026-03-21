'use client'

import { useState, useRef, useEffect, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import type { ProjectChatMessageWithSender, Profile } from '@/types/database'
import { sendProjectChatMessageAction, markProjectChatReadAction } from '@/app/actions/project-chat'
import { getChatUploadUrlAction } from '@/app/actions/storage'
import { createClient } from '@/lib/supabase/client'
import { UPLOAD_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/upload-config'

// ── File type detection ────────────────────────────────────────

type FileKind = 'image' | 'video' | 'pdf' | 'word' | 'excel' | 'file'

function detectKind(mimeType: string | null, fileName: string | null): FileKind {
  const type = (mimeType ?? '').toLowerCase()
  const ext  = (fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (type.startsWith('image/') || ['jpg','jpeg','png','webp','gif','heic','heif'].includes(ext))
    return 'image'
  if (type.startsWith('video/') || ['mp4','mov','webm','mpeg','3gpp','avi'].includes(ext))
    return 'video'
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(type) || ['doc','docx'].includes(ext))
    return 'word'
  if (['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(type) || ['xls','xlsx'].includes(ext))
    return 'excel'
  return 'file'
}

function isAcceptedFile(file: File): boolean {
  const kind = detectKind(file.type, file.name)
  return kind !== 'file' || file.size <= MAX_UPLOAD_BYTES
}

function isValidType(file: File): boolean {
  return detectKind(file.type, file.name) !== 'file' ||
    ['text/plain','text/csv','application/zip'].some((t) => file.type === t)
}

// ── Helpers ────────────────────────────────────────────────────

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/${path}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMessageTime(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateDivider(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ── File kind icon ─────────────────────────────────────────────

function FileKindIcon({ kind, className = 'w-5 h-5' }: { kind: FileKind; className?: string }) {
  if (kind === 'pdf') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    )
  }
  if (kind === 'word') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    )
  }
  if (kind === 'excel') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125a1.125 1.125 0 0 0 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-6.75a1.125 1.125 0 0 0-1.125-1.125H3.375a1.125 1.125 0 0 0-1.125 1.125v6.75Zm3.75-7.875h.008v.008H7.5V11.625Zm3 0h.008v.008H10.5V11.625Zm3 0h.008v.008H13.5V11.625Zm3 0h.008v.008H16.5V11.625Z" />
      </svg>
    )
  }
  // Generic file icon for 'file' kind
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

const KIND_COLORS: Record<FileKind, string> = {
  image:  'bg-violet-100 text-violet-600',
  video:  'bg-blue-100   text-blue-600',
  pdf:    'bg-red-100    text-red-600',
  word:   'bg-sky-100    text-sky-600',
  excel:  'bg-emerald-100 text-emerald-600',
  file:   'bg-gray-100   text-gray-600',
}

// ── File card (documents / non-media) ─────────────────────────

function FileCard({
  path, name, type, size, isMine,
}: {
  path:   string
  name:   string | null
  type:   string | null
  size:   number | null
  isMine: boolean
}) {
  const url  = publicUrl(path)
  const kind = detectKind(type, name)
  const ext  = (name ?? '').split('.').pop()?.toUpperCase() ?? 'FILE'

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 mt-1.5 px-3 py-2.5 rounded-xl border transition-opacity hover:opacity-80',
        isMine
          ? 'bg-violet-700/40 border-violet-500/30'
          : 'bg-white border-gray-200 shadow-sm'
      )}
      style={{ minWidth: '200px', maxWidth: '260px' }}
    >
      {/* Icon */}
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', KIND_COLORS[kind])}>
        <FileKindIcon kind={kind} className="w-5 h-5" />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12px] font-semibold truncate leading-tight', isMine ? 'text-white' : 'text-gray-900')}>
          {name ?? 'File'}
        </p>
        <p className={cn('text-[10px] mt-0.5', isMine ? 'text-violet-200' : 'text-gray-400')}>
          {ext}{size != null ? ` · ${formatBytes(size)}` : ''}
        </p>
      </div>
      {/* Download icon */}
      <svg className={cn('w-4 h-4 shrink-0', isMine ? 'text-violet-200' : 'text-gray-400')} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    </a>
  )
}

// ── Media attachment ───────────────────────────────────────────

function MediaAttachment({ path, name, type }: { path: string; name: string | null; type: string | null }) {
  const [videoError, setVideoError] = useState(false)
  const url  = publicUrl(path)
  const kind = detectKind(type, name)

  if (kind === 'video') {
    return (
      <div className="mt-1.5 rounded-xl overflow-hidden max-w-[260px]">
        {videoError ? (
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-400">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            {name ?? 'Video unavailable'}
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="w-full max-h-52 rounded-xl object-contain bg-black"
          />
        )}
      </div>
    )
  }

  // Image
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name ?? 'Image'}
        className="rounded-xl max-w-[260px] max-h-52 object-cover hover:opacity-90 transition-opacity cursor-pointer"
        loading="lazy"
      />
    </a>
  )
}

// ── System message ─────────────────────────────────────────────

function SystemMessage({ body, time }: { body: string; time: string }) {
  return (
    <div className="flex items-center gap-2 my-3 px-2">
      <div className="flex-1 h-px bg-gray-100" />
      <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full shrink-0 max-w-[75%]">
        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <p className="text-[11px] text-gray-500 truncate">{body}</p>
        <span className="text-[10px] text-gray-400 shrink-0">{time}</span>
      </div>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ── Staged attachment preview ──────────────────────────────────

interface StagedAttachment {
  file:       File
  previewUrl: string | null
  kind:       FileKind
}

function StagedPreview({ attachment, uploading, onRemove }: {
  attachment: StagedAttachment
  uploading:  boolean
  onRemove:   () => void
}) {
  return (
    <div className="flex items-center gap-3 mx-3 mb-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
      {/* Preview */}
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gray-100">
        {attachment.kind === 'image' && attachment.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center', KIND_COLORS[attachment.kind])}>
            <FileKindIcon kind={attachment.kind} className="w-5 h-5" />
          </div>
        )}
      </div>
      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-gray-800 truncate">{attachment.file.name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {formatBytes(attachment.file.size)} · {attachment.kind === 'image' ? 'Image' : attachment.kind === 'video' ? 'Video' : 'File'}
        </p>
      </div>
      {/* Action */}
      {uploading ? (
        <svg className="w-4 h-4 text-violet-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <button
          onClick={onRemove}
          className="shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  projectId:       string
  projectCode:     string
  projectName:     string
  initialMessages: ProjectChatMessageWithSender[]
  currentUser:     Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

// ── Main Component ─────────────────────────────────────────────

export function ProjectChatTab({
  projectId,
  projectCode,
  projectName,
  initialMessages,
  currentUser,
}: Props) {
  const router = useRouter()
  const [input, setInput]             = useState('')
  const [localMsgs, setLocalMsgs]     = useState<ProjectChatMessageWithSender[]>([])
  const [sending, startSending]       = useTransition()
  const [staged, setStaged]           = useState<StagedAttachment | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mark as read on mount
  useEffect(() => {
    markProjectChatReadAction(projectId)
  }, [projectId])

  // Scroll to bottom on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  // Scroll to bottom when local messages change
  useEffect(() => {
    if (localMsgs.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [localMsgs])

  // Revoke object URL on staged attachment cleanup
  useEffect(() => {
    return () => { if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl) }
  }, [staged])

  // Deduplicate local optimistic messages against confirmed server messages
  const allMessages = useMemo(() => {
    const serverIds = new Set(initialMessages.map((m) => m.id))
    const pending   = localMsgs.filter((m) => !serverIds.has(m.id))
    return [...initialMessages, ...pending]
  }, [initialMessages, localMsgs])

  // ── Stage attachment ─────────────────────────────────────────

  function stageAttachment(file: File) {
    setUploadError(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`File is too large. Maximum size is ${MAX_UPLOAD_MB} MB.`)
      return
    }
    const kind = detectKind(file.type, file.name)
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl)
    setStaged({
      file,
      kind,
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
    })
  }

  function removeStaged() {
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl)
    setStaged(null)
    setUploadError(null)
  }

  // ── Send ─────────────────────────────────────────────────────

  const send = () => {
    const body = input.trim()
    if (!body && !staged) return
    setInput('')
    setUploadError(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const attachmentSnap = staged
    setStaged(null)

    // Optimistic insert (attachment_path = sentinel while uploading)
    const optimistic: ProjectChatMessageWithSender = {
      id:              `opt-${Date.now()}`,
      project_id:      projectId,
      sender_id:       currentUser.id,
      body,
      created_at:      new Date().toISOString(),
      message_type:    'user',
      system_event:    null,
      sender:          { id: currentUser.id, full_name: currentUser.full_name, avatar_url: currentUser.avatar_url },
      attachment_path: attachmentSnap ? '___uploading___' : null,
      attachment_name: attachmentSnap?.file.name ?? null,
      attachment_type: attachmentSnap?.file.type ?? null,
      attachment_size: attachmentSnap?.file.size ?? null,
    }
    setLocalMsgs((prev) => [...prev, optimistic])

    startSending(async () => {
      let attachment: { path: string; name: string; type: string; size: number } | undefined

      if (attachmentSnap) {
        const file = attachmentSnap.file
        const ext  = (file.name.split('.').pop() ?? 'bin').toLowerCase()

        // Step 1 — signed upload URL
        const signed = await getChatUploadUrlAction({ projectId, ext, mimeType: file.type || 'application/octet-stream' })
        if (signed.error || !signed.path || !signed.token) {
          setUploadError(signed.error ?? 'Failed to prepare upload. Please try again.')
          setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }

        // Step 2 — upload to storage
        const supabase = createClient()
        const { error: storageError } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type || 'application/octet-stream',
          })

        if (storageError) {
          setUploadError('File upload failed. Please check your connection and try again.')
          setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }

        attachment = { path: signed.path, name: file.name, type: file.type, size: file.size }

        // Update optimistic message with real path
        setLocalMsgs((prev) => prev.map((m): ProjectChatMessageWithSender =>
          m.id === optimistic.id ? { ...m, attachment_path: signed.path ?? null } : m
        ))
      }

      // Step 3 — save to DB
      const result = await sendProjectChatMessageAction(
        projectId, body, projectCode, projectName, attachment
      )
      if (result.error) {
        setUploadError(result.error)
        setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }

      router.refresh()
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const canSend = (input.trim().length > 0 || staged !== null) && !sending

  // ── Render ────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ height: 'min(640px, calc(100vh - 240px))' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
        <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900">Project Chat</p>
          <p className="text-[11px] text-gray-400">{projectCode} · Team only</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-600">Live</span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
        {allMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400">No messages yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Start the conversation for {projectCode}</p>
            </div>
          </div>
        ) : (
          allMessages.map((msg, i) => {
            const prevMsg = allMessages[i - 1]
            const nextMsg = allMessages[i + 1]

            // ── System message ──────────────────────────────
            if (msg.message_type === 'system') {
              return (
                <SystemMessage
                  key={msg.id}
                  body={msg.body}
                  time={formatMessageTime(msg.created_at)}
                />
              )
            }

            // ── User message ────────────────────────────────
            const isMine     = msg.sender_id === currentUser.id
            const isOpt      = msg.id.startsWith('opt-')
            const isUploading = isOpt && msg.attachment_path === '___uploading___'

            const showDivider = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at)
            const prevIsUser  = prevMsg && prevMsg.message_type === 'user'
            const nextIsUser  = nextMsg && nextMsg.message_type === 'user'
            const sameAsPrev  = prevIsUser && prevMsg.sender_id === msg.sender_id && !showDivider
            const sameAsNext  = nextIsUser && nextMsg.sender_id === msg.sender_id &&
                                sameDay(msg.created_at, nextMsg.created_at)
            const showName    = !isMine && !sameAsPrev
            const showAvatar  = !isMine && !sameAsNext

            const hasText       = msg.body.trim().length > 0
            const hasAttachment = msg.attachment_path && msg.attachment_path !== '___uploading___'
            const attachKind    = hasAttachment ? detectKind(msg.attachment_type, msg.attachment_name) : null
            const isMediaAttach = attachKind === 'image' || attachKind === 'video'

            return (
              <div key={msg.id}>
                {/* Date divider */}
                {showDivider && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] font-medium text-gray-400 shrink-0">
                      {formatDateDivider(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}

                <div className={cn(
                  'flex items-end gap-2',
                  isMine ? 'justify-end' : 'justify-start',
                  sameAsPrev ? 'mt-0.5' : 'mt-3'
                )}>
                  {/* Avatar slot */}
                  {!isMine && (
                    <div className="w-7 shrink-0 self-end mb-0.5">
                      {showAvatar && (
                        <Avatar name={msg.sender?.full_name ?? '?'} avatarUrl={msg.sender?.avatar_url ?? null} size="xs" />
                      )}
                    </div>
                  )}

                  <div className={cn(
                    'flex flex-col max-w-[78%] sm:max-w-[65%]',
                    isMine ? 'items-end' : 'items-start'
                  )}>
                    {/* Sender name */}
                    {showName && (
                      <p className="text-[11px] font-semibold text-gray-500 mb-1 ml-0.5">
                        {msg.sender?.full_name ?? 'Unknown'}
                      </p>
                    )}

                    {/* Bubble */}
                    <div className={cn(
                      'relative px-3 py-2 text-[13px] leading-relaxed break-words',
                      isMine
                        ? cn(
                            'bg-violet-600 text-white',
                            sameAsPrev && sameAsNext ? 'rounded-2xl rounded-tr-[6px]'
                              : sameAsPrev           ? 'rounded-2xl rounded-tr-[6px] rounded-br-[6px]'
                              : sameAsNext           ? 'rounded-2xl rounded-tr-[6px]'
                              :                        'rounded-2xl rounded-tr-[6px] rounded-br-[6px]',
                            isOpt && 'opacity-75'
                          )
                        : cn(
                            'bg-gray-100 text-gray-900',
                            sameAsPrev && sameAsNext ? 'rounded-2xl rounded-tl-[6px]'
                              : sameAsPrev           ? 'rounded-2xl rounded-tl-[6px] rounded-bl-[6px]'
                              : sameAsNext           ? 'rounded-2xl rounded-tl-[6px]'
                              :                        'rounded-2xl rounded-tl-[6px] rounded-bl-[6px]'
                          )
                    )}>
                      {/* Text */}
                      {hasText && <span>{msg.body}</span>}

                      {/* Uploading placeholder */}
                      {isUploading && (
                        <div className="flex items-center gap-2 mt-1">
                          <svg className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-[11px] opacity-70">Uploading {msg.attachment_name ?? 'file'}…</span>
                        </div>
                      )}

                      {/* Confirmed attachment */}
                      {hasAttachment && (
                        isMediaAttach ? (
                          <MediaAttachment
                            path={msg.attachment_path!}
                            name={msg.attachment_name}
                            type={msg.attachment_type}
                          />
                        ) : (
                          <FileCard
                            path={msg.attachment_path!}
                            name={msg.attachment_name}
                            type={msg.attachment_type}
                            size={msg.attachment_size}
                            isMine={isMine}
                          />
                        )
                      )}
                    </div>

                    {/* Timestamp */}
                    {!sameAsNext && (
                      <p className={cn(
                        'text-[10px] text-gray-400 mt-1 px-0.5',
                        isMine ? 'text-right' : 'text-left'
                      )}>
                        {formatMessageTime(msg.created_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Upload error ── */}
      {uploadError && (
        <div className="mx-3 mb-1 px-3 py-2 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 shrink-0">
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-[11px] text-red-600 flex-1">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Staged attachment preview ── */}
      {staged && <StagedPreview attachment={staged} uploading={sending} onRemove={removeStaged} />}

      {/* ── Input ── */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-white shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
          <div className="shrink-0 mb-0.5">
            <Avatar name={currentUser.full_name} avatarUrl={currentUser.avatar_url} size="xs" />
          </div>

          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder={`Message ${projectCode}…`}
            className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 resize-none outline-none leading-relaxed py-0.5 disabled:opacity-50"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />

          {/* Attach button */}
          <button
            type="button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file, image, or video"
            className={cn(
              'shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              staged
                ? 'bg-violet-100 text-violet-600'
                : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-40'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
          </button>

          {/* Send button */}
          <button
            onClick={send}
            disabled={!canSend}
            className="shrink-0 w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line · Supports images, videos, PDF, Word, Excel
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) stageAttachment(file)
        }}
      />
    </div>
  )
}
