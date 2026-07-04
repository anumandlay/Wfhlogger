import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export function Notice({ type, message }) {
  const styles = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200'
    : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200'
  const Icon = type === 'success' ? CheckCircle2 : AlertTriangle

  return (
    <div className={`rounded-xl border p-3 text-sm inline-flex items-start gap-2 ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5" />
      <div>{message}</div>
    </div>
  )
}

