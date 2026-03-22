'use client'

import { useState, useRef, useEffect, useMemo, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'
import { UPLOAD_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/upload-config'
import { useDirectMessagesRealtime, useProjectChatRealtime } from '@/lib/realtime/hooks'
import type {
  Profile,
  ConversationSummary,
  MessageWithSender,
  ProjectConversation,
  ProjectChatMessageWithSender,
} from '@/types/database'
import {
  sendMessageAction,
  markConversationReadAction,
  getOrCreateConversationAction,
} from '@/app/actions/messages'
import {
  sendProjectChatMessageAction,
  markProjectChatReadAction,
} from '@/app/actions/project-chat'
import {
  getDmUploadUrlAction,
  getChatUploadUrlAction,
} from '@/app/actions/storage'

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

function publicUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/${path}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(iso: string) {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatMsgTime(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function formatDateLabel(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

const ROLE_LABELS: Record<string, string> = {
  admin:           'Admin',
  office:          'Office',
  project_manager: 'Project Manager',
  worker:          'Worker',
  client:          'Client',
}

const KIND_COLORS: Record<FileKind, string> = {
  image: 'bg-[#EEF2FF] text-[#1C3FAA]',
  video: 'bg-[#EEF2FF]   text-[#1C3FAA]',
  pdf:   'bg-red-100    text-red-600',
  word:  'bg-sky-100    text-sky-600',
  excel: 'bg-emerald-100 text-emerald-600',
  file:  'bg-gray-100   text-gray-600',
}

// ── File kind icon ─────────────────────────────────────────────

function FileKindIcon({ kind, className = 'w-4 h-4' }: { kind: FileKind; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      {kind === 'excel' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125a1.125 1.125 0 0 0 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-6.75a1.125 1.125 0 0 0-1.125-1.125H3.375a1.125 1.125 0 0 0-1.125 1.125v6.75Z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      )}
    </svg>
  )
}

// ── Attachment rendering ───────────────────────────────────────

function AttachmentBubble({
  path, name, type, size, isMine,
}: {
  path:   string
  name:   string | null
  type:   string | null
  size:   number | null
  isMine: boolean
}) {
  const kind = detectKind(type, name)
  const url  = publicUrl(path)
  const [videoError, setVideoError] = useState(false)

  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? 'Image'}
          className="rounded-xl max-w-[220px] max-h-48 object-cover hover:opacity-90 transition-opacity"
          loading="lazy"
        />
      </a>
    )
  }

  if (kind === 'video') {
    return (
      <div className="mt-1.5 rounded-xl overflow-hidden max-w-[220px]">
        {videoError ? (
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-400">
            <span>{name ?? 'Video'}</span>
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="w-full max-h-48 rounded-xl object-contain bg-black"
          />
        )}
      </div>
    )
  }

  const ext = (name ?? '').split('.').pop()?.toUpperCase() ?? 'FILE'
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2.5 mt-1.5 px-3 py-2 rounded-xl border transition-opacity hover:opacity-80',
        isMine
          ? 'bg-[#1C3FAA]/40 border-[#1C3FAA]/30'
          : 'bg-white border-gray-200 shadow-sm'
      )}
      style={{ minWidth: '180px', maxWidth: '240px' }}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', KIND_COLORS[kind])}>
        <FileKindIcon kind={kind} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[11px] font-semibold truncate', isMine ? 'text-white' : 'text-gray-900')}>
          {name ?? 'File'}
        </p>
        <p className={cn('text-[10px]', isMine ? 'text-blue-200' : 'text-gray-400')}>
          {ext}{size != null ? ` · ${formatBytes(size)}` : ''}
        </p>
      </div>
      <svg className={cn('w-3.5 h-3.5 shrink-0', isMine ? 'text-blue-200' : 'text-gray-400')} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    </a>
  )
}

// ── Staged attachment preview ──────────────────────────────────

interface StagedAttachment {
  file:       File
  previewUrl: string | null
  kind:       FileKind
}

