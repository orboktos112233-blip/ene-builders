import { logoutAction } from '@/app/actions/auth'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-gray-200/80 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          Sign out
        </button>
      </form>
    </header>
  )
}
