import { requireRole } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/Card'
import { CreateProjectForm } from './CreateProjectForm'

export const metadata = {
  title: 'New Project – ENE Builders',
}

export default async function NewProjectPage() {
  await requireRole(['admin', 'project_manager'])

  return (
    <>
      <Topbar title="New Project" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-6">
              <CreateProjectForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
