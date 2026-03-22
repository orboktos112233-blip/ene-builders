'use client'

import { useState } from 'react'

const TRUNCATE_AT = 60
const URL_REGEX = /https?:\/\/[^\s<>"]+/g

// Splits text into plain segments and URLs, renders URLs as links.
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  URL_REGEX.lastIndex = 0
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#1C3FAA] underline hover:text-[#162F82] break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface NotesCellProps {
  notes: string | null
}

export function NotesCell({ notes }: NotesCellProps) {
  const [expanded, setExpanded] = useState(false)

  if (!notes || notes.trim() === '') {
    return <span className="text-gray-300">—</span>
  }

  const isLong = notes.length > TRUNCATE_AT
  const displayText = isLong && !expanded ? notes.slice(0, TRUNCATE_AT) + '…' : notes

  return (
    <span className="text-gray-600 text-xs">
      {linkify(displayText)}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-[#1C3FAA] hover:text-[#162F82] text-xs font-medium whitespace-nowrap"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </span>
  )
}
