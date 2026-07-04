import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { useCredits } from '../CreditsContext.jsx'
import { resolveApiBase } from '../api.js'
import axios from 'axios'

// Icons
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Live: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Reports: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Requests: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  TimeTracking: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Setup: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Admin: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Billing: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  Downloads: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Sun: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Moon: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  Companies: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Revenue: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

export default function Sidebar({ isOpen, setIsOpen }) {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { credits } = useCredits()
  
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const base = await resolveApiBase()
        const { data } = await axios.get(`${base}/api/requests/pending-count`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!cancelled) setPendingCount(data.count || 0)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])
  
  const role = useMemo(() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return ''
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      const raw = payload?.role || ''
      return (raw === 'super_admin' && payload?.company_id != null) ? 'company_admin' : raw
    } catch {
      return ''
    }
  }, [])

  const user = useMemo(() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return { name: '', email: '' }
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      const rawRole = payload?.role || ''
      const name = payload?.full_name || payload?.name || (rawRole === 'super_admin' ? 'Super Admin' : 'User')
      return { name, email: payload?.email || '' }
    } catch {
      return { name: '', email: '' }
    }
  }, [])

  const NavItem = ({ to, icon: Icon, label, badge }) => {
    const isActive = pathname === to
    return (
      <Link
        to={to}
        onClick={() => setIsOpen && setIsOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive 
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <div className="relative">
          {Icon ? <Icon /> : <Icons.Dashboard />}
          {badge > 0 && (
            <span className="absolute -top-2 -right-2.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
              {badge > 5 ? '5+' : badge}
            </span>
          )}
        </div>
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-xl lg:shadow-none
        transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700">
            <BrandHeader />
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto scroll-smooth py-6 px-4 space-y-1">
            {role === 'super_admin' ? (
              <>
                <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Platform
                </div>
                <NavItem to="/platform" icon={Icons.Dashboard} label="Overview" />
                <NavItem to="/platform/companies" icon={Icons.Companies} label="Companies" />
                <NavItem to="/platform/credits" icon={Icons.Revenue} label="Free Credits" />
                <NavItem to="/platform/revenue" icon={Icons.Revenue} label="Revenue & Finance" />
              </>
            ) : (
              <>
                <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Overview
                </div>
                <NavItem to="/dashboard" icon={Icons.Dashboard} label="Dashboard" />
                <NavItem to="/live" icon={Icons.Live} label="Live View" />
              </>
            )}
            
            {role !== 'super_admin' && (
              <>
                <div className="px-3 mb-2 mt-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Management
                </div>
                {role === 'employee' && <NavItem to="/report" icon={Icons.Reports} label="Reports" />}
                <NavItem to="/time-tracking" icon={Icons.TimeTracking} label="Time Tracking" />
                <NavItem to="/activity" icon={Icons.Activity} label="Activity Logs" />
                <NavItem to="/requests" icon={Icons.Requests} label="Requests" badge={pendingCount} />
              </>
            )}
            
            {role !== 'super_admin' && (
              <>
                <div className="px-3 mb-2 mt-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  System
                </div>
                <NavItem to="/setup" icon={Icons.Setup} label={role === 'company_admin' ? 'Company' : 'Organization'} />
                {role === 'company_admin' && (
                  <NavItem to="/company" icon={Icons.Admin} label="Company Profile" />
                )}
                {role === 'company_admin' && (
                  <NavItem to="/billing" icon={Icons.Billing} label="Billing" />
                )}
                {role === 'company_admin' && (
                  <NavItem to="/admin" icon={Icons.Admin} label="Administration" />
                )}
                {role === 'company_admin' && (
                  <NavItem to="/audit-logs" icon={Icons.Admin} label="Audit Logs" />
                )}
                <NavItem to="/downloads" icon={Icons.Downloads} label="Downloads" />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
            <div className="px-3 py-2 mb-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
            </div>

            {(role === 'company_admin' || role === 'manager') && (
              <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Credits</div>
                <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{Number(credits || 0).toLocaleString()}</div>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('token')
                window.location.href = '/login'
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            >
              <Icons.Logout />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function BrandHeader(){
  const [brand, setBrand] = React.useState({ name: 'TimeTracker', logo_url: '' })
  React.useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      import('../api.js').then(({ resolveApiBase }) => resolveApiBase().then(base => {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
        fetch(`${base}/api/company/brand`, { headers }).then(r=>r.json()).then(d=>{
          if (d?.name) setBrand({ name: d.name, logo_url: d.logo_url || '' })
        }).catch(()=>{})
      }))
    } catch {}
  }, [])
  return (
    <div className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white tracking-tight">
      {brand.logo_url ? (
        <img src={brand.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
      ) : (
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
      <span>{brand.name}</span>
    </div>
  )
}