function StagedPreview({
  attachment,
  uploading,
  onRemove,
}: {
  attachment: StagedAttachment
  uploading:  boolean
  onRemove:   () => void
}) {
  return (
    <div className="flex items-center gap-2 mx-3 mb-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gray-100">
        {attachment.kind === 'image' && attachment.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center', KIND_COLORS[attachment.kind])}>
            <FileKindIcon kind={attachment.kind} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-800 truncate">{attachment.file.name}</p>
        <p className="text-[10px] text-gray-400">{formatBytes(attachment.file.size)}</p>
      </div>
      {uploading ? (
        <svg className="w-4 h-4 text-[#1C3FAA] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 rounded-lg">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── New Conversation Dialog ────────────────────────────────────

function NewConversationDialog({
  allUsers,
  onClose,
  onSelect,
  starting,
}: {
  allUsers: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>[]
  onClose:  () => void
  onSelect: (userId: string) => void
  starting: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = allUsers.filter((u) =>
    u.full_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">New Message</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-2 border-b border-gray-100">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#1C3FAA]"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-400">No users found</li>
          )}
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                disabled={starting}
                onClick={() => onSelect(u.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
              >
                <Avatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── DM Thread View (with attachments) ─────────────────────────

function DmThreadView({
  profile,
  conv,
  serverMessages,
  realtimeMessages,
  onBack,
}: {
  profile:         Profile
  conv:            ConversationSummary | null
  serverMessages:  MessageWithSender[]
  realtimeMessages: MessageWithSender[]
  onBack:          () => void
}) {
  const router                    = useRouter()
  const [input, setInput]         = useState('')
  const [localMsgs, setLocalMsgs] = useState<MessageWithSender[]>([])
  const [sending, startSending]   = useTransition()
  const [staged, setStaged]       = useState<StagedAttachment | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalMsgs([]); setInput(''); setStaged(null); setError(null) }, [conv?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [serverMessages, realtimeMessages, localMsgs])
  useEffect(() => () => { if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl) }, [staged])

  const allMessages = useMemo(() => {
    const serverIds = new Set(serverMessages.map((m) => m.id))
    const realtimeIds = new Set(realtimeMessages.map((m) => m.id))
    const pending   = localMsgs.filter((m) => !serverIds.has(m.id) && !realtimeIds.has(m.id))
    return [...serverMessages, ...realtimeMessages, ...pending]
  }, [serverMessages, realtimeMessages, localMsgs])

  function stageFile(file: File) {
    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File too large. Max ${MAX_UPLOAD_MB} MB.`)
      return
    }
    const kind = detectKind(file.type, file.name)
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl)
    setStaged({ file, kind, previewUrl: kind === 'image' ? URL.createObjectURL(file) : null })
  }

  const send = () => {
    const body = input.trim()
    if (!body && !staged) return
    if (!conv) return
    setInput('')
    setError(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const attachmentSnap = staged
    setStaged(null)

    const optimistic: MessageWithSender = {
      id:              `opt-${Date.now()}`,
      conversation_id: conv.id,
      sender_id:       profile.id,
      body,
      created_at:      new Date().toISOString(),
      attachment_path: attachmentSnap ? '___uploading___' : null,
      attachment_name: attachmentSnap?.file.name ?? null,
      attachment_type: attachmentSnap?.file.type ?? null,
      attachment_size: attachmentSnap?.file.size ?? null,
      sender:          { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url },
    }
    setLocalMsgs((prev) => [...prev, optimistic])

    startSending(async () => {
      let attachment: { path: string; name: string; type: string; size: number } | undefined

      if (attachmentSnap) {
        const file = attachmentSnap.file
        const ext  = (file.name.split('.').pop() ?? 'bin').toLowerCase()

        const signed = await getDmUploadUrlAction({
          conversationId: conv.id,
          ext,
          mimeType: file.type || 'application/octet-stream',
        })
        if (signed.error || !signed.path || !signed.token) {
          setError(signed.error ?? 'Failed to prepare upload.')
          setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }

        const supabase = createClient()
        const { error: storageErr } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type || 'application/octet-stream',
          })

        if (storageErr) {
          setError('File upload failed. Please try again.')
          setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }

        attachment = { path: signed.path, name: file.name, type: file.type, size: file.size }
        setLocalMsgs((prev) => prev.map((m): MessageWithSender =>
          m.id === optimistic.id ? { ...m, attachment_path: signed.path ?? null } : m
        ))
      }

      const result = await sendMessageAction(conv.id, body, attachment)
      if (result.error) {
        setError(result.error)
        setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }
      router.refresh()
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!conv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-white">
        <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        <p className="text-sm text-gray-400">Select a conversation to start messaging</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <Avatar name={conv.otherUser?.full_name ?? '?'} avatarUrl={conv.otherUser?.avatar_url ?? null} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 truncate">{conv.otherUser?.full_name ?? 'Unknown'}</p>
          {conv.otherUser?.role && (
            <p className="text-[11px] text-gray-400">{ROLE_LABELS[conv.otherUser.role] ?? conv.otherUser.role}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {allMessages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
          </div>
        )}
        {allMessages.map((msg, i) => {
          const isMine     = msg.sender_id === profile.id
          const isOpt      = msg.id.startsWith('opt-')
          const isUploading = isOpt && msg.attachment_path === '___uploading___'
          const prevMsg    = allMessages[i - 1]
          const nextMsg    = allMessages[i + 1]
          const showDivider = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at)
          const sameAsPrev  = !showDivider && prevMsg?.sender_id === msg.sender_id
          const sameAsNext  = nextMsg && nextMsg.sender_id === msg.sender_id && sameDay(msg.created_at, nextMsg.created_at)
          const hasAttachment = msg.attachment_path && msg.attachment_path !== '___uploading___'

          return (
            <div key={msg.id}>
              {showDivider && (
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-medium text-gray-400 shrink-0">{formatDateLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}
              <div className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start', sameAsPrev ? 'mt-0.5' : 'mt-3')}>
                {!isMine && (
                  <div className="w-6 shrink-0">
                    {!sameAsNext && (
                      <Avatar name={msg.sender?.full_name ?? '?'} avatarUrl={msg.sender?.avatar_url ?? null} size="xs" />
                    )}
                  </div>
                )}
                <div className={cn('flex flex-col max-w-[72%]', isMine ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words',
                    isMine
                      ? cn('bg-[#1C3FAA] text-white', sameAsPrev ? 'rounded-tr-[6px]' : '', sameAsNext ? 'rounded-br-[6px]' : '', isOpt && 'opacity-75')
                      : cn('bg-gray-100 text-gray-900', sameAsPrev ? 'rounded-tl-[6px]' : '', sameAsNext ? 'rounded-bl-[6px]' : '')
                  )}>
                    {msg.body && <span>{msg.body}</span>}
                    {isUploading && (
                      <div className="flex items-center gap-2 mt-1">
                        <svg className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-[11px] opacity-70">Uploading {msg.attachment_name ?? 'file'}…</span>
                      </div>
                    )}
                    {hasAttachment && (
                      <AttachmentBubble
                        path={msg.attachment_path!}
                        name={msg.attachment_name}
                        type={msg.attachment_type}
                        size={msg.attachment_size}
                        isMine={isMine}
                      />
                    )}
                  </div>
                  {!sameAsNext && (
                    <span className="text-[10px] text-gray-400 mt-1 px-0.5">{formatTime(msg.created_at)}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-1 px-3 py-2 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 shrink-0">
          <p className="text-[11px] text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Staged attachment */}
      {staged && <StagedPreview attachment={staged} uploading={sending} onRemove={() => { if (staged.previewUrl) URL.revokeObjectURL(staged.previewUrl); setStaged(null) }} />}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-[#1C3FAA] focus-within:ring-2 focus-within:ring-[#1C3FAA]/20 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder="Write a message…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 resize-none outline-none leading-relaxed py-0.5 disabled:opacity-50"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          {/* Attach */}
          <button
            type="button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
              staged ? 'bg-[#EEF2FF] text-[#1C3FAA]' : 'text-gray-400 hover:text-[#1C3FAA] hover:bg-[#EEF2FF] disabled:opacity-40'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
          </button>
          {/* Send */}
          <button
            onClick={send}
            disabled={(!input.trim() && !staged) || sending}
            className="shrink-0 w-8 h-8 rounded-xl bg-[#1C3FAA] text-white flex items-center justify-center hover:bg-[#162F82] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <p className="text-[10px] text-gray-400 mt-1 text-center">Enter to send · Shift+Enter for new line</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) stageFile(f) }}
      />
    </div>
  )
}

// ── Project Chat Thread (admin messages area) ──────────────────

function ProjectChatThread({
  profile,
  projectId,
  projectCode,
  projectName,
  serverMessages,
  realtimeMessages,
  onBack,
}: {
  profile:          Profile
  projectId:        string
  projectCode:      string
  projectName:      string
  serverMessages:   ProjectChatMessageWithSender[]
  realtimeMessages: ProjectChatMessageWithSender[]
  onBack:           () => void
}) {
  const router                    = useRouter()
  const [input, setInput]         = useState('')
  const [localMsgs, setLocalMsgs] = useState<ProjectChatMessageWithSender[]>([])
  const [sending, startSending]   = useTransition()
  const [staged, setStaged]       = useState<StagedAttachment | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalMsgs([]); setInput(''); setStaged(null); setError(null) }, [projectId])
  useEffect(() => { markProjectChatReadAction(projectId) }, [projectId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto' }) }, [])
  useEffect(() => { if (localMsgs.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [localMsgs])
  useEffect(() => () => { if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl) }, [staged])

  const allMessages = useMemo(() => {
    const serverIds = new Set(serverMessages.map((m) => m.id))
    const realtimeIds = new Set(realtimeMessages.map((m) => m.id))
    const pending   = localMsgs.filter((m) => !serverIds.has(m.id) && !realtimeIds.has(m.id))
    return [...serverMessages, ...realtimeMessages, ...pending]
  }, [serverMessages, realtimeMessages, localMsgs])

  function stageFile(file: File) {
    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) { setError(`File too large. Max ${MAX_UPLOAD_MB} MB.`); return }
    const kind = detectKind(file.type, file.name)
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl)
    setStaged({ file, kind, previewUrl: kind === 'image' ? URL.createObjectURL(file) : null })
  }

  const send = () => {
    const body = input.trim()
    if (!body && !staged) return
    setInput('')
    setError(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const attachmentSnap = staged
    setStaged(null)

    const optimistic: ProjectChatMessageWithSender = {
      id:              `opt-${Date.now()}`,
      project_id:      projectId,
      sender_id:       profile.id,
      body,
      created_at:      new Date().toISOString(),
      message_type:    'user',
      system_event:    null,
      attachment_path: attachmentSnap ? '___uploading___' : null,
      attachment_name: attachmentSnap?.file.name ?? null,
      attachment_type: attachmentSnap?.file.type ?? null,
      attachment_size: attachmentSnap?.file.size ?? null,
      sender:          { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url },
    }
    setLocalMsgs((prev) => [...prev, optimistic])

    startSending(async () => {
      let attachment: { path: string; name: string; type: string; size: number } | undefined

      if (attachmentSnap) {
        const file = attachmentSnap.file
        const ext  = (file.name.split('.').pop() ?? 'bin').toLowerCase()
        const signed = await getChatUploadUrlAction({ projectId, ext, mimeType: file.type || 'application/octet-stream' })
        if (signed.error || !signed.path || !signed.token) {
          setError(signed.error ?? 'Failed to prepare upload.')
          setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }
        const supabase = createClient()
        const { error: storageErr } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || 'application/octet-stream' })
        if (storageErr) {
          setError('File upload failed. Please try again.')
          setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }
        attachment = { path: signed.path, name: file.name, type: file.type, size: file.size }
        setLocalMsgs((prev) => prev.map((m): ProjectChatMessageWithSender =>
          m.id === optimistic.id ? { ...m, attachment_path: signed.path ?? null } : m
        ))
      }

      const result = await sendProjectChatMessageAction(projectId, body, projectCode, projectName, attachment)
      if (result.error) {
        setError(result.error)
        setLocalMsgs((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }
      router.refresh()
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-[#1C3FAA]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900">{projectCode}</p>
          <p className="text-[11px] text-gray-400 truncate">{projectName} · Project Chat</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
        {allMessages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300">Start the conversation for {projectCode}</p>
          </div>
        )}
        {allMessages.map((msg, i) => {
          if (msg.message_type === 'system') {
            return (
              <div key={msg.id} className="flex items-center gap-2 my-3 px-2">
                <div className="flex-1 h-px bg-gray-100" />
                <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full shrink-0 max-w-[75%]">
                  <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <p className="text-[11px] text-gray-500 truncate">{msg.body}</p>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            )
          }

          const isMine      = msg.sender_id === profile.id
          const isOpt       = msg.id.startsWith('opt-')
          const isUploading = isOpt && msg.attachment_path === '___uploading___'
          const prevMsg     = allMessages[i - 1]
          const nextMsg     = allMessages[i + 1]
          const showDivider = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at)
          const prevIsUser  = prevMsg && prevMsg.message_type === 'user'
          const nextIsUser  = nextMsg && nextMsg.message_type === 'user'
          const sameAsPrev  = prevIsUser && prevMsg.sender_id === msg.sender_id && !showDivider
          const sameAsNext  = nextIsUser && nextMsg.sender_id === msg.sender_id && sameDay(msg.created_at, nextMsg.created_at)
          const showName    = !isMine && !sameAsPrev
          const showAvatar  = !isMine && !sameAsNext
          const hasAttachment = msg.attachment_path && msg.attachment_path !== '___uploading___'

          return (
            <div key={msg.id}>
              {showDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-medium text-gray-400 shrink-0">{formatDateLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}
              <div className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start', sameAsPrev ? 'mt-0.5' : 'mt-3')}>
                {!isMine && (
                  <div className="w-7 shrink-0 self-end mb-0.5">
                    {showAvatar && <Avatar name={msg.sender?.full_name ?? '?'} avatarUrl={msg.sender?.avatar_url ?? null} size="xs" />}
                  </div>
                )}
                <div className={cn('flex flex-col max-w-[72%]', isMine ? 'items-end' : 'items-start')}>
                  {showName && (
                    <p className="text-[11px] font-semibold text-gray-500 mb-1 ml-0.5">{msg.sender?.full_name ?? 'Unknown'}</p>
                  )}
                  <div className={cn(
                    'px-3 py-2 text-[13px] leading-relaxed break-words rounded-2xl',
                    isMine
                      ? cn('bg-[#1C3FAA] text-white', sameAsPrev && 'rounded-tr-[6px]', sameAsNext && 'rounded-br-[6px]', isOpt && 'opacity-75')
                      : cn('bg-gray-100 text-gray-900', sameAsPrev && 'rounded-tl-[6px]', sameAsNext && 'rounded-bl-[6px]')
                  )}>
                    {msg.body && <span>{msg.body}</span>}
                    {isUploading && (
                      <div className="flex items-center gap-2 mt-1">
                        <svg className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-[11px] opacity-70">Uploading…</span>
                      </div>
                    )}
                    {hasAttachment && (
                      <AttachmentBubble
                        path={msg.attachment_path!}
                        name={msg.attachment_name}
                        type={msg.attachment_type}
                        size={msg.attachment_size}
                        isMine={isMine}
                      />
                    )}
                  </div>
                  {!sameAsNext && (
                    <p className={cn('text-[10px] text-gray-400 mt-1 px-0.5', isMine ? 'text-right' : 'text-left')}>
                      {formatMsgTime(msg.created_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-1 px-3 py-2 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 shrink-0">
          <p className="text-[11px] text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {staged && <StagedPreview attachment={staged} uploading={sending} onRemove={() => { if (staged.previewUrl) URL.revokeObjectURL(staged.previewUrl); setStaged(null) }} />}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2 focus-within:border-[#1C3FAA] focus-within:ring-2 focus-within:ring-[#1C3FAA]/20 transition-all">
          <div className="shrink-0 mb-0.5">
            <Avatar name={profile.full_name} avatarUrl={profile.avatar_url} size="xs" />
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder={`Message ${projectCode}…`}
            className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 resize-none outline-none leading-relaxed py-0.5 disabled:opacity-50"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
              staged ? 'bg-[#EEF2FF] text-[#1C3FAA]' : 'text-gray-400 hover:text-[#1C3FAA] hover:bg-[#EEF2FF] disabled:opacity-40'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
          </button>
          <button
            onClick={send}
            disabled={(!input.trim() && !staged) || sending}
            className="shrink-0 w-8 h-8 rounded-xl bg-[#1C3FAA] text-white flex items-center justify-center hover:bg-[#162F82] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <p className="text-[10px] text-gray-400 mt-1 text-center">Enter to send · Supports images, videos, PDF, Word, Excel</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) stageFile(f) }}
      />
    </div>
  )
}

// ── Left panel: DM conversation list ──────────────────────────

function ConversationList({
  conversations,
  selectedConvId,
  myId,
  onSelect,
  onNew,
}: {
  conversations:  ConversationSummary[]
  selectedConvId: string | null
  myId:           string
  onSelect:       (id: string) => void
  onNew:          () => void
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 px-6 py-12 text-center">
          <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <p className="text-sm text-gray-400">No conversations yet</p>
          <button onClick={onNew} className="text-sm font-medium text-[#1C3FAA] hover:underline">Start one</button>
        </div>
      ) : (
        conversations.map((conv) => {
          const isActive = conv.id === selectedConvId
          const isUnread = conv.unreadCount > 0
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50',
                isActive ? 'bg-[#EEF2FF]' : 'hover:bg-gray-50'
              )}
            >
              <Avatar name={conv.otherUser?.full_name ?? '?'} avatarUrl={conv.otherUser?.avatar_url ?? null} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-[13px] truncate', isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
                    {conv.otherUser?.full_name ?? 'Unknown'}
                  </p>
                  {conv.lastMessage && (
                    <span className="text-[11px] text-gray-400 shrink-0">{formatTime(conv.lastMessage.created_at)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className={cn('text-[12px] truncate', isUnread ? 'text-gray-700' : 'text-gray-400')}>
                    {conv.lastMessage
                      ? (conv.lastMessage.sender_id === myId ? 'You: ' : '') + conv.lastMessage.body
                      : 'No messages yet'}
                  </p>
                  {isUnread && (
                    <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-[#1C3FAA] text-[10px] font-bold text-white">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}

// ── Left panel: project chat list (admin) ─────────────────────

function ProjectChatList({
  projects,
  selectedProjectId,
  onSelect,
}: {
  projects:          ProjectConversation[]
  selectedProjectId: string | null
  onSelect:          (pid: string) => void
}) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 py-12 text-center">
        <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        <p className="text-sm text-gray-400">No project messages yet</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {projects.map((proj) => {
        const isActive = proj.projectId === selectedProjectId
        const isUnread = proj.unreadCount > 0
        return (
          <button
            key={proj.projectId}
            onClick={() => onSelect(proj.projectId)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50',
              isActive ? 'bg-[#EEF2FF]' : 'hover:bg-gray-50'
            )}
          >
            <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[#1C3FAA]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-[13px] truncate', isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
                  {proj.projectCode}
                </p>
                {proj.lastMessage && (
                  <span className="text-[11px] text-gray-400 shrink-0">{formatTime(proj.lastMessage.created_at)}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <p className={cn('text-[12px] truncate', isUnread ? 'text-gray-700' : 'text-gray-400')}>
                  {proj.lastMessage?.body ?? proj.projectName}
                </p>
                {isUnread && (
                  <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-[#1C3FAA] text-[10px] font-bold text-white">
                    {proj.unreadCount > 9 ? '9+' : proj.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

interface Props {
  profile:              Profile
  conversations:        ConversationSummary[]
  threadMessages:       MessageWithSender[]
  selectedConvId:       string | null
  allUsers:             Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>[]
  isAdmin:              boolean
  projectConversations: ProjectConversation[]
  projectChatMessages:  ProjectChatMessageWithSender[]
  selectedProjectId:    string | null
  selectedProjectCode:  string
  selectedProjectName:  string
}

export function MessagesClient({
  profile,
  conversations,
  threadMessages,
  selectedConvId,
  allUsers,
  isAdmin,
  projectConversations,
  projectChatMessages,
  selectedProjectId,
  selectedProjectCode,
  selectedProjectName,
}: Props) {
  const router = useRouter()

  // For admin: 'dm' | 'projects'
  const [activeTab, setActiveTab] = useState<'dm' | 'projects'>(selectedProjectId ? 'projects' : 'dm')

  const [showNewDialog, setShowNewDialog] = useState(false)
  const [starting, startStarting]         = useTransition()
  
  // Realtime message tracking
  const [realtimeDmMessages, setRealtimeDmMessages] = useState<MessageWithSender[]>([])
  const [realtimeProjectMessages, setRealtimeProjectMessages] = useState<ProjectChatMessageWithSender[]>([])

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null

  // Mark DM as read when opened
  useEffect(() => {
    if (selectedConvId) markConversationReadAction(selectedConvId)
  }, [selectedConvId])

  // ── Realtime: Handle new DM messages ──────────────────────────

  const handleNewDmMessage = useCallback(async (rawMsg: any) => {
    const msgId = rawMsg.id as string

    // Check for duplicates (by id, in threadMessages + realtime state)
    if (threadMessages.some((m) => m.id === msgId) || realtimeDmMessages.some((m) => m.id === msgId)) {
      return
    }

    // Resolve sender profile
    let sender: any = null
    if (rawMsg.sender_id) {
      const supabase = createClient()
      const { data: senderData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', rawMsg.sender_id)
        .single()
      sender = senderData
    }

    // Construct full message
    const fullMsg: MessageWithSender = {
      id: msgId,
      conversation_id: rawMsg.conversation_id,
      sender_id: rawMsg.sender_id,
      body: rawMsg.body,
      created_at: rawMsg.created_at,
      attachment_path: rawMsg.attachment_path ?? null,
      attachment_name: rawMsg.attachment_name ?? null,
      attachment_type: rawMsg.attachment_type ?? null,
      attachment_size: rawMsg.attachment_size ?? null,
      sender,
    }

    setRealtimeDmMessages((prev) => [...prev, fullMsg])
  }, [threadMessages, realtimeDmMessages])

  // Subscribe to DM realtime
  useDirectMessagesRealtime(selectedConvId, handleNewDmMessage, !!selectedConvId)

  // ── Realtime: Handle new project chat messages ─────────────────

  const handleNewProjectMessage = useCallback(async (rawMsg: any) => {
    const msgId = rawMsg.id as string

    // Check for duplicates
    if (projectChatMessages.some((m) => m.id === msgId) || realtimeProjectMessages.some((m) => m.id === msgId)) {
      return
    }

    // Resolve sender profile
    let sender: any = null
    if (rawMsg.sender_id) {
      const supabase = createClient()
      const { data: senderData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', rawMsg.sender_id)
        .single()
      sender = senderData
    }

    // Construct full message
    const fullMsg: ProjectChatMessageWithSender = {
      id: msgId,
      project_id: rawMsg.project_id,
      sender_id: rawMsg.sender_id,
      body: rawMsg.body,
      created_at: rawMsg.created_at,
      message_type: rawMsg.message_type ?? 'user',
      system_event: rawMsg.system_event ?? null,
      attachment_path: rawMsg.attachment_path ?? null,
      attachment_name: rawMsg.attachment_name ?? null,
      attachment_type: rawMsg.attachment_type ?? null,
      attachment_size: rawMsg.attachment_size ?? null,
      sender,
    }

    setRealtimeProjectMessages((prev) => [...prev, fullMsg])
  }, [projectChatMessages, realtimeProjectMessages])

  // Subscribe to project chat realtime
  useProjectChatRealtime(selectedProjectId ?? '', handleNewProjectMessage, !!selectedProjectId)

  const selectConversation = (id: string) => {
    router.push(`/dashboard/messages?c=${id}`)
  }

  const selectProject = (pid: string) => {
    router.push(`/dashboard/messages?pid=${pid}`)
  }

  const goBack = () => {
    router.push('/dashboard/messages')
  }

  const handleSelectUser = (userId: string) => {
    setShowNewDialog(false)
    startStarting(async () => {
      const result = await getOrCreateConversationAction(userId)
      if (result.conversationId) {
        router.push(`/dashboard/messages?c=${result.conversationId}`)
      }
    })
  }

  // Mobile: show list OR thread
  const showingThread = !!selectedConvId || !!selectedProjectId
  const showList      = !showingThread
  const showThread    = showingThread

  // What to show in the right panel
  const rightPanel = selectedProjectId
    ? 'project'
    : selectedConvId
    ? 'dm'
    : 'empty'

  return (
    <div className="flex h-full overflow-hidden bg-[#F4F2EF]">
      {/* ── Left panel ── */}
      <div className={cn(
        'bg-white border-r border-gray-100 flex flex-col',
        'w-full lg:w-[280px] lg:shrink-0',
        showList ? 'flex' : 'hidden lg:flex'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h1 className="text-[13px] font-semibold text-gray-900">Messages</h1>
          {activeTab === 'dm' && (
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#1C3FAA] hover:text-[#162F82] px-2.5 py-1 rounded-lg hover:bg-[#F0F4FF] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          )}
        </div>

        {/* Admin tab bar */}
        {isAdmin && (
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setActiveTab('dm')}
              className={cn(
                'flex-1 py-2.5 text-[12px] font-semibold transition-colors',
                activeTab === 'dm'
                  ? 'text-[#1C3FAA] border-b-2 border-[#1C3FAA] -mb-px'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              Direct
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={cn(
                'flex-1 py-2.5 text-[12px] font-semibold transition-colors relative',
                activeTab === 'projects'
                  ? 'text-[#1C3FAA] border-b-2 border-[#1C3FAA] -mb-px'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              Projects
              {projectConversations.some((p) => p.unreadCount > 0) && activeTab !== 'projects' && (
                <span className="absolute top-2 right-4 w-1.5 h-1.5 rounded-full bg-[#1C3FAA]" />
              )}
            </button>
          </div>
        )}

        {/* List content */}
        {isAdmin && activeTab === 'projects' ? (
          <ProjectChatList
            projects={projectConversations}
            selectedProjectId={selectedProjectId}
            onSelect={(pid) => { selectProject(pid) }}
          />
        ) : (
          <ConversationList
            conversations={conversations}
            selectedConvId={selectedConvId}
            myId={profile.id}
            onSelect={selectConversation}
            onNew={() => setShowNewDialog(true)}
          />
        )}
      </div>

      {/* ── Right panel ── */}
      <div className={cn('flex-1 flex flex-col min-w-0', showThread ? 'flex' : 'hidden lg:flex')}>
        {rightPanel === 'project' ? (
          <ProjectChatThread
            profile={profile}
            projectId={selectedProjectId!}
            projectCode={selectedProjectCode}
            projectName={selectedProjectName}
            serverMessages={projectChatMessages}
            realtimeMessages={realtimeProjectMessages}
            onBack={goBack}
          />
        ) : rightPanel === 'dm' ? (
          <DmThreadView
            profile={profile}
            conv={selectedConv}
            serverMessages={threadMessages}
            realtimeMessages={realtimeDmMessages}
            onBack={goBack}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-white">
            <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            <p className="text-sm text-gray-400">
              {isAdmin ? 'Select a conversation or project chat' : 'Select a conversation to start messaging'}
            </p>
          </div>
        )}
      </div>

      {showNewDialog && (
        <NewConversationDialog
          allUsers={allUsers}
          onClose={() => setShowNewDialog(false)}
          onSelect={handleSelectUser}
          starting={starting}
        />
      )}
    </div>
  )
}
