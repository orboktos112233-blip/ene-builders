import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate, formatCurrency } from '@/lib/utils'
import { canCreateProject } from '@/lib/auth/permissions'
import Link from 'next/link'
import type { Project, ProjectStatus } from '@/types/database'

export const metadata = {
  title: 'Projects – ENE Builders',
}

export default async function ProjectsPage() {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const projects = projectsData as Project[] | null

  return (
    <>
      <Topbar title="Projects" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {projects?.length ?? 0} project{projects?.length !== 1 ? 's' : ''}
            </p>
            {canCreateProject(profile.role) && (
              <Link href="/dashboard/projects/new">
                <Button size="sm">+ New Project</Button>
              </Link>
            )}
          </div>

          {/* Project list */}
          <Card>
            {!projects || projects.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-gray-400">No projects yet.</p>
                {canCreateProject(profile.role) && (
                  <Link href="/dashboard/projects/new">
                    <Button size="sm" variant="secondary" className="mt-3">
                      Create first project
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">{project.project_code}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{project.name}</p>
                      {project.address && (
                        <p className="text-xs text-gray-400 mt-0.5">{project.address}</p>
                      )}
                      {project.client_name && (
                        <p className="text-xs text-gray-500 mt-0.5">Client: {project.client_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-6 shrink-0 ml-4">
                      <div className="hidden md:block text-right">
                        <p className="text-xs text-gray-400">Est. completion</p>
                        <p className="text-xs text-gray-700">{formatDate(project.estimated_end_date)}</p>
                      </div>
                      {project.budget_total != null && (
                        <div className="hidden md:block text-right">
                          <p className="text-xs text-gray-400">Budget</p>
                          <p className="text-xs text-gray-700">{formatCurrency(project.budget_total)}</p>
                        </div>
                      )}
                      <StatusBadge status={project.status as ProjectStatus} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

        </div>
      </main>
    </>
  )
}
