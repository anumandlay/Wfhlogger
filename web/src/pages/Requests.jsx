import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import Pagination from '../components/ui/Pagination.jsx'
import { usePagination } from '../hooks/usePagination.js'

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [apiBase, setApiBase] = useState('')
  const [role, setRole] = useState('')

  const isManagerOrAdmin = role === 'manager' || role === 'company_admin'
  const colCount = isManagerOrAdmin ? 6 : 4

  useEffect(() => {
    resolveApiBase().then(base => {
      setApiBase(base)
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      axios.get(`${base}/api/employees`, { headers }).then(r => setEmployees(r.data.users || [])).catch(() => {})
      fetchRequests(base)
    })
    
    const token = localStorage.getItem('token')
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
        const raw = payload.role
        setRole((raw === 'super_admin' && payload.company_id != null) ? 'company_admin' : raw)
    } catch {}
  }, [])

  const fetchRequests = async (base) => {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      // Pass base URL explicitly to axios to avoid relative path issues in some envs
      const res = await axios.get(`${base}/api/requests`, { headers })
      // Ensure we set an array even if response is malformed
      const data = res.data?.requests || []
      // Sort if needed (backend does it, but safety)
      setRequests(data)
    } catch (e) {
      console.error('Fetch requests failed:', e)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id, action) => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      await axios.post(`${apiBase}/api/requests/${id}/${action}`, {}, { headers })
      fetchRequests(apiBase)
    } catch (e) {
      alert('Action failed')
    }
  }

  const displayRequests = (() => {
    let filtered = selectedEmployee
      ? requests.filter(r => r.employee_email === selectedEmployee)
      : requests
    if (fromDate) {
      filtered = filtered.filter(r => r.date >= fromDate)
    }
    if (toDate) {
      filtered = filtered.filter(r => r.date <= toDate)
    }
    return filtered
  })()
  const requestsPg = usePagination(displayRequests, 10, [role, displayRequests.length, selectedEmployee, fromDate, toDate])

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Loading...</div>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-8">
        {role === 'employee' ? 'My Time Requests' : 'Time Adjustment Requests'}
      </h1>

      {/* Employee filter for managers/admins */}
      {isManagerOrAdmin && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Filter by Employee</label>
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
              <button onClick={() => { setSelectedEmployee(''); setFromDate(''); setToDate('') }}
                className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors text-sm inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Reset
              </button>
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {displayRequests.length} request(s)
            {selectedEmployee && ' for selected employee'}
            {(fromDate || toDate) && ` · ${fromDate || '…'} to ${toDate || '…'}`}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Date</th>
              {(role === 'manager' || role === 'company_admin') && <th className="px-6 py-3">Employee</th>}
              <th className="px-6 py-3">Time Range</th>
              <th className="px-6 py-3">Reason</th>
              <th className="px-6 py-3">Status</th>
              {(role === 'manager' || role === 'company_admin') && <th className="px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {displayRequests.length === 0 ? (
              <tr><td colSpan={colCount} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">No requests found</td></tr>
            ) : (
              requestsPg.pageItems.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-3">{r.date}</td>
                  {(role === 'manager' || role === 'company_admin') && (
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{r.employee_name || 'Employee'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{r.employee_email || r.employee_id}</div>
                    </td>
                  )}
                  <td className="px-6 py-3">{r.start_time} - {r.end_time}</td>
                  <td className="px-6 py-3">{r.reason}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize 
                      ${r.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                        r.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {r.status}
                    </span>
                  </td>
                  {(role === 'manager' || role === 'company_admin') && (
                    <td className="px-6 py-3">
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(r.id, 'approve')} className="text-green-600 hover:text-green-800 font-medium">Approve</button>
                          <button onClick={() => handleAction(r.id, 'reject')} className="text-red-600 hover:text-red-800 font-medium">Reject</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 pb-5">
        <Pagination
          page={requestsPg.page}
          pageCount={requestsPg.pageCount}
          total={requestsPg.total}
          pageSize={requestsPg.pageSize}
          onPageChange={requestsPg.setPage}
        />
      </div>
    </div>
  )
}
