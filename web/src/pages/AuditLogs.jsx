import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import Pagination from '../components/ui/Pagination.jsx'
import { usePagination } from '../hooks/usePagination.js'
import { AuditDetailsDrawer } from '../components/admin/AuditDetailsDrawer.jsx'
import { FileText, RefreshCw, Search, UserPlus, UserX, CreditCard, Globe, Settings2, CheckCircle2, AlertTriangle, Monitor, KeyRound, Clock, Users, DollarSign } from 'lucide-react'

const EVENT_META = {
  employee_created: { label: 'Employee Created', icon: UserPlus, tone: 'emerald', desc: 'A new employee was added to the company' },
  employee_deleted: { label: 'Employee Removed', icon: UserX, tone: 'rose', desc: 'An employee was removed from the company' },
  manager_created: { label: 'Manager Created', icon: UserPlus, tone: 'blue', desc: 'A new manager account was created' },
  manager_deleted: { label: 'Manager Removed', icon: UserX, tone: 'rose', desc: 'A manager was removed' },
  employee_timezone_updated: { label: 'Timezone Changed', icon: Globe, tone: 'blue', desc: 'An employee timezone was updated' },
  interval_set: { label: 'Capture Interval Changed', icon: Settings2, tone: 'violet', desc: 'Screenshot capture interval was modified' },
  payment_success: { label: 'Payment Received', icon: CreditCard, tone: 'emerald', desc: 'A payment was successfully processed' },
  company_free_credits_granted: { label: 'Credits Added', icon: DollarSign, tone: 'emerald', desc: 'Credits were added to the account' },
  invoice_generated: { label: 'Invoice Generated', icon: FileText, tone: 'blue', desc: 'A new invoice was created' },
  billing_low_credits: { label: 'Low Credits Warning', icon: AlertTriangle, tone: 'amber', desc: 'Credit balance is running low' },
  billing_suspended: { label: 'Account Suspended', icon: AlertTriangle, tone: 'rose', desc: 'Account was suspended due to insufficient credits' },
  request_approved: { label: 'Request Approved', icon: CheckCircle2, tone: 'emerald', desc: 'A time request was approved' },
  request_rejected: { label: 'Request Rejected', icon: UserX, tone: 'rose', desc: 'A time request was rejected' },
  live_view_start: { label: 'Live View Started', icon: Monitor, tone: 'blue', desc: 'A manager started viewing an employee live' },
  live_view_stop: { label: 'Live View Stopped', icon: Monitor, tone: 'slate', desc: 'Live view session ended' },
  employee_web_login: { label: 'Employee Login', icon: KeyRound, tone: 'blue', desc: 'Employee logged into the web app' },
  company_profile_updated: { label: 'Company Profile Updated', icon: Globe, tone: 'blue', desc: 'Company name or logo was updated' },
  rbac_forbidden: { label: 'Access Blocked', icon: KeyRound, tone: 'rose', desc: 'An unauthorized access attempt was blocked' },
  rbac_invalid_token: { label: 'Invalid Login Token', icon: KeyRound, tone: 'rose', desc: 'An invalid authentication token was used' },
}

function getEventMeta(type) {
  if (EVENT_META[type]) return EVENT_META[type]
  if (type.startsWith('request_')) return { label: 'Request Updated', icon: FileText, tone: 'blue', desc: 'A time request status changed' }
  return { label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: FileText, tone: 'slate', desc: 'An event occurred in the system' }
}

function toneClasses(tone) {
  const map = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-900/40',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border-violet-200 dark:border-violet-900/40',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-900/40',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-900/40',
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  }
  return map[tone] || map.slate
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const [filterActor, setFilterActor] = useState('')
  const [filterTarget, setFilterTarget] = useState('')
  const [filterEvent, setFilterEvent] = useState('')

  const logsPg = usePagination(logs, 15, [logs.length, filterActor, filterTarget, filterEvent])

  const eventTypes = useMemo(() => {
    const set = new Set()
    for (const l of logs) set.add(l.type)
    return Array.from(set).sort()
  }, [logs])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const params = {}
      if (filterActor) params.managerId = filterActor
      if (filterTarget) params.employeeId = filterTarget
      if (filterEvent) params.type = filterEvent
      const BASE = await resolveApiBase()
      const r = await axios.get(`${BASE}/api/admin/audit-logs`, { headers, params })
      setLogs(r.data?.logs || [])
    } catch { setLogs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [filterActor, filterTarget, filterEvent])

  const filtered = logs

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Audit Logs</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Complete activity history for your company.</p>
        </div>
        <button onClick={fetchLogs} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              placeholder="Filter by person (name/email)..."
              value={filterActor} onChange={e => setFilterActor(e.target.value)} />
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              placeholder="Filter by target employee..."
              value={filterTarget} onChange={e => setFilterTarget(e.target.value)} />
          </div>
          <select className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
            <option value="">All Events</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>
                {EVENT_META[t]?.label || t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading activity...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No activity found for this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logsPg.pageItems.map((l, i) => {
              const meta = getEventMeta(l?.type || '')
              const Icon = meta.icon
              const actor = l.actor?.name || l.actor?.email || l.details?.actorId || l.details?.actorEmail || 'System'
              const target = l.targetEmployee?.name || l.targetEmployee?.email || l.details?.employeeEmail || l.details?.employeeId || null
              const ts = l.ts_local || (l.ts ? new Date(l.ts).toLocaleString() : '-')
              const tone = toneClasses(meta.tone)
              return (
                <button key={i} onClick={() => setSelectedLog(l)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-start gap-4">
                  <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{meta.label}</span>
                      <span className="text-xs text-slate-400">{ts}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      {l.summary || `${meta.desc}${target ? ` for ${target}` : ''}`}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <Users className="w-3 h-3" />
                      <span>{actor}</span>
                      {target && <><span className="mx-1">→</span><span>{target}</span></>}
                    </div>
                  </div>
                  <span className={`shrink-0 hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold ${tone}`}>
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-5 pb-5 pt-3">
            <Pagination page={logsPg.page} pageCount={logsPg.pageCount} total={logsPg.total} pageSize={logsPg.pageSize} onPageChange={logsPg.setPage} />
          </div>
        )}
      </div>

      <AuditDetailsDrawer open={!!selectedLog} onClose={() => setSelectedLog(null)} log={selectedLog} />
    </div>
  )
}
