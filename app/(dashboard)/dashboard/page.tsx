import { requireAuth } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import type { Project, ProjectStatus } from '@/types/database'

const STATUS_ORDER: ProjectStatus[] = ['planning', 'demolition', 'framing', 'finishing', 'completed']
const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  demolition: 'Demolition',
  framing: 'Framing',
  finishing: 'Finishing',
  completed: 'Completed',
}

export const metadata = {
  title: 'Dashboard – ENE Builders',
}

export default async function DashboardPage() {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const allProjects = (projectsData as Project[] | null) ?? []

  // Count by status
  const countByStatus = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = allProjects.filter((p) => p.status === s).length
    return acc
  }, {})

  const recentProjects = allProjects.slice(0, 5)

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Welcome */}
          <p className="text-gray-500 text-sm">
            Welcome back, <span className="font-medium text-gray-800">{profile.full_name}</span>
          </p>

          {/* Status summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STATUS_ORDER.map((status) => (
              <Card key={status}>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{countByStatus[status]}</p>
                  <p className="text-xs text-gray-500 mt-1">{STATUS_LABELS[status]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent projects */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Recent Projects</h2>
              <Link href="/dashboard/projects" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>
            {recentProjects.length === 0 ? (
              <CardContent>
                <p className="text-sm text-gray-400 text-center py-6">No projects yet.</p>
              </CardContent>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-400">{project.project_code}</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div className="hidden sm:block text-xs text-gray-400">
                        {formatDate(project.estimated_end_date)}
                      </div>
                      {project.budget_total != null && (
                        <div className="hidden md:block text-xs text-gray-500">
                          {formatCurrency(project.budget_total)}
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
