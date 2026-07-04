import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../ThemeContext'

// Icons
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Reports: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Profile: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Downloads: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Sun: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Moon: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
}

export default function EmployeeSidebar({ isOpen, setIsOpen }) {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  
  const user = useMemo(() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return { name: '', email: '' }
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      return { name: payload?.full_name || payload?.name || 'User', email: payload?.email || '' }
    } catch {
      return { name: '', email: '' }
    }
  }, [])

  const NavItem = ({ to, icon: Icon, label }) => {
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
        <Icon />
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
            <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Personal
            </div>
            <NavItem to="/dashboard" icon={Icons.Dashboard} label="My Dashboard" />
            <NavItem to="/activity" icon={Icons.Activity} label="My Activity" />
            <NavItem to="/report" icon={Icons.Reports} label="My Reports" />
            
            <div className="px-3 mb-2 mt-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Account
            </div>
            <NavItem to="/downloads" icon={Icons.Downloads} label="Downloads" />
            <NavItem to="/profile" icon={Icons.Profile} label="Profile Settings" />
          </div>

          {/* User Info */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <div className="px-3 py-2 mb-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
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
