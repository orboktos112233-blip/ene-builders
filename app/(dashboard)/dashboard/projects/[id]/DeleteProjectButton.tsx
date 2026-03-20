'use client'

import { useState, useActionState } from 'react'
import { deleteProjectAction, type ProjectActionState } from '@/app/actions/projects'

const initialState: ProjectActionState = {}

interface DeleteProjectButtonProps {
  projectId: string
  projectName: string
}

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const [state, action, pending] = useActionState(deleteProjectAction, initialState)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-red-500 hover:text-red-700 px-3 py-2 rounded-xl border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors"
      >
        Delete Project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Delete Project</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    You are about to permanently delete{' '}
                    <span className="font-semibold text-gray-800">&ldquo;{projectName}&rdquo;</span>.
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    All sections, items, team assignments, and uploaded files will be removed. This action cannot be undone.
                  </p>
                </div>
              </div>

              {state.error && (
                <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
                  {state.error}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <form action={action}>
                <input type="hidden" name="project_id" value={projectId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-[0.97] rounded-xl transition-all disabled:opacity-50"
                >
                  {pending ? 'Deleting…' : 'Yes, Delete Project'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
