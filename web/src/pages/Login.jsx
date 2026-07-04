import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useLocation } from 'react-router-dom'

export default function Login() {
  const routerLocation = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('company_admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activated, setActivated] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search)
    if (params.get('activated') === 'true') {
      setActivated('Workspace activated! You can now log in.')
      window.history.replaceState({}, '', window.location.pathname)
    }
    const token = params.get('token')
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      localStorage.setItem('token', token)
      window.history.replaceState({}, '', '/login')
      const redirect = params.get('redirect')
      if (redirect && redirect.startsWith('/')) {
        window.location.href = redirect
        return
      }
      const roleEff = (payload.role === 'super_admin' && payload.company_id != null) ? 'company_admin' : payload.role
      if (roleEff === 'super_admin') {
        window.location.href = '/platform'
        return
      }
      axios.get('/api/company/slug', { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          const slug = data?.slug || ''
          window.location.href = `/${slug}/dashboard`
        })
        .catch(() => {
          window.location.href = '/dashboard'
        })
    } catch (e) {
      try { window.history.replaceState({}, '', '/login') } catch {}
      setError('Login failed: invalid desktop login token.')
    }
  }, [routerLocation.search])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let client_timezone = 'UTC'
      try {
        client_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      } catch {}
      const resp = await axios.post('/api/auth/login', { email, password, role, client_timezone })
      localStorage.setItem('token', resp.data.token)
      try {
        const payload = JSON.parse(atob(resp.data.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
        const roleEff = (payload.role === 'super_admin' && payload.company_id != null) ? 'company_admin' : payload.role
        if (roleEff === 'super_admin') {
          window.location.href = '/platform'
        } else {
          try {
            const { data } = await axios.get('/api/company/slug', { headers: { Authorization: `Bearer ${resp.data.token}` } })
            const slug = data?.slug || ''
            window.location.href = `/${slug}/dashboard`
          } catch {
            window.location.href = '/dashboard'
          }
        }
      } catch {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError('Incorrect email or password. Please try again.')
      } else if (err.response && err.response.status === 403 && err.response.data?.needsActivation) {
        setError('Account not activated. Please check your email for the activation link.')
      } else if (err.response && err.response.status === 403) {
        setError('Access denied. You do not have permission to login with this role.')
      } else {
        const msg = err?.response?.data?.error || err.message || 'Network error'
        setError(`Login failed: ${msg}.`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">TimeTracker</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Sign in to your dashboard</p>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/60 dark:shadow-none rounded-2xl p-8 border border-slate-100 dark:border-slate-700 space-y-6 transition-colors">
          {activated && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg border border-emerald-200 dark:border-emerald-900/50 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {activated}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <input 
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="you@company.com" 
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                autoComplete="email" 
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors pr-10"
                  placeholder="Enter your password" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  autoComplete="current-password" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Account Type</label>
              <select 
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                value={role} 
                onChange={e=>setRole(e.target.value)}
              >
                <option value="company_admin">Company Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                <Link to="/super-admin/login" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                  Super Admin? Login here →
                </Link>
              </p>
            </div>
          </div>

          <button 
            disabled={loading} 
            className="w-full bg-blue-600 text-white font-semibold rounded-lg py-3 hover:bg-blue-700 dark:hover:bg-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>

          <div className="text-center text-sm text-slate-600 dark:text-slate-400">
            New here?{' '}
            <Link to="/signup" className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 dark:hover:text-blue-300">
              Create a workspace
            </Link>
          </div>
        </form>
        
        <p className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">
          © 2026 Time Tracker System
        </p>
      </div>
    </div>
  )
}
