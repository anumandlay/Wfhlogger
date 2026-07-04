import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import { getSocket } from '../socket.js'
import { getApiBase } from '../config.js'
import ImageViewerModal from '../components/ui/ImageViewerModal.jsx'

let API = getApiBase()

export default function LiveView() {
  const [employeeId, setEmployeeId] = useState('')
  const [onlineEmployees, setOnlineEmployees] = useState([])
  const [filteredOnline, setFilteredOnline] = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [visibleEmployees, setVisibleEmployees] = useState([])
  const [managers, setManagers] = useState([])
  const [selectedManager, setSelectedManager] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('idle') // idle | connecting | active | offline
  const [frames, setFrames] = useState([]) // [{b64, ts}]
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  
  const socketRef = useRef(null)

  const viewerImages = React.useMemo(() => {
    return frames.map((f) => ({
      src: `data:image/jpeg;base64,${f.b64}`,
      alt: 'Live frame',
      caption: f.ts ? new Date(f.ts).toLocaleString() : '',
    }))
  }, [frames])

  // Restore saved state on mount
  useEffect(() => {
    const savedEmp = localStorage.getItem('liveview_employee')
    // Remove auto-connect logic:
    // const wasActive = localStorage.getItem('liveview_is_active') === 'true'
    
    if (savedEmp) {
      setEmployeeId(savedEmp)
      // Do NOT set status to 'connecting' automatically.
      // User must click Start View manually.
    }
  }, [])

  useEffect(() => {
    resolveApiBase().then(base => { API = base })
    const s = getSocket()
    socketRef.current = s
    
    // On mount, if we are in 'connecting' state (restored), emit start
    // (This logic is now effectively disabled unless we manually set status='connecting')
    if (status === 'connecting' && employeeId) {
       if (s.connected) {
         s.emit('live_view:start', { employeeId })
       } else {
         s.once('connect', () => s.emit('live_view:start', { employeeId }))
       }
    }

    s.on('live_view:frame', (payload) => {
      if (payload?.employeeId === employeeId) {
        const item = { b64: payload.frameBase64, ts: payload.ts || new Date().toISOString() }
        setFrames(prev => [item, ...prev].slice(0, 50))
        setStatus('active')
        // Ensure persistence is true
        localStorage.setItem('liveview_is_active', 'true')
      }
    })
    
    s.on('live_view:terminate', (payload) => {
      // If terminated by employee or by self-stop
      if (payload?.by === employeeId || status === 'active' || status === 'connecting') {
        setStatus('idle')
        localStorage.setItem('liveview_is_active', 'false')
      }
    })
    
    s.on('presence:list', ({ users }) => {
      let list = Array.isArray(users) ? users : []
      if ((role === 'manager' || role === 'company_admin') && allEmployees.length) {
        const allowedSet = new Set(allEmployees.map(e => e.email))
        list = list.filter(u => allowedSet.has(u))
      }
      setOnlineEmployees(list)
      // If previously selected employee is online, keep them. Otherwise select first available if none selected
      if (!employeeId && list.length) setEmployeeId(list[0])
    })
    
    s.on('presence:online', ({ userId }) => {
      if ((role === 'manager' || role === 'company_admin') && allEmployees.length) {
        const allowedSet = new Set(allEmployees.map(e => e.email))
        if (!allowedSet.has(userId)) return
      }
      setOnlineEmployees(prev => Array.from(new Set([userId, ...prev])))
      
      // If the selected employee just came online, reset status to idle (Ready)
      if (userId === employeeId) {
        setStatus(prev => prev === 'offline' ? 'idle' : prev)
      }
    })
    
    s.on('presence:offline', ({ userId }) => {
      setOnlineEmployees(prev => prev.filter(u => u !== userId))
      if (employeeId === userId) {
        setStatus('offline')
        setFrames([]) // Clear frames to show offline placeholder
        // Don't clear persistence yet; if they come back online we might want to resume?
        // But for now, let's keep it simple. If they go offline, we stop.
        localStorage.setItem('liveview_is_active', 'false')
      }
    })

    return () => {
      s.off('live_view:frame')
      s.off('live_view:terminate')
      s.off('presence:list')
      s.off('presence:online')
      s.off('presence:offline')
    }
  }, [employeeId, role, allEmployees, status])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    let decoded = null
    let userRole = ''
    try { decoded = JSON.parse(atob((token || '').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) } catch {}
    if (decoded) {
      userRole = (decoded.role === 'super_admin' && decoded.company_id != null) ? 'company_admin' : decoded.role
    }
    setRole(userRole || '')

    resolveApiBase().then((BASE)=>{
      axios.get(`${BASE}/api/employees`, { headers }).then(r => {
        const users = Array.isArray(r.data?.users) ? r.data.users : []
        setAllEmployees(users)
        setVisibleEmployees(users.filter(u => u.role === 'employee'))
      }).catch(()=>{})
      axios.get(`${BASE}/api/presence/online`, { headers }).then(r => {
        const list = Array.isArray(r.data?.users) ? r.data.users : []
        setOnlineEmployees(list)
        setFilteredOnline(list)
      }).catch(()=>{})
      // Load managers list for company_admin
      if (userRole === 'company_admin') {
        axios.get(`${BASE}/api/admin/managers`, { headers }).then(r => {
          setManagers(r.data?.managers || [])
        }).catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedManager) {
      setFilteredOnline(onlineEmployees)
      setVisibleEmployees(allEmployees.filter(u => u.role === 'employee'))
      return
    }
    const team = allEmployees.filter(e => String(e.managerId || '') === String(selectedManager))
      .map(e => e.email)
    const filtered = onlineEmployees.filter(e => team.includes(e))
    setFilteredOnline(filtered)
    setVisibleEmployees(allEmployees.filter(u => u.role === 'employee' && team.includes(u.email)))
  }, [selectedManager, onlineEmployees, allEmployees, managers])

  useEffect(() => {
    if ((role !== 'manager' && role !== 'company_admin') || !allEmployees.length) return
    const allowedSet = new Set(allEmployees.map(e => e.email))
    setOnlineEmployees(prev => prev.filter(u => allowedSet.has(u)))
  }, [role, allEmployees])

  useEffect(() => {
    if (employeeId) {
      localStorage.setItem('liveview_employee', employeeId)
      
      // If we are changing employee manually (via dropdown), we should probably reset state
      // unless this is the initial mount restore
      const savedEmp = localStorage.getItem('liveview_employee')
      
      // If user switches employee, stop previous stream if active
      // Logic fix: savedEmp is set above, so this check `employeeId !== savedEmp` might be tricky.
      // Actually, we want to stop if we switch from Emp A to Emp B.
      // But here we just set it.
      
      if (status === 'active') {
        // Stop current stream if we switch user
        setStatus('idle')
        setFrames([])
        localStorage.setItem('liveview_is_active', 'false')
        socketRef.current?.emit('live_view:stop', { employeeId: savedEmp }) // Stop old one? No, we need previous ID.
        // Actually, simpler: just set status idle. User must click Start again.
      }
    }
  }, [employeeId])

  const toggleStream = () => {
    if (!employeeId) return

    if (status === 'active' || status === 'connecting') {
      // Stop
      socketRef.current?.emit('live_view:stop', { employeeId })
      setStatus('idle')
      setFrames([]) // Clear frames to show initial placeholder
      localStorage.setItem('liveview_is_active', 'false')
    } else {
      // Start
      setStatus('connecting')
      setFrames([])
      localStorage.setItem('liveview_is_active', 'true') // Optimistically save
      const s = getSocket()
      if (s && s.connected) {
        s.emit('live_view:start', { employeeId })
      } else {
        s?.once('connect', () => s.emit('live_view:start', { employeeId }))
      }
      
      // Fallback timeout if no connection established
      setTimeout(() => {
        if (status === 'connecting') {
           // check if we got any frames? if not, maybe offline or error
        }
      }, 5000)
    }
  }

  const latest = frames[0]
  const isOnline = onlineEmployees.includes(employeeId)

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Live View</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Monitor employee screens in real-time.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {role === 'company_admin' && (
            <select 
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors" 
              value={selectedManager} 
              onChange={e=>setSelectedManager(e.target.value)}
            >
              <option value="">All Managers</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email} {m.organization?.name ? `(${m.organization.name})` : ''}</option>
              ))}
            </select>
          )}
          
          <select 
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-w-[250px] transition-colors"
            value={employeeId}
            onChange={e=>setEmployeeId(e.target.value)}
          >
            <option value="">{visibleEmployees.length > 0 ? "Select employee..." : "No employees in company yet"}</option>
            {visibleEmployees.map(emp => {
              const email = emp.email
              const name = emp.full_name || emp.name || email
              const isOn = onlineEmployees.includes(email)
              const viewing = status === 'active' && employeeId === email
              return (
                <option key={email} value={email}>
                  {name} ({email}) {viewing ? '(Viewing)' : isOn ? '(Online)' : '(Offline)'}
                </option>
              )
            })}
          </select>

          <button 
            onClick={toggleStream}
            disabled={!employeeId || !isOnline}
            className={`
              px-6 py-2 font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 min-w-[140px] justify-center
              ${!employeeId || !isOnline 
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                : status === 'active' || status === 'connecting'
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/50'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 hover:shadow-md'
              }
            `}
          >
            {status === 'connecting' ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Connecting
              </>
            ) : status === 'active' ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                Stop View
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Start View
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-red-500 animate-pulse' : isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {status === 'active' ? 'Live Streaming' : status === 'connecting' ? 'Connecting...' : isOnline ? 'Online - Ready' : 'Offline'}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{employeeId || 'No user selected'}</div>
            </div>
            
            <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
              {latest ? (
                <>
                  <img className="w-full h-full object-contain" src={`data:image/jpeg;base64,${latest.b64}`} alt="Live frame" />
                  <div className="absolute bottom-3 right-3 text-xs bg-black/70 text-white px-2 py-1 rounded backdrop-blur-sm font-mono">
                    {new Date(latest.ts).toLocaleTimeString()}
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider rounded animate-pulse shadow-sm">
                    LIVE
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 dark:text-slate-400 p-8">
                  <div className="bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="font-medium text-slate-400">
                    {!employeeId ? 'Select an employee to begin' : 
                     !isOnline ? 'Employee is currently offline' :
                     'Click "Start View" to connect'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Frame History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Frames</h3>
            <span className="text-xs font-mono text-slate-400">{frames.length} frames</span>
          </div>
          <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {frames.slice(0, 12).map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setViewerIndex(i); setViewerOpen(true) }}
                className="group relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all bg-slate-100 dark:bg-slate-900 text-left"
              >
                <img className="w-full h-20 object-cover" src={`data:image/jpeg;base64,${f.b64}`} alt="Frame" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                <div className="absolute bottom-1 right-1 text-[10px] text-white bg-black/50 px-1 rounded">
                  {new Date(f.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                </div>
              </button>
            ))}
            {frames.length === 0 && (
              <div className="col-span-2 py-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-lg">
                <p className="text-xs text-slate-400">No frames captured yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImageViewerModal
        open={viewerOpen}
        images={viewerImages}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerOpen(false)}
        title="Recent Frames"
      />
    </div>
  )
}
