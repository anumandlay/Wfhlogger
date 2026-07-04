import React, { useMemo, useRef, useState } from 'react'

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

function formatMoneyCompact(v) {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function formatMonthLabel(ym) {
  const [y, m] = String(ym || '').split('-').map(Number)
  if (!y || !m) return String(ym || '')
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString(undefined, { month: 'short' })
}

function buildSmoothPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  const d = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const tension = 0.22
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }
  return d.join(' ')
}

export default function FinanceLineChart({ title = 'Revenue Growth', subtitle = '', series = [] }) {
  const containerRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  const width = 860
  const height = 260
  const pad = { l: 44, r: 20, t: 16, b: 40 }

  const values = series.map(s => Number(s?.revenue) || 0)
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)

  const points = useMemo(() => {
    if (!series.length) return []
    const innerW = width - pad.l - pad.r
    const innerH = height - pad.t - pad.b
    const denom = max - min || 1
    return series.map((row, i) => {
      const x = pad.l + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
      const y = pad.t + (1 - ((Number(row?.revenue) || 0) - min) / denom) * innerH
      return { x, y, month: row?.month, revenue: Number(row?.revenue) || 0 }
    })
  }, [series, max, min])

  const path = useMemo(() => buildSmoothPath(points), [points])
  const area = useMemo(() => {
    if (!points.length) return ''
    const baseY = height - pad.b
    return `${path} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
  }, [path, points])

  const yTicks = useMemo(() => {
    const ticks = 4
    const out = []
    for (let i = 0; i <= ticks; i++) {
      const t = i / ticks
      const v = max - t * (max - min)
      const y = pad.t + t * (height - pad.t - pad.b)
      out.push({ y, v })
    }
    return out
  }, [max, min])

  const handleMove = (e) => {
    const el = containerRef.current
    if (!el || !points.length) return
    const rect = el.getBoundingClientRect()
    const x = clamp(e.clientX - rect.left, 0, rect.width)
    const y = clamp(e.clientY - rect.top, 0, rect.height)
    const innerX = (x / rect.width) * width
    const nearest = points.reduce((best, p, idx) => {
      const d = Math.abs(p.x - innerX)
      return d < best.d ? { d, idx } : best
    }, { d: Infinity, idx: 0 }).idx
    setHoverIndex(nearest)
    setCursor({ x, y })
  }

  const handleLeave = () => setHoverIndex(null)

  const active = hoverIndex != null ? points[hoverIndex] : (points.length ? points[points.length - 1] : null)
  const tooltip = useMemo(() => {
    if (!active) return null
    const label = active?.month
    const monthText = label ? new Date(`${label}-01T00:00:00`).toLocaleString(undefined, { month: 'short', year: 'numeric' }) : ''
    return { monthText, revenueText: formatMoneyCompact(active.revenue) }
  }, [active])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="px-6 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          {tooltip ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-slate-700 dark:bg-slate-900/40">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tooltip.monthText}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{tooltip.revenueText}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative px-2 pb-5"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[260px] select-none">
          <defs>
            <linearGradient id="rev_fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="rev_stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>

          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={width - pad.r} y1={t.y} y2={t.y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={pad.l - 10} y={t.y + 4} fontSize="11" textAnchor="end" fill="#64748B">
                {formatMoneyCompact(t.v).replace('$', '')}
              </text>
            </g>
          ))}

          {area ? <path d={area} fill="url(#rev_fill)" /> : null}
          {path ? <path d={path} fill="none" stroke="url(#rev_stroke)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}

          {points.map((p, i) => {
            const show = i === points.length - 1 || i === 0 || (points.length <= 8) || (points.length > 8 && i % Math.ceil(points.length / 6) === 0)
            if (!show) return null
            return (
              <text key={p.month || i} x={p.x} y={height - 16} fontSize="11" textAnchor="middle" fill="#64748B">
                {formatMonthLabel(p.month)}
              </text>
            )
          })}

          {active ? (
            <g>
              <line x1={active.x} x2={active.x} y1={pad.t} y2={height - pad.b} stroke="#94A3B8" strokeDasharray="4 4" />
              <circle cx={active.x} cy={active.y} r="6" fill="#2563EB" opacity="0.2" />
              <circle cx={active.x} cy={active.y} r="3" fill="#2563EB" />
            </g>
          ) : null}
        </svg>

        {hoverIndex != null && tooltip ? (
          <div
            className="pointer-events-none absolute rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{ left: clamp(cursor.x + 12, 8, (containerRef.current?.clientWidth || 0) - 180), top: clamp(cursor.y - 56, 8, 190) }}
          >
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tooltip.monthText}</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{tooltip.revenueText}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

