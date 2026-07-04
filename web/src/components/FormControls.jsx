import React, { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { COUNTRIES, getTimezones } from '../utils/geo.js'

export function TextField({ label, value, onChange, type = 'text', placeholder = '', required = false, autoComplete }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <input
        type={type}
        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
    </div>
  )
}

function useFilteredOptions(options, query) {
  return useMemo(() => {
    const q = String(query || '').toLowerCase()
    if (!q) return options
    return options.filter(o => String(o).toLowerCase().includes(q))
  }, [options, query])
}

export function SearchableSelect({ label, value, onChange, options, placeholder = 'Search...', required = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const panelRef = useRef(null)
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: 0 })
  const filtered = useFilteredOptions(options, query)

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
    setPanelStyle({
      top: Math.round(rect.bottom + 8),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
    })
    const onRecalc = () => {
      const r = el.getBoundingClientRect()
      setPanelStyle({
        top: Math.round(r.bottom + 8),
        left: Math.round(r.left),
        width: Math.round(r.width),
      })
    }
    window.addEventListener('scroll', onRecalc, true)
    window.addEventListener('resize', onRecalc)
    return () => {
      window.removeEventListener('scroll', onRecalc, true)
      window.removeEventListener('resize', onRecalc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <button
        type="button"
        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-left focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {value || placeholder}
      </button>
      {required && !value && <input tabIndex={-1} className="sr-only" required />}
      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg text-slate-900 dark:text-slate-100"
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
        >
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              placeholder={placeholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((opt) => (
              <div
                key={opt}
                className={`px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 ${opt === value ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                onClick={() => { onChange({ target: { value: opt } }); setOpen(false); }}
              >
                {opt}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No results</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function CountrySelect({ label = 'Country', value, onChange, required = false }) {
  return <SearchableSelect label={label} value={value} onChange={onChange} options={COUNTRIES} required={required} />
}

export function TimezoneSelect({ label = 'Timezone', value, onChange, required = false }) {
  const zones = useMemo(() => getTimezones(), [])
  return <SearchableSelect label={label} value={value} onChange={onChange} options={zones} required={required} />
}

export function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="date"
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
