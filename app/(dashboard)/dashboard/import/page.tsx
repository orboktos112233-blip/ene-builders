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
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Import Project</h1>
            <p className="text-sm text-gray-400 mt-1">
              Upload an Excel or CSV file to automatically create a project with all sections and items.
              The file is parsed in your browser — nothing is sent to the server until you confirm.
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
