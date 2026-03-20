import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Login – ENE Builders',
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      {/* Brand mark */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">ENE Builders</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your workspace</p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-black/[0.07] shadow-[0_4px_16px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)] p-8">
        <LoginForm />
      </div>
    </div>
  )
}
