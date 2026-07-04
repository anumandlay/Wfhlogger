import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import { TextField, CountrySelect, TimezoneSelect } from '../components/FormControls.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import { usePagination } from '../hooks/usePagination.js'
import { Edit3, Plus, RefreshCw, X } from 'lucide-react'

export default function Admin() {
  const [email, setEmail] = useState('manager@example.com')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('United States')
  const [timezone, setTimezone] = useState('UTC')
  const [password, setPassword] = useState('secret')
  const [orgName, setOrgName] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [managers, setManagers] = useState([])
  const [managerCreds, setManagerCreds] = useState([])

  const submit = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const BASE = await resolveApiBase()
      if (!orgName || !orgName.trim()) { setError('Team name is required'); return }
      if (!name || !name.trim()) { setError('Full Name is required'); return }
      if (!country || !country.trim()) { setError('Country is required'); return }
      if (!timezone || !timezone.trim()) { setError('Timezone is required'); return }
      const r = await axios.post(`${BASE}/api/admin/managers`, { email, name, country, timezone, password, orgName }, { headers })
      setMsg(`Manager ${r.data?.manager?.email} created${r.data?.organization ? ' with team '+r.data.organization.name : ''}.`)
      setEmail(''); setPassword(''); setOrgName(''); setName(''); setCountry('United States'); setTimezone('UTC')
      loadManagers()
      loadManagerCreds()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    }
  }

  const loadManagers = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const BASE = await resolveApiBase()
      const r = await axios.get(`${BASE}/api/admin/managers`, { headers })
      setManagers(r.data?.managers || [])
    } catch {}
  }

  const loadManagerCreds = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const BASE = await resolveApiBase()
      const r = await axios.get(`${BASE}/api/admin/managers/creds`, { headers })
      setManagerCreds(r.data?.creds || [])
    } catch {}
  }

  useEffect(() => {
    loadManagers()
    loadManagerCreds()
  }, [])

  const [removingManager, setRemovingManager] = useState(null)
  const [removeReassign, setRemoveReassign] = useState('')
  const [removeSaving, setRemoveSaving] = useState(false)

  const openRemove = (m) => {
    setRemovingManager(m)
    setRemoveReassign('')
    setError('')
  }

  const confirmRemove = async () => {
    if (!removingManager) return
    setRemoveSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const BASE = await resolveApiBase()
      // If reassign selected, move employees first
      if (removeReassign) {
        await axios.put(`${BASE}/api/admin/managers/${removingManager.id}`, { reassign_to_id: removeReassign }, { headers })
      }
      // Then delete the manager
      await axios.delete(`${BASE}/api/admin/managers/${removingManager.id}`, { headers })
      setMsg('Manager removed')
      setRemovingManager(null)
      loadManagers()
      loadManagerCreds()
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setRemoveSaving(false)
    }
  }

  const [editingManager, setEditingManager] = useState(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const openEdit = (m) => {
    setEditingManager(m)
    setEditName(m.full_name || '')
    setEditEmail(m.email || '')
  }

  const saveEdit = async () => {
    if (!editingManager) return
    setEditSaving(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const BASE = await resolveApiBase()
      const body = {}
      if (editName && editName !== editingManager.full_name) body.full_name = editName
      if (editEmail && editEmail !== editingManager.email) body.email = editEmail
      if (Object.keys(body).length === 0) { setEditingManager(null); setEditSaving(false); return }
      await axios.put(`${BASE}/api/admin/managers/${editingManager.id}`, body, { headers })
      setMsg('Manager updated successfully')
      setEditingManager(null)
      loadManagers()
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to update manager')
    } finally {
      setEditSaving(false)
    }
  }

  const managersPg = usePagination(managers, 10, [managers.length])
  const managerCredsPg = usePagination(managerCreds, 10, [managerCreds.length])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Administration</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Create and manage managers for your company.</p>
      </div>

      {(error || msg) && (
        <div className="space-y-2">
          {error && <div className="text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-xl">{error}</div>}
          {msg && <div className="text-blue-700 dark:text-blue-300 text-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3 rounded-xl">{msg}</div>}
        </div>
      )}

      {/* Create Manager Form */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Manager</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Add a new manager with their own team.</p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full">
            <Plus className="w-3.5 h-3.5" />
            New account
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
            <TextField label="Full Name" value={name} onChange={e=>setName(e.target.value)} placeholder="John Doe" />
            <TextField label="Email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="manager@example.com" />
            <TextField label="Password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Secret" type="password" />
            <CountrySelect value={country} onChange={e=>setCountry(e.target.value)} />
            <TimezoneSelect value={timezone} onChange={e=>setTimezone(e.target.value)} />
            <TextField label="Team Name" value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Engineering" />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Screenshots stored in employee-owned Google Drive.</p>
            <button className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm dark:bg-slate-700 dark:hover:bg-slate-600" type="submit">
              Create Account
            </button>
          </div>
        </form>
      </section>

      {/* Managers Table */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Managers ({managers.length})</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">All managers in your company.</p>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" onClick={loadManagers} type="button">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employees</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {managersPg.total === 0 ? (
                <tr><td colSpan="5" className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No managers yet.</td></tr>
              ) : (
                managersPg.pageItems.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{m.full_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{m.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{m.organization?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{m.employeeCount}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-semibold mr-3" onClick={()=>openEdit(m)} type="button">Edit</button>
                      <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-semibold" onClick={()=>openRemove(m)} type="button">Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-5 pt-3">
          <Pagination page={managersPg.page} pageCount={managersPg.pageCount} total={managersPg.total} pageSize={managersPg.pageSize} onPageChange={managersPg.setPage} />
        </div>
      </section>

      {/* Credentials Table */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Manager Initial Credentials</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Temporary passwords for new managers.</p>
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" onClick={loadManagerCreds} type="button">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Initial Password</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {managerCredsPg.total === 0 ? (
                <tr><td colSpan="3" className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No credentials yet.</td></tr>
              ) : (
                managerCredsPg.pageItems.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{c.manager_email}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200 font-mono">{c.temp_password}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-5 pt-3">
          <Pagination page={managerCredsPg.page} pageCount={managerCredsPg.pageCount} total={managerCredsPg.total} pageSize={managerCredsPg.pageSize} onPageChange={managerCredsPg.setPage} />
        </div>
        <div className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          For security, advise managers to change their password after first login.
        </div>
      </section>

      {/* Edit Manager Modal */}
      {editingManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingManager(null) }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">Edit Manager</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{editingManager.email}</div>
              </div>
              <button onClick={() => setEditingManager(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <TextField label="Full Name" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Manager name" />
              <TextField label="Email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="manager@example.com" />
              {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setEditingManager(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-70">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Manager Modal */}
      {removingManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setRemovingManager(null) }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">Remove Manager</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{removingManager.email}</div>
              </div>
              <button onClick={() => setRemovingManager(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                This will permanently remove this manager. If they have employees, reassign them first.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reassign Employees To</label>
                <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  value={removeReassign} onChange={e => setRemoveReassign(e.target.value)}>
                  <option value="">— Remove employees too —</option>
                  {managers.filter(m => String(m.id) !== String(removingManager.id)).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name || m.email} ({m.organization?.name || 'No team'})</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select a manager to move employees to before deletion.</p>
              </div>
              {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setRemovingManager(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={confirmRemove} disabled={removeSaving} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-70 inline-flex items-center gap-2">
                {removeSaving ? 'Removing...' : 'Remove Manager'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
