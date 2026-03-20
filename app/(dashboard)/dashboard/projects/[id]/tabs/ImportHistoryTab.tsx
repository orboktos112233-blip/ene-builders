import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import type { ProjectImportRun, Profile } from '@/types/database'

interface ImportHistoryTabProps {
  importRun: (ProjectImportRun & { profiles: Profile }) | null
}

export function ImportHistoryTab({ importRun }: ImportHistoryTabProps) {
  if (!importRun) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-400">This project was created manually — no import history.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-gray-700">Import Record</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-gray-400">Imported by</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{importRun.profiles.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Date</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{formatDate(importRun.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Source file</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{importRun.source_file_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Sections created</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{importRun.sections_created}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Items created</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{importRun.items_created}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">TOTAL rows skipped</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{importRun.total_rows_skipped}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Empty rows skipped</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{importRun.empty_rows_skipped}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Status</dt>
            <dd className="text-sm text-gray-800 mt-0.5 capitalize">{importRun.status.replace('_', ' ')}</dd>
          </div>
        </dl>

        {importRun.parse_warnings && importRun.parse_warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1.5">
            <p className="text-xs font-semibold text-amber-700">
              Parse warnings ({importRun.parse_warnings.length})
            </p>
            {importRun.parse_warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600">
                Row {w.row_number}: {w.message}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
