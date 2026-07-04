import React, { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [roleError, setRoleError] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setRoleError(false)
    try {
      const resp = await axios.post('/api/auth/forgot-password', { email })
      if (resp.data.message) {
        setSuccess(resp.data.message)
      } else {
        setSuccess('If an account exists, instructions have been sent.')
      }
    } catch (err) {
      if (err.response && err.response.data.message) {
        // Special handling for role-based errors (manager/employee)
        setError(err.response.data.message)
        if (err.response.data.error === 'Employee account' || err.response.data.error === 'Manager account') {
          setRoleError(true)
        }
      } else {
        setError('Failed to process request. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Forgot Password</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Enter your email to reset your password</p>
        </div>

        <div className="bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/60 dark:shadow-none rounded-2xl p-8 border border-slate-100 dark:border-slate-700 space-y-6 transition-colors">
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-100 dark:border-green-900/50 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}

          {error && (
            <div className={`p-4 ${roleError ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/50' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50'} text-sm rounded-lg border flex items-start`}>
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          {!success && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="you@company.com" 
                  value={email} 
                  onChange={e=>setEmail(e.target.value)} 
                  autoComplete="email" 
                  required
                />
              </div>

              <button 
                disabled={loading} 
                className="w-full bg-blue-600 text-white font-semibold rounded-lg py-3 hover:bg-blue-700 dark:hover:bg-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="text-center text-sm text-slate-600 dark:text-slate-400">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 dark:hover:text-blue-300">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
