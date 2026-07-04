import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function EmployeeSelect({ label = 'Employee', employees, value, onChange, placeholder = 'Select employee' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const panelRef = useRef(null)
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 0 })

  const items = Array.isArray(employees) ? employees : []

  const selected = useMemo(() => {
    const v = String(value || '').toLowerCase()
    if (!v) return null
    return items.find(u => String(u?.email || '').toLowerCase() === v) || null
  }, [items, value])

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return items
    return items.filter(u => {
      const email = String(u?.email || '').toLowerCase()
      const name = String(u?.full_name || u?.name || '').toLowerCase()
      return email.includes(q) || name.includes(q)
    })
  }, [items, query])

  useEffect(() => {
    const handler = (e) => {
      const inTrigger = ref.current && ref.current.contains(e.target)
      const inPanel = panelRef.current && panelRef.current.contains(e.target)
      if (!inTrigger && !inPanel) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const top = Math.round(rect.bottom + 8)
    const left = Math.round(rect.left)
    const width = Math.round(rect.width)
    const maxHeight = Math.max(160, Math.min(420, window.innerHeight - top - 16))
    setPanelStyle({ top, left, width, maxHeight })

    const onRecalc = () => {
      const r = el.getBoundingClientRect()
      const t = Math.round(r.bottom + 8)
      const l = Math.round(r.left)
      const w = Math.round(r.width)
      const mh = Math.max(160, Math.min(420, window.innerHeight - t - 16))
      setPanelStyle({ top: t, left: l, width: w, maxHeight: mh })
    }
    window.addEventListener('scroll', onRecalc, true)
    window.addEventListener('resize', onRecalc)
    return () => {
      window.removeEventListener('scroll', onRecalc, true)
      window.removeEventListener('resize', onRecalc)
    }
  }, [open])

  const selectedLabel = selected
    ? `${String(selected?.full_name || selected?.name || '').trim() || 'Employee'} — ${String(selected?.email || '').trim()}`
    : ''

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</label>}
      <button
        type="button"
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        onClick={() => { setOpen(v => !v); if (!open) setQuery('') }}
        title={selectedLabel || ''}
      >
        <div className="flex items-center justify-between gap-3">
          <div className={selected ? 'text-sm font-semibold truncate' : 'text-sm text-slate-400 truncate'}>
            {selected ? selectedLabel : placeholder}
          </div>
          <div className="text-slate-400 text-xs font-bold">▾</div>
        </div>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-slate-900 dark:text-slate-100 overflow-hidden"
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
        >
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              placeholder="Search employee..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: panelStyle.maxHeight }}>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => { onChange?.(''); setOpen(false) }}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">All Employees</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Clear employee filter</div>
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            {filtered.map((u) => {
              const email = String(u?.email || '').trim()
              const name = String(u?.full_name || u?.name || '').trim()
              const isActive = String(value || '').toLowerCase() === email.toLowerCase()
              return (
                <button
                  key={email}
                  type="button"
                  className={[
                    'w-full text-left px-3 py-2 transition-colors',
                    isActive ? 'bg-slate-50 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  ].join(' ')}
                  onClick={() => { onChange?.(email); setOpen(false) }}
                  title={`${name || 'Employee'} — ${email}`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{name || 'Employee'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">No results</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

