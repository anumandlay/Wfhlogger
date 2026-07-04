import React, { useEffect, useState } from 'react'
import { resolveApiBase } from '../api.js'

export default function Downloads() {
  const [apiBase, setApiBase] = useState('http://localhost:4000')

  useEffect(() => {
    resolveApiBase().then(setApiBase)
  }, [])

  const downloadUrl = `${apiBase}/downloads/TimeTrackerSetup.exe`
  const os = (typeof navigator !== 'undefined' ? (navigator.userAgent || '').toLowerCase() : '')
  const isWindows = os.includes('windows')

  return (
    <div className="max-w-2xl mx-auto space-y-10 py-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Desktop Client</h1>
        <p className="text-slate-500 dark:text-slate-400">Download the Time Tracker app for Windows.</p>
      </div>

      {/* Download Card */}
      <div className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-8 text-center ${isWindows ? 'border-blue-200 dark:border-blue-800' : 'border-slate-200 dark:border-slate-700'}`}>
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Windows 10 / 11 — 64-bit
          </div>

          <a
            href={downloadUrl}
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download TimeTrackerSetup.exe
          </a>

          <p className="text-xs text-slate-400 dark:text-slate-500">Version 1.0.0 • {isWindows ? 'Click to download' : 'Compatible with Windows 10/11'}</p>
        </div>
      </div>

      {/* How to Install */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-bold">1</span>
          How to Install
        </h2>
        <ol className="space-y-5">
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Download &amp; Install</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Click the download button above, then double-click the downloaded file to install.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Launch &amp; Sign In</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Open the app, enter your workspace URL and sign in with your credentials.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">3</span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Start Tracking</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">You're all set! The app will track your work time and take periodic screenshots.</p>
            </div>
          </li>
        </ol>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/50 p-6">
        <div className="flex gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-semibold">SmartScreen Warning?</p>
            <p>Windows may show a SmartScreen notice when you run the installer for the first time. Click <strong>"Run anyway"</strong> — it's safe.</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">© 2026 Time Tracker System</p>
    </div>
  )
}
