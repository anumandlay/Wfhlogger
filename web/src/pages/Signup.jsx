import React from 'react'
import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { TextField, CountrySelect, TimezoneSelect } from '../components/FormControls.jsx'

export default function Signup() {
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState('United States')
  const [timezone, setTimezone] = useState('UTC')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMsg('')
    try {
      const resp = await axios.post('/api/auth/signup', { companyName, email, fullName, country, timezone, password })
      setMsg(resp.data?.message || 'Workspace created! Check your email for the activation link.')
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Network error'
      setError(`Signup failed: ${msg}.`)
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Create Workspace</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Start your company time tracking</p>
        </div>

        {/* Success Popup */}
        {msg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-8 text-center space-y-5">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Workspace Created!</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Check your email <strong className="text-slate-900 dark:text-slate-200">{email}</strong> for the activation link. Click the link to activate your workspace and log in.
                </p>
              </div>
              <a
                href={`https://mail.google.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                Open Gmail
              </a>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Didn't receive the email? Check your spam folder.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className={`bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/60 dark:shadow-none rounded-2xl p-8 border border-slate-100 dark:border-slate-700 space-y-6 transition-colors ${msg ? 'hidden' : ''}`}>
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          <div className="space-y-4 scroll-smooth">
            <TextField label="Company Name" value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Acme Corp" required />

            <TextField label="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="John Doe" required />
            <CountrySelect value={country} onChange={e=>setCountry(e.target.value)} required />
            <TimezoneSelect value={timezone} onChange={e=>setTimezone(e.target.value)} required />

            <TextField label="Admin Email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required type="email" autoComplete="email" />
            
            <TextField label="Password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Create a strong password" required type="password" autoComplete="new-password" />
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
                Creating Account...
              </span>
            ) : 'Create Account'}
          </button>

          <div className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 dark:hover:text-blue-300">
              Sign in
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
