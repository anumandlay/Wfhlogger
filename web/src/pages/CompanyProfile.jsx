import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'

export default function CompanyProfile() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [company, setCompany] = useState({ name: '', logo_url: '', billing_email: '', admin_contact_email: '', subscription_plan: '', credit_balance: 0 })
  const [logoFile, setLogoFile] = useState(null)
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const previewLogo = logoFile ? URL.createObjectURL(logoFile) : company.logo_url

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const base = await resolveApiBase()
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const { data } = await axios.get(`${base}/api/company/profile`, { headers })
      setCompany(data)
    } catch (e) {
      const msg = e?.response?.data?.error || e.message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onSave = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const base = await resolveApiBase()
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const form = new FormData()
      form.append('name', company.name)
      form.append('billing_email', company.billing_email)
      form.append('admin_contact_email', company.admin_contact_email)
      if (logoFile) form.append('logo', logoFile)
      await axios.put(`${base}/api/company/profile`, form, { headers })
      setSuccess('Company profile updated successfully')
      await fetchProfile()
    } catch (e) {
      setError(e?.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500 dark:text-slate-400">Loading...</div>
  if (error) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>

  return (
    <div className="space-y-8">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 mb-3">
              <span>Tenant</span>
              <span className="w-1 h-1 rounded-full bg-slate-400"></span>
              <span>Multi-Company</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Company Profile</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-300">Manage your company information and branding.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-xl overflow-hidden">
              {previewLogo ? (
                <img src={previewLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 dark:text-slate-300 text-2xl font-bold">
                  {company.name?.[0]?.toUpperCase() || 'T'}
                </div>
              )}
            </div>
            <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${company.subscription_plan === 'pro' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300'}`}>
              {company.subscription_plan === 'pro' ? 'Pro' : 'Free'}
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm rounded-lg">{success}</div>
      )}

      {/* Company Information */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
              <input className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={company.name} onChange={e=>setCompany(prev=>({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Company Logo</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Logo Preview */}
                <div className="w-24 h-24 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg overflow-hidden shrink-0">
                  {previewLogo ? (
                    <img src={previewLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 dark:text-slate-300 text-2xl font-bold">
                      {company.name?.[0]?.toUpperCase() || 'T'}
                    </div>
                  )}
                </div>
                {/* Upload Zone */}
                <div className="flex-1 w-full">
                  <label
                    className={`relative flex flex-col items-center justify-center w-full min-h-[100px] rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                    onDragEnter={e => { e.preventDefault(); setDragActive(true) }}
                    onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                    onDragLeave={e => { e.preventDefault(); setDragActive(false) }}
                    onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) setLogoFile(e.dataTransfer.files[0]) }}
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={e => setLogoFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col items-center gap-2 py-4 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Click to upload</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400"> or drag and drop</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">PNG, JPG or WEBP — up to 2MB</p>
                      {logoFile && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {logoFile.name}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Billing Information */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Billing Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Billing Email</label>
              <input disabled className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed" value={company.billing_email} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subscription Plan</label>
              <input disabled className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={company.subscription_plan} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Credit Balance</label>
              <input disabled className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={company.credit_balance} />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Contact */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Admin Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Admin Email</label>
            <input disabled className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed" value={company.admin_contact_email} />
          </div>
        </div>
      </div>

      <div className="flex justify-end sticky bottom-0 bg-gradient-to-t from-white/70 dark:from-slate-900/70 to-transparent py-4">
        <button disabled={saving} onClick={onSave} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/30 transition-all">{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  )
}
