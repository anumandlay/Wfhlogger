import React, { useEffect, useMemo, useRef, useState } from 'react'

const pad2 = (n) => String(n).padStart(2, '0')
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const parseYmd = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const da = Number(m[3])
  const dt = new Date(y, mo, da)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== da) return null
  return dt
}

export default function DatePicker({ value, onChange, placeholder = 'Select date' }) {
  const selectedDate = useMemo(() => parseYmd(value), [value])
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const [align, setAlign] = useState('left')
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  useEffect(() => {
    if (!open) return
    if (!selectedDate) return
    setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [open, selectedDate])

  useEffect(() => {
    if (!open) return
    const el = buttonRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const estimatedWidth = 18 * 16
      const padding = 16
      const shouldRight = rect.left + estimatedWidth > window.innerWidth - padding
      setAlign(shouldRight ? 'right' : 'left')
    }
    const onOutside = (e) => {
      const root = rootRef.current
      if (!root) return
      if (root.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const monthLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
    return fmt.format(viewMonth)
  }, [viewMonth])

  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
    const startOffset = first.getDay()
    const weeks = []
    let week = []

    for (let i = 0; i < startOffset; i++) week.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null)
      weeks.push(week)
    }
    return weeks
  }, [viewMonth])

  const isSameDay = (a, b) => {
    if (!a || !b) return false
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        ref={buttonRef}
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className={selectedDate ? 'text-sm font-semibold' : 'text-sm text-slate-400'}>
            {selectedDate ? toYmd(selectedDate) : placeholder}
          </div>
          <div className="text-slate-400 text-xs font-bold">▾</div>
        </div>
      </button>

      {open && (
        <div
          className={[
            'absolute top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 p-3',
            align === 'right' ? 'right-0' : 'left-0'
          ].join(' ')}
        >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                ‹
              </button>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{monthLabel}</div>
              <button
                type="button"
                onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                ›
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center py-1">{d}</div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {grid.flat().map((d, idx) => {
                const selected = isSameDay(d, selectedDate)
                const today = isSameDay(d, new Date())
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!d}
                    onClick={() => {
                      if (!d) return
                      onChange?.(toYmd(d))
                      setOpen(false)
                    }}
                    className={[
                      'h-8 rounded-lg text-sm font-semibold transition-colors',
                      d ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : 'opacity-0 cursor-default',
                      selected ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-slate-900 dark:text-slate-100',
                      !selected && today ? 'border border-blue-200 dark:border-blue-900/50' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {d ? d.getDate() : ''}
                  </button>
                )
              })}
            </div>

          <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { onChange?.(''); setOpen(false) }}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Clear
              </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                onChange?.(toYmd(t))
                setOpen(false)
              }}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Today
            </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
        </div>
      )}
    </div>
  )
}
