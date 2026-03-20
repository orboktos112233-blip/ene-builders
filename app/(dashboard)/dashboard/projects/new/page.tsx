import { requireRole } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { CreateProjectForm } from './CreateProjectForm'

export const metadata = {
  title: 'New Project – ENE Builders',
}

export default async function NewProjectPage() {
  await requireRole(['admin', 'project_manager'])

  return (
    <>
      <Topbar title="New Project" />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-3xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
            <p className="text-sm text-gray-500 mt-1">
              Fill in the project details below. You can update any field after creation.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-8 py-8">
            <CreateProjectForm />
          </div>
        </div>
      </main>
    </>
  )
}
