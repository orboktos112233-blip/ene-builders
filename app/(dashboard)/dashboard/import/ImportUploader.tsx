'use client'

import { useRef, useState, useActionState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { parseProjectRows, type ParsedProjectFile } from '@/lib/import/parser'
import { importProjectAction, type ImportActionState } from '@/app/actions/import'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { ItemStatusBadge } from '@/components/ui/Badge'

const initialState: ImportActionState = {}
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const PREVIEW_ITEMS = 4

export function ImportUploader() {
  const [state, action, pending] = useActionState(importProjectAction, initialState)

  const [parsed, setParsed] = useState<ParsedProjectFile | null>(null)
  const [projectName, setProjectName] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    setFileError('')
    setParsed(null)

    if (file.size > MAX_FILE_BYTES) {
      setFileError('File is too large. Maximum size is 10 MB.')
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      setFileError('Unsupported file type. Please upload .xlsx, .xls, or .csv.')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          defval: null,
          raw: false,       // get formatted strings, not raw numbers
        })
        const result = parseProjectRows(rows, file.name)
        setParsed(result)
        setProjectName(result.projectName)
      } catch {
        setFileError('Could not read the file. Make sure it is a valid Excel or CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const reset = () => {
    setParsed(null)
    setProjectName('')
    setFileName('')
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalItems = parsed?.sections.reduce((sum, s) => sum + s.items.length, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Drop zone — shown when no file is loaded */}
      {!parsed && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onFileInputChange}
          />
          <div className="flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Drop your Excel file here</p>
            <p className="text-xs text-gray-400">.xlsx · .xls · .csv · max 10 MB</p>
          </div>
        </div>
      )}

      {fileError && <FormError message={fileError} />}

      {/* Preview — shown after file is parsed */}
      {parsed && (
        <div className="space-y-5">
          <FormError message={state.error} />

          {/* Editable project name */}
          <Input
            id="preview_name"
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />

          {/* Summary strip */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-gray-500">{parsed.sections.length} sections</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">{totalItems} items</span>
            {parsed.totalRowsSkipped > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600">{parsed.totalRowsSkipped} total rows skipped</span>
              </>
            )}
          </div>

          {/* Warnings */}
          {parsed.parseWarnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">Parse warnings ({parsed.parseWarnings.length})</p>
              {parsed.parseWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600">Row {w.rowNumber}: {w.message}</p>
              ))}
            </div>
          )}

          {/* Section previews */}
          <div className="space-y-3">
            {parsed.sections.map((section) => (
              <div key={section.name} className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{section.name}</span>
                  <span className="text-xs text-gray-400">{section.items.length} items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-white">
                        {['Category', 'Worker', 'Material', 'Qty', 'Status', 'Vendor', 'Notes'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.slice(0, PREVIEW_ITEMS).map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                          <td className="px-3 py-2 text-gray-700">{item.category || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{item.worker || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{item.material || '—'}</td>
                          <td className="px-3 py-2 text-gray-700 text-right">
                            {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : '—'}
                          </td>
                          <td className="px-3 py-2"><ItemStatusBadge status={item.status} /></td>
                          <td className="px-3 py-2 text-gray-700">{item.vendor || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {section.items.length > PREVIEW_ITEMS && (
                    <p className="px-3 py-2 text-xs text-gray-400 bg-white border-t border-gray-50">
                      + {section.items.length - PREVIEW_ITEMS} more items
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Hidden form for Server Action submission */}
          <form action={action} className="space-y-3">
            <input type="hidden" name="project_name" value={projectName} />
            <input type="hidden" name="file_name" value={fileName} />
            <input type="hidden" name="parsed_data" value={JSON.stringify(parsed)} />

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                ← Choose different file
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={!projectName.trim()}
                size="md"
              >
                Import Project →
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
