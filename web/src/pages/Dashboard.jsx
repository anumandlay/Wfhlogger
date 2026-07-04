import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { resolveApiBase } from '../api.js'
import { getSocket } from '../socket.js'
import ImageViewerModal from '../components/ui/ImageViewerModal.jsx'
import StorageQuotaBadge from '../components/ui/StorageQuotaBadge.jsx'

let API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Dashboard() {
  const [team, setTeam] = useState(null)
  const [role, setRole] = useState('')
  const [employeesCount, setEmployeesCount] = useState(0)
  const [employees, setEmployees] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState([])
  const [selectedManager, setSelectedManager] = useState('')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [storageQuotas, setStorageQuotas] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    resolveApiBase().then((BASE)=>{
      API = BASE
      try {
        const payload = JSON.parse(atob((token || '').split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
        const raw = payload?.role || ''
        const effective = (raw === 'super_admin' && payload?.company_id != null) ? 'company_admin' : raw
        setRole(effective)
      } catch {}
      
      // If user is company owner (super_admin), get company info directly from signup/login response context or API?
      // Actually /api/org returns the organization. For super_admin owner, we might want company name.
      // Let's modify /api/org backend to return company name for owner if available?
      // Or just use the team name which we set to Company Name on signup.
      
      const getTeamReq = axios.get(`${BASE}/api/team`, { headers })
        .then(r => {
          const t = r.data?.team || null
          if (t) setTeam(t)
          else return axios.get(`${BASE}/api/org`, { headers }).then(rr => setTeam(rr.data?.organization || null)).catch(()=>{})
        })
        .catch(() => axios.get(`${BASE}/api/org`, { headers }).then(rr => setTeam(rr.data?.organization || null)).catch(()=>{}))
      const getUsers = axios.get(`${BASE}/api/employees`, { headers }).then(r => { const list = r.data.users || []; setEmployees(list); setEmployeesCount(list.length) }).catch(()=> { setEmployees([]); setEmployeesCount(0) })
      const getFiles = axios.get(`${BASE}/api/uploads/list`, { headers }).then(r => setRecentFiles((r.data.files || []).slice(-6).reverse())).catch(()=>{})
      const getQuotas = axios.get(`${BASE}/api/storage/quota/list`, { headers }).then(r => setStorageQuotas(r.data?.quotas || [])).catch(() => {})
      Promise.allSettled([getTeamReq, getUsers, getFiles, getQuotas]).finally(() => setLoading(false))
    })
  }, [])

  useEffect(() => {
    const s = getSocket()
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    const refreshShots = () => {
      resolveApiBase().then((BASE)=>{
        axios.get(`${BASE}/api/uploads/list`, { headers })
          .then(r => setRecentFiles((r.data.files || []).slice(-6).reverse()))
          .catch(()=>{})
      })
    }
    s.on('uploads:cleanup_done', refreshShots)
    s.on('uploads:new', refreshShots)
    const refreshEmployees = () => {
      resolveApiBase().then((BASE)=>{
        axios.get(`${BASE}/api/employees`, { headers })
          .then(r => { const list = r.data.users || []; setEmployees(list); setEmployeesCount(list.length) })
          .catch(()=> { setEmployees([]); setEmployeesCount(0) })
      })
    }
    s.on('employees:updated', refreshEmployees)
    return () => { s.off('uploads:cleanup_done', refreshShots); s.off('uploads:new', refreshShots) }
  }, [])

  // Load managers for admin/manager team switcher
  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      resolveApiBase().then((BASE)=>{
        axios.get(`${BASE}/api/admin/managers`, { headers }).then(r => setManagers(r.data?.managers || [])).catch(() => {})
      })
    } catch {}
  }, [])

  // Apply manager filter to employees and recent files
  const filteredEmployees = selectedManager ? employees.filter(e => String(e.managerId || '') === String(selectedManager)) : employees
  const filteredFiles = selectedManager ? recentFiles.filter(f => filteredEmployees.map(e=>e.email).includes(f.employeeId)) : recentFiles

  const viewerImages = React.useMemo(() => {
    return filteredFiles
      .map((f) => {
        const src = f.preview_url
          ? (f.preview_url.startsWith('http') ? f.preview_url : `${API}${f.preview_url}`)
          : (f.drive_file_id || f.fileId || f.id) ? `${API}/api/uploads/preview/${f.drive_file_id || f.fileId || f.id}` : ''
        if (!src) return null
        const ts = f.ts ? new Date(f.ts) : null
        const caption = [
          f.employeeId ? `Employee: ${f.employeeId}` : null,
          ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString() : null,
        ].filter(Boolean).join(' · ')
        return {
          src,
          alt: 'Screenshot',
          caption,
        }
      })
      .filter(Boolean)
  }, [filteredFiles])

  const openViewer = (idx) => {
    setViewerIndex(idx)
    setViewerOpen(true)
  }

  const Stat = ({label, value}) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  )

  const Quick = ({to, title, desc, icon}) => (
    <Link to={to} className="group flex flex-col p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all">
      <div className="flex items-center gap-4 mb-4">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/30 dark:text-blue-400 transition-colors">
          {icon}
        </span>
        <div className="font-bold text-lg text-slate-900 dark:text-white">{title}</div>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</div>
    </Link>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Overview of your team and recent activity.</p>
        </div>
        {role === 'super_admin' && (
          <Link to="/setup" className="inline-flex items-center px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-sm">
            Configure Team
          </Link>
        )}
      </div>

      {managers.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm inline-block">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Team Context</label>
          <select 
            className="block w-full md:w-64 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            value={selectedManager} 
            onChange={e=>setSelectedManager(e.target.value)}
          >
            <option value="">All Managers</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.email} ({m.organization?.name || '-'})</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats */}
      <section className={`${role === 'company_admin' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6' : 'flex flex-wrap gap-4'}`}>
        <Stat label={(role === 'super_admin' || role === 'company_admin') ? "Company" : "Active Team"} value={team?.name || 'Not configured'} />
        <Stat label="Total Employees" value={filteredEmployees.length} />
        <Stat label="Recent Screenshots" value={filteredFiles.length} />
        {role === 'company_admin' && <Stat label="Managers" value={managers.length} />}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Quick to="/live" title="Live View" desc="Monitor active employee screens in real-time." icon={<SvgLive/>} />
          <Quick to="/report" title="Reports" desc="Generate reports, screenshots, and session insights." icon={<SvgCamera/>} />
          <Quick to="/time-tracking" title="Time Tracking" desc="Working hours, idle time, and totals by date range." icon={<SvgTime/>} />
          <Quick to="/activity" title="Activity Logs" desc="Evidence timeline and recent screenshots." icon={<SvgChart/>} />
          <Quick to="/requests" title="Requests" desc="Approve or reject manual time requests." icon={<SvgRequests/>} />
          <Quick to="/setup" title={role === 'company_admin' ? 'Company Setup' : 'Organization'} desc="Manage employees, timezones, and capture intervals." icon={<SvgCog/>} />
          {role === 'company_admin' && (
            <Quick to="/company" title="Company Profile" desc="Branding, logo, and workspace details." icon={<SvgCompany/>} />
          )}
          {role === 'company_admin' && (
            <Quick to="/billing" title="Billing" desc="Credits, payments, and invoices." icon={<SvgBilling/>} />
          )}
          {role === 'company_admin' && (
            <Quick to="/admin" title="Administration" desc="Managers, audit logs, and controls." icon={<SvgAdmin/>} />
          )}
          <Quick to="/downloads" title="Downloads" desc="Get the latest desktop tracker for Windows." icon={<SvgDownload/>} />
        </div>
      </section>

      {/* Storage Overview */}
      {role !== 'employee' && storageQuotas.length > 0 && (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white">Storage</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {storageQuotas.filter(q => q.connected).map(q => (
                <div key={q.employee_id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate mb-2" title={q.employee_id}>{q.employee_id}</div>
                  <StorageQuotaBadge quota={q} size="sm" />
                </div>
              ))}
              {storageQuotas.filter(q => !q.connected).length > 0 && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-[10px] text-slate-400">
                  {storageQuotas.filter(q => !q.connected).length} not connected
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Recent screenshots */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white">Latest Screenshots</h2>
          <Link to="/activity" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">View All</Link>
        </div>
        
        <div className="p-6">
          {recentFiles.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No screenshots captured recently.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {viewerImages.map((img, i) => {
                if (!img?.src) return null
                return (
                <button
                  key={i}
                  type="button"
                  onClick={() => openViewer(i)}
                  className="group relative aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-left"
                >
                  <img
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-xs text-white font-medium truncate w-full">
                      {img.caption || ''}
                    </span>
                  </div>
                </button>
              )})}
            </div>
          )}
        </div>
      </section>

      <ImageViewerModal
        open={viewerOpen}
        images={viewerImages}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerOpen(false)}
        title="Latest Screenshots"
      />
    </div>
  )
}

