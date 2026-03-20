import { requireRole } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/Card'
import { ImportUploader } from './ImportUploader'

export const metadata = {
  title: 'Import Project – ENE Builders',
}

export default async function ImportPage() {
  await requireRole(['admin', 'office'])

  return (
    <>
      <Topbar title="Import Project" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div>
            <p className="text-sm text-gray-500">
              Upload an Excel or CSV file to automatically create a project with all sections and items.
              The original file is parsed in your browser — nothing is sent to the server until you confirm.
            </p>
          </div>
          <Card>
            <CardContent className="py-6">
              <ImportUploader />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
