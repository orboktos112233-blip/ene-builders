'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { updateAvatarUrlAction } from '@/app/actions/media'

interface AvatarUploadProps {
  userId: string
  name: string
  currentAvatarUrl: string | null
}

export function AvatarUpload({ userId, name, currentAvatarUrl }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      // One file per user — upsert overwrites the old avatar
      const path = `${userId}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      // Add cache-bust so the browser fetches the new image
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const bustedUrl = `${publicUrl}?t=${Date.now()}`

      const result = await updateAvatarUrlAction(bustedUrl)
      if (result.error) throw new Error(result.error)

      setAvatarUrl(bustedUrl)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    setUploading(true)
    setError(null)
    try {
      const result = await updateAvatarUrlAction(null)
      if (result.error) throw new Error(result.error)
      setAvatarUrl(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar with upload overlay */}
      <div className="relative group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
        <Avatar name={name} avatarUrl={avatarUrl} size="lg" />

        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          {uploading ? (
            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-gray-400">Click to upload photo</p>
        {avatarUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Remove photo
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 text-center max-w-[200px]">{error}</p>}
    </div>
  )
}
