import React from 'react'
import { HardDrive } from 'lucide-react'

export function formatBytes(b) {
  const n = Number(b)
  if (!Number.isFinite(n) || n < 0) return '—'
  const gb = n / 1e9
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = n / 1e6
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`
}

export default function StorageQuotaBadge({ quota, size = 'sm' }) {
  if (!quota || !quota.connected) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 ${size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}>
        <HardDrive className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        Not connected
      </span>
    )
  }

  const limit = quota.limit_bytes != null ? Number(quota.limit_bytes) : null
  const remaining = quota.remaining_bytes != null ? Number(quota.remaining_bytes) : null
  const used = (limit != null && remaining != null) ? Math.max(0, limit - remaining) : null
  const pct = (limit != null && used != null && limit > 0) ? Math.min(100, Math.max(0, (used / limit) * 100)) : null

  // S3 doesn't have a fixed quota limit, so use used_bytes / total_files as a rough indicator
  const usedBytes = quota.used_bytes != null ? Number(quota.used_bytes) : null
  const displayPct = usedBytes != null ? Math.min(100, Math.max(0, (usedBytes / (50 * 1e9)) * 100)) : pct
  const isWarning = displayPct != null && displayPct > 70
  const barColor = isWarning ? 'bg-red-500' : 'bg-emerald-500'
  const textColor = isWarning ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'
  const borderColor = isWarning ? 'border-red-200 dark:border-red-800' : 'border-emerald-200 dark:border-emerald-800'
  const bgColor = isWarning ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'
  const dotColor = isWarning ? 'bg-red-500' : 'bg-emerald-500'

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg border ${borderColor} ${bgColor} px-2 py-1 text-[10px] font-medium ${textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {usedBytes != null ? `${formatBytes(usedBytes)}` : '—'}
      </span>
    )
  }

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold flex items-center gap-1.5 ${textColor}`}>
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          Storage
        </span>
        <span className={`text-xs font-bold ${textColor}`}>
          {usedBytes != null ? `${formatBytes(usedBytes)}` : 'Unknown'}
        </span>
      </div>
      {displayPct != null && (
        <div className="h-2 w-full rounded-full bg-white/60 dark:bg-slate-700/60 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${displayPct}%` }}
          />
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        {usedBytes != null ? `${formatBytes(usedBytes)} used` : '—'}
        {quota.total_files != null ? ` · ${quota.total_files} file(s)` : ''}
      </div>
    </div>
  )
}
