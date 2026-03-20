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
      <main className="flex-1 overflow-y-auto bg-[#F4F2EF] px-4 py-8 lg:px-10 lg:py-10">
        <div className="max-w-3xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create New Project</h1>
            <p className="text-sm text-gray-400 mt-1">
              Fill in the project details below. You can update any field after creation.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white border border-black/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-8 py-8">
            <CreateProjectForm />
          </div>
        </div>
      </main>
    </>
  )
}
