import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../ThemeContext.jsx'

export function PublicShell({ children, title, subtitle }) {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <span className="text-sm">TT</span>
            </div>
            <span className="text-lg">TimeTracker</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <TopLink to="/support" active={pathname === '/support'}>Support</TopLink>
            <TopLink to="/contact" active={pathname === '/contact'}>Contact</TopLink>
            <TopLink to="/privacy" active={pathname === '/privacy'}>Privacy</TopLink>
            <TopLink to="/terms" active={pathname === '/terms'}>Terms</TopLink>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900">
              Log in
            </Link>
            <Link to="/signup" className="hidden sm:inline-flex px-3 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
              Get started
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 dark:border-slate-800 dark:hover:bg-slate-900 dark:text-slate-200"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
            {subtitle && <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-3xl">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <div className="text-sm text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} TimeTracker. All rights reserved.</div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/support" className="hover:underline">Support</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function TopLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={
        'px-3 py-2 rounded-xl text-sm font-semibold transition-colors ' +
        (active
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900')
      }
    >
      {children}
    </Link>
  )
}

