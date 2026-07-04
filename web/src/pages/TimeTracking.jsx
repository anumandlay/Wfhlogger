import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import Pagination from '../components/ui/Pagination.jsx'
import { usePagination } from '../hooks/usePagination.js'
import ImageViewerModal from '../components/ui/ImageViewerModal.jsx'
import StorageQuotaBadge from '../components/ui/StorageQuotaBadge.jsx'
import { Clock, Download, HardDrive, Search, Users } from 'lucide-react'

let API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m`
}

function toStartISO(ds) {
  if (!ds) return null
  return new Date(`${ds}T00:00:00`).toISOString()
}

function toEndISO(ds) {
  if (!ds) return null
  const end = new Date(`${ds}T00:00:00`).getTime() + 24 * 60 * 60 * 1000 - 1
  return new Date(end).toISOString()
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Icon className="w-5 h-5" />
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
          {sub && <div className="text-xs text-slate-400">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

export default function TimeTracking() {
  const [tab, setTab] = useState('time')
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [grouped, setGrouped] = useState([])
  const [files, setFiles] = useState([])
  const [focusedEmployee, setFocusedEmployee] = useState('')
  const [msg, setMsg] = useState('')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [storageQuota, setStorageQuota] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [storageModalOpen, setStorageModalOpen] = useState(false)

  const employeeNameByEmail = useMemo(() => {
    const map = new Map()
    for (const u of employees) {
      if (u?.email) map.set(u.email, u?.full_name || u?.name || '')
    }
    return map
  }, [employees])

  const employeeSummaries = useMemo(() => {
    const out = []
    for (const e of grouped) {
      const email = e?.employeeId
      const list = Array.isArray(e?.sessions) ? e.sessions : []
      let active = 0, idle = 0, net = 0, firstStartMs = null, lastEndMs = null
      let firstStartLocal = null, lastEndLocal = null, timezone = null
      for (const s of list) {
        active += Number(s?.activeSeconds) || 0
        idle += Number(s?.idleSeconds) || 0
        net += Number(s?.netActiveSeconds) || 0
        timezone = timezone || s?.timezone || null
        const st = s?.startedAt ? Date.parse(s.startedAt) : null
        const en = s?.endedAt ? Date.parse(s.endedAt) : null
        if (Number.isFinite(st) && (firstStartMs == null || st < firstStartMs)) {
          firstStartMs = st; firstStartLocal = s?.startedAt_local || null
        }
        if (Number.isFinite(en) && (lastEndMs == null || en > lastEndMs)) {
          lastEndMs = en; lastEndLocal = s?.endedAt_local || null
        }
      }
      out.push({ email, name: employeeNameByEmail.get(email) || '', sessionsCount: list.length, activeSeconds: active, idleSeconds: idle, netSeconds: net, firstStartLocal, lastEndLocal, timezone })
    }
    out.sort((a, b) => (b.netSeconds || 0) - (a.netSeconds || 0))
    return out
  }, [employeeNameByEmail, grouped])

  const overall = useMemo(() => {
    let active = 0, idle = 0, net = 0, sessionsCount = 0
    for (const e of grouped) {
      const list = Array.isArray(e?.sessions) ? e.sessions : []
      sessionsCount += list.length
      for (const s of list) {
        active += Number(s?.activeSeconds) || 0
        idle += Number(s?.idleSeconds) || 0
        net += Number(s?.netActiveSeconds) || 0
      }
    }
    return { activeSeconds: active, idleSeconds: idle, netSeconds: net, sessionsCount }
  }, [grouped])

  const employeesPg = usePagination(employeeSummaries, 10, [employeeSummaries.length, fromDate, toDate, selectedEmployee])
  const filesPg = usePagination(files, 10, [selectedEmployee, fromDate, toDate, files.length])

  const focusEmail = focusedEmployee || selectedEmployee
  const focusName = focusEmail ? (employeeNameByEmail.get(focusEmail) || '') : ''

  const focusedSessions = useMemo(() => {
    const email = focusEmail
    if (!email) return []
    const match = grouped.find(x => String(x?.employeeId || '').toLowerCase() === String(email).toLowerCase())
    const list = Array.isArray(match?.sessions) ? match.sessions : []
    return list.slice().sort((a, b) => {
      const am = a?.startedAt ? Date.parse(a.startedAt) : 0
      const bm = b?.startedAt ? Date.parse(b.startedAt) : 0
      return bm - am
    })
  }, [focusEmail, grouped])

  const sessionsPg = usePagination(focusedSessions, 10, [focusEmail, fromDate, toDate, focusedSessions.length])

  const viewerImages = useMemo(() => {
    return files.map((f) => {
      const src = f.preview_url
        ? (f.preview_url.startsWith('http') ? f.preview_url : `${API}${f.preview_url}`)
        : (f.drive_file_id || f.fileId || f.id) ? `${API}/api/uploads/preview/${f.drive_file_id || f.fileId || f.id}` : ''
      if (!src) return null
      return { src, alt: 'Screenshot', caption: [f.employeeId ? `Employee: ${f.employeeId}` : null, f.ts_local || (f.ts ? new Date(f.ts).toLocaleString() : null)].filter(Boolean).join(' · ') }
    }).filter(Boolean)
  }, [files])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    resolveApiBase().then((BASE) => {
      API = BASE
      axios.get(`${BASE}/api/employees`, { headers }).then(r => setEmployees(r.data.users || [])).catch(() => {})
    })
  }, [])

  useEffect(() => {
    const eid = String(selectedEmployee || '').trim()
    if (!eid) { setStorageQuota(null); return }
    setQuotaLoading(true)
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    resolveApiBase().then((BASE) =>
      axios.get(`${BASE}/api/storage/quota`, { headers, params: { employeeId: eid } })
        .then(r => setStorageQuota(r.data?.quota || null))
        .catch(() => setStorageQuota(null))
        .finally(() => setQuotaLoading(false))
    )
  }, [selectedEmployee])

  const search = async () => {
    setLoading(true)
    setMsg('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const employeeId = (selectedEmployee || '').trim()
      const params = {}
      if (employeeId) params.employeeId = employeeId

      if (fromDate && !toDate) {
        params.from = toStartISO(fromDate)
        params.to = toEndISO(fromDate)
      } else {
        if (fromDate) params.from = toStartISO(fromDate)
        if (toDate) params.to = toEndISO(toDate)
      }

      const [shotsRes, sessRes] = await Promise.all([
        axios.get(`${API}/api/uploads/query`, { headers, params }).catch(() => ({ data: { files: [] } })),
        axios.get(`${API}/api/work/sessions/range`, { headers, params })
      ])

      setFiles(shotsRes.data?.files || [])
      const list = Array.isArray(sessRes.data?.employees) ? sessRes.data.employees : []
      setGrouped(list)
      if (employeeId) setFocusedEmployee(employeeId)
      if (!employeeId) setFocusedEmployee('')
    } catch (e) {
      setGrouped([]); setFiles([]); setFocusedEmployee('')
      setMsg(e?.response?.data?.error || 'Failed to load data.')
    } finally { setLoading(false) }
  }

  const downloadZip = async () => {
    const employeeId = String(selectedEmployee || '').trim()
    if (!employeeId) { alert('Select an employee first'); return }
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    const params = { employeeId }
    if (fromDate) params.from = fromDate
    if (toDate) params.to = toDate
    const r = await axios.get(`${API}/api/uploads/zip`, { headers, params, responseType: 'blob' })
    const safe = employeeId.replace(/[^a-z0-9._-]+/gi, '_')
    const blob = new Blob([r.data], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `screenshots_${safe}.zip`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Time Tracking</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Track work sessions, screenshots, and activity.</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 inline-flex">
          <button onClick={() => setTab('time')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'time' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}>Sessions</button>
          <button onClick={() => setTab('screenshots')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'screenshots' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}>Screenshots</button>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">{msg}</div>}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2 md:col-span-2">
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
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={search} disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-70 inline-flex items-center gap-2">
            <Clock className="w-4 h-4" />{loading ? 'Searching...' : 'Search'}
          </button>
          <button onClick={() => {
            setSelectedEmployee(''); setFromDate(''); setToDate('')
            setGrouped([]); setFiles([]); setMsg(''); setFocusedEmployee('')
          }} className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/40 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Reset
          </button>
          <button onClick={downloadZip} disabled={!selectedEmployee}
            className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/40 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm">
            <Download className="w-4 h-4" />ZIP
          </button>
          <button onClick={() => setStorageModalOpen(true)} disabled={!selectedEmployee}
            className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/40 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm">
            <HardDrive className="w-4 h-4" />Drive
          </button>
          {selectedEmployee && storageQuota?.connected && (
            <StorageQuotaBadge quota={storageQuota} size="sm" />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Clock} label="Net Working" value={formatDuration(overall.netSeconds)} />
        <StatCard icon={Clock} label="Idle Time" value={formatDuration(overall.idleSeconds)} />
        <StatCard icon={Clock} label="Active Time" value={formatDuration(overall.activeSeconds)} />
        <StatCard icon={Users} label="Sessions" value={String(overall.sessionsCount)} sub={focusEmail ? focusName || focusEmail : ''} />
        {storageQuota?.connected && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <StorageQuotaBadge quota={storageQuota} size="lg" />
          </div>
        )}
      </div>

      {/* Sessions Tab */}
      {tab === 'time' && (
        <>
          {/* Employee table */}
          {!selectedEmployee && employeeSummaries.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="text-base font-bold text-slate-900 dark:text-white">Employees</div>
                <div className="text-xs text-slate-500 mt-0.5">{employeeSummaries.length} employees · click row to see sessions</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold uppercase text-xs">
                    <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">End</th><th className="px-4 py-3">Net</th><th className="px-4 py-3">Idle</th><th className="px-4 py-3">Sessions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {employeesPg.total === 0 ? (
                      <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-400">No data</td></tr>
                    ) : (
                      employeesPg.pageItems.map((r) => (
                        <tr key={r.email} onClick={() => setFocusedEmployee(prev => prev === r.email ? '' : r.email)}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer ${focusedEmployee === r.email ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                          <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{r.name || '—'}</td>
                          <td className="px-4 py-3">{r.email}</td>
                          <td className="px-4 py-3">{r.firstStartLocal || '—'}</td>
                          <td className="px-4 py-3">{r.lastEndLocal || '—'}</td>
                          <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold">{formatDuration(r.netSeconds)}</td>
                          <td className="px-4 py-3">{formatDuration(r.idleSeconds)}</td>
                          <td className="px-4 py-3">{String(r.sessionsCount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-5"><Pagination page={employeesPg.page} pageCount={employeesPg.pageCount} total={employeesPg.total} pageSize={employeesPg.pageSize} onPageChange={employeesPg.setPage} /></div>
            </div>
          )}

          {/* Session details */}
          {focusedSessions.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">Sessions {focusName ? `· ${focusName}` : ''}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{focusedSessions.length} sessions</div>
                </div>
                {!selectedEmployee && focusedEmployee && (
                  <button onClick={() => setFocusedEmployee('')} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40">Close</button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold uppercase text-xs">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">End</th><th className="px-4 py-3">Active</th><th className="px-4 py-3">Idle</th><th className="px-4 py-3">Net</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sessionsPg.pageItems.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3">{s.date_local || s.date || '—'}</td>
                        <td className="px-4 py-3">{s.startedAt_local || '—'}</td>
                        <td className="px-4 py-3">{s.endedAt_local || <span className="text-green-600 dark:text-green-400 font-semibold">Active</span>}</td>
                        <td className="px-4 py-3">{formatDuration(s.activeSeconds)}</td>
                        <td className="px-4 py-3">{formatDuration(s.idleSeconds)}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold">{formatDuration(s.netActiveSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-5"><Pagination page={sessionsPg.page} pageCount={sessionsPg.pageCount} total={sessionsPg.total} pageSize={sessionsPg.pageSize} onPageChange={sessionsPg.setPage} /></div>
            </div>
          )}

          {employeeSummaries.length === 0 && focusedSessions.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-10 text-center">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">Select filters and search to see time tracking data.</p>
            </div>
          )}
        </>
      )}

      {/* Screenshots Tab */}
      {tab === 'screenshots' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="text-base font-bold text-slate-900 dark:text-white">Screenshots ({files.length})</div>
            <div className="text-xs text-slate-500 mt-0.5">Click an image to view full size</div>
          </div>
          <div className="p-5">
            {files.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No screenshots found. Use filters and search first.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filesPg.pageItems.map((f, i) => {
                    const src = f.preview_url
                      ? (f.preview_url.startsWith('http') ? f.preview_url : `${API}${f.preview_url}`)
                      : (f.drive_file_id || f.fileId || f.id) ? `${API}/api/uploads/preview/${f.drive_file_id || f.fileId || f.id}` : null
                    if (!src) return null
                    return (
                      <button key={i} onClick={() => {
                        const id = String(f?.drive_file_id || f?.fileId || f?.id || '')
                        const idx = Math.max(0, viewerImages.findIndex(it => String(it?.src || '').includes(id)))
                        setViewerIndex(idx); setViewerOpen(true)
                      }} className="group relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-blue-500 transition-all">
                        <img src={src} alt="Screenshot" className="w-full h-28 object-cover bg-slate-100 dark:bg-slate-900" loading="lazy" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5"><Pagination page={filesPg.page} pageCount={filesPg.pageCount} total={filesPg.total} pageSize={filesPg.pageSize} onPageChange={filesPg.setPage} /></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Storage Modal */}
      {storageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setStorageModalOpen(false) }}>
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">Storage</div>
                <div className="text-xs text-slate-500 truncate max-w-[18rem]">{String(selectedEmployee || '').trim()}</div>
              </div>
              <button onClick={() => setStorageModalOpen(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
            </div>
            <div className="p-5">
              {quotaLoading ? <div className="text-sm text-slate-600">Loading…</div>
              : (!storageQuota || !storageQuota.connected) ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">Storage not connected.</div>
              : (() => {
                  const usedBytes = storageQuota?.used_bytes != null ? Number(storageQuota.used_bytes) : null
                  const formatBytes = (b) => { const n = Number(b); if (!Number.isFinite(n) || n < 0) return '—'; const gb = n / 1e9; if (gb >= 1) return `${gb.toFixed(2)} GB`; const mb = n / 1e6; return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(n / 1024).toFixed(2)} KB` }
                  return (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Used</div>
                        <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{usedBytes != null ? formatBytes(usedBytes) : 'Unknown'}</div>
                        {storageQuota?.total_files != null && <div className="text-xs text-slate-500 mt-1">{storageQuota.total_files} file(s)</div>}
                      </div>
                      {!!storageQuota?.updated_at && <div className="text-xs text-slate-500">Updated: {new Date(storageQuota.updated_at).toLocaleString()}</div>}
                    </div>
                  )
                })()
              }
            </div>
          </div>
        </div>
      )}

      <ImageViewerModal open={viewerOpen} onClose={() => setViewerOpen(false)} images={viewerImages} index={viewerIndex} onIndexChange={setViewerIndex} />
    </div>
  )
}
