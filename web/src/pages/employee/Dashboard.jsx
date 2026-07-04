import React, { useState, useEffect } from 'react'
import { useTheme } from '../../ThemeContext.jsx'
import axios from 'axios'
import { getSocket } from '../../socket.js'
import { getApiBaseSync } from '../../api.js'
import StorageQuotaBadge from '../../components/ui/StorageQuotaBadge.jsx'

export default function EmployeeDashboard() {
  const { theme, toggleTheme } = useTheme()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [storageQuota, setStorageQuota] = useState(null)

  useEffect(() => {
    fetchDashboardSummary()
    // Fetch own drive quota
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    const base = getApiBaseSync()
    axios.get(`${base}/api/storage/quota/self`, { headers })
      .then(r => setStorageQuota(r.data?.quota || null))
      .catch(() => {})
  }, [])
  useEffect(() => {
    const s = getSocket()
    if (!s) return
    let email = ''
    try {
      const token = localStorage.getItem('token')
      const payload = JSON.parse(atob((token || '').split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      email = payload?.email || ''
    } catch {}
    const handler = (p) => {
      if (p?.employeeId && email && p.employeeId === email) {
        fetchDashboardSummary()
      }
    }
    s.on('work:updated', handler)
    return () => { try { s.off('work:updated', handler) } catch {} }
  }, [])

  const fetchDashboardSummary = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const response = await axios.get('/api/employee/dashboard-summary', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSummary(response.data)
      if (response.data.timezone) setTimezone(response.data.timezone)
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to load dashboard data'
      setError(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const formatHours = (decimalHours) => {
    if (!decimalHours || decimalHours <= 0) return '0h 0m'
    const totalMinutes = Math.round(decimalHours * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h}h ${m}m`
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0h 0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatTime = (isoString) => {
    if (!isoString) return null
    try {
      return new Date(isoString).toLocaleString('en-US', { timeZone: timezone })
    } catch {
      return new Date(isoString).toLocaleString()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-100 dark:border-red-900/50">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={fetchDashboardSummary}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Today's Hours</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatHours(summary?.daily_hours)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">This Week</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatHours(summary?.weekly_hours)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">This Month</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatHours(summary?.monthly_hours)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Requests */}
      {(summary?.approved_requests?.length > 0 || summary?.rejected_requests?.length > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Time Requests</h2>
          </div>
          <div className="p-6 space-y-3">
            {summary.approved_requests?.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Manual Request Approved</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {r.date} · {r.start_time} - {r.end_time} · {formatHours(r.duration / 3600)} · {r.reason}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  Approved
                </span>
              </div>
            ))}
            {summary.rejected_requests?.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Manual Request Rejected</p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {r.date} · {r.start_time} - {r.end_time} · {formatHours(r.duration / 3600)} · {r.reason}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  Rejected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage */}
      {storageQuota && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <StorageQuotaBadge quota={storageQuota} size="lg" />
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Sessions</h2>
        </div>
        <div className="p-6">
          {summary?.recent_sessions?.length > 0 ? (
            <div className="space-y-4">
              {summary.recent_sessions.map((session, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {session.start_time_local || formatTime(session.start_time_utc) || 'Recent work session'}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Duration: {formatDuration(session.duration)}
                        {session.idle_time > 0 && ` (Idle: ${formatDuration(session.idle_time)})`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      session.productivity_status === 'productive' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : session.productivity_status === 'neutral'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {session.productivity_status || 'unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No recent activity</h3>
              <p className="text-slate-600 dark:text-slate-400">Your work sessions will appear here once you start tracking time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
