import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Login – ENE Builders',
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">ENE Builders</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <LoginForm />
      </div>
    </div>
  )
}