function SvgLive(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2H9l-3 3v-3H5a2 2 0 01-2-2V5z"/></svg>
  )
}
function SvgCamera(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M4 7a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7zm7 2a5 5 0 100 10 5 5 0 000-10z"/></svg>
  )
}
function SvgChart(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3 13h6v8H3v-8zm12-6h6v14h-6V7zM9 3h6v18H9V3z"/></svg>
  )
}
function SvgCog(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 8a4 4 0 110 8 4 4 0 010-8zm9 4a8.96 8.96 0 01-.6 3.2l2.1 1.6-2 3.4-2.6-1A9.08 9.08 0 0115 21.6l-.4 2.7h-3.2l-.4-2.7a9.08 9.08 0 01-3.9-1.4l-2.6 1-2-3.4 2.1-1.6A8.96 8.96 0 013 12c0-1.1.2-2.2.6-3.2L2 7.2l2-3.4 2.6 1A9.08 9.08 0 019 2.4l.4-2.7h3.2l.4 2.7a9.08 9.08 0 013.9 1.4l2.6-1 2 3.4-2.1 1.6c.4 1 .6 2.1.6 3.2z"/></svg>
  )
}
function SvgDownload(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 3a1 1 0 011 1v8.59l2.3-2.3a1 1 0 111.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.42L11 12.59V4a1 1 0 011-1zm-7 16a2 2 0 002 2h10a2 2 0 002-2v-1a1 1 0 112 0v1a4 4 0 01-4 4H7a4 4 0 01-4-4v-1a1 1 0 112 0v1z"/></svg>
  )
}

function SvgTime(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2a10 10 0 1010 10A10.012 10.012 0 0012 2zm1 11h4a1 1 0 010 2h-5a1 1 0 01-1-1V7a1 1 0 012 0z"/></svg>
  )
}

function SvgRequests(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7 2a2 2 0 00-2 2v16l4-2h10a2 2 0 002-2V4a2 2 0 00-2-2H7zm2 6h6a1 1 0 010 2H9a1 1 0 010-2zm0 4h6a1 1 0 010 2H9a1 1 0 010-2z"/></svg>
  )
}

function SvgCompany(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16h-2v-2H8v2H4zm6-4h4v-2h-4v2zm0-4h4v-2h-4v2zm0-4h4V7h-4v2zM18 21V9h2a2 2 0 012 2v10h-4z"/></svg>
  )
}

function SvgBilling(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm2 1v2h14V8H5zm0 4v5h14v-5H5zm2 3h4a1 1 0 010 2H7a1 1 0 010-2z"/></svg>
  )
}

function SvgAdmin(){
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4zm0 6a3 3 0 100 6 3 3 0 000-6zm0 8c-2.2 0-4 1.8-4 4h8c0-2.2-1.8-4-4-4z"/></svg>
  )
}
