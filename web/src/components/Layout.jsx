import React, { useState } from 'react'
import Sidebar from './Sidebar'
import { useCredits } from '../CreditsContext.jsx'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { credits } = useCredits()

  const role = React.useMemo(() => {
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

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm z-30 transition-colors duration-200">
          <div className="font-bold text-lg text-slate-900 dark:text-white">TimeTracker</div>
          <div className="flex items-center gap-2">
            {(role === 'company_admin' || role === 'manager') && (
              <div className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700">
                Credits: {Number(credits || 0).toLocaleString()}
              </div>
            )}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -mr-2 rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
