import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import Pagination from '../components/ui/Pagination.jsx'
import { usePagination } from '../hooks/usePagination.js'

let API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Activity() {
  const [activities, setActivities] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)

  const activityPg = usePagination(activities, 10, [activities.length, selectedEmployee, fromDate, toDate])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    resolveApiBase().then((BASE) => {
      API = BASE
      axios.get(`${BASE}/api/employees`, { headers }).then(r => setEmployees(r.data.users || [])).catch(() => {})
      fetchActivity(BASE, '', '', '')
    })
  }, [])

  const fetchActivity = async (base, empId, from, to) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const now = new Date()
      const thirtyAgo = new Date()
      thirtyAgo.setDate(thirtyAgo.getDate() - 30)
      
      const toEnd = to ? new Date(`${to}T23:59:59`).toISOString() : now.toISOString()
      const fromStart = from ? new Date(`${from}T00:00:00`).toISOString() : thirtyAgo.toISOString()

      const params = { from: fromStart, to: toEnd }
      if (empId) params.employeeId = empId

      const r = await axios.get(`${API}/api/work/sessions/range`, { headers, params })
      const all = []
      const emps = r.data.employees || []
      emps.forEach(e => {
        (e.sessions || []).forEach(s => {
          all.push({ 
            ...s, 
            employee: e.employeeId,
            startTime: s.startedAt || s.startTime,
            endTime: s.endedAt || s.endTime
          })
        })
      })
      all.sort((a,b) => new Date(b.startTime) - new Date(a.startTime))
      setActivities(all)
    } catch {
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => fetchActivity(API, selectedEmployee, fromDate, toDate)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Activity Log</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Work sessions filtered by employee and date range.</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Employee</label>
            <select className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
              <option value="">All employees</option>
              {employees.map(u => (
                <option key={u.email} value={u.email}>
                  {(u.full_name || u.name) ? `${u.full_name || u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">From Date</label>
            <input type="date" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">To Date</label>
            <input type="date" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSearch}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
              Search
            </button>
            <button onClick={() => {
              setSelectedEmployee(''); setFromDate(''); setToDate('')
              const now = new Date(); const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
              fetchActivity(API, '', thirtyAgo.toISOString().slice(0,10), now.toISOString().slice(0,10))
            }}
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors text-sm inline-flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Start Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading activity...</td></tr>
              ) : activityPg.total === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</td></tr>
              ) : (
                activityPg.pageItems.map((a, i) => {
                  const start = new Date(a.startTime)
                  const end = a.endTime ? new Date(a.endTime) : null
                  const dur = end ? Math.round((end - start)/1000/60) : 0
                  const isActive = !end
                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{a.employee}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{start.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{end ? end.toLocaleString() : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{end ? `${Math.floor(dur/60)}h ${dur%60}m` : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'}`}>
                          {isActive ? 'Active' : 'Completed'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-5">
          {!loading && (
            <Pagination
              page={activityPg.page}
              pageCount={activityPg.pageCount}
              total={activityPg.total}
              pageSize={activityPg.pageSize}
              onPageChange={activityPg.setPage}
            />
          )}
        </div>
      </div>
    </div>
  )
}
