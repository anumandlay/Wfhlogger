import React from 'react'
import { X } from 'lucide-react'

export function AuditDetailsDrawer({ open, onClose, log }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{log?.type || 'Audit Log'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{log?.ts_local || (log?.ts ? new Date(log.ts).toLocaleString() : '')}{log?.timezone ? ` • ${log.timezone}` : ''}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-[calc(100%-4rem)] overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6">
            <Section title="Company">
              <KV k="Name" v={log?.company?.name || '-'} />
              <KV k="Slug" v={log?.company?.slug || '-'} />
              <KV k="ID" v={log?.company?.id ?? log?.company_id ?? '-'} />
            </Section>

            <Section title="Actor">
              <KV k="Name" v={log?.actor?.name || '-'} />
              <KV k="Email" v={log?.actor?.email || '-'} />
              <KV k="Role" v={log?.actor?.role || '-'} />
              <KV k="ID" v={log?.actor?.id ?? log?.details?.actorId ?? '-'} />
            </Section>

            <Section title="Target Employee">
              <KV k="Name" v={log?.targetEmployee?.name || '-'} />
              <KV k="Email" v={log?.targetEmployee?.email || '-'} />
              <KV k="Manager" v={log?.targetEmployee?.managerId || '-'} />
            </Section>

            <Section title="Summary">
              <div className="text-sm text-slate-700 dark:text-slate-200">{log?.summary || '-'}</div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</div>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{k}</div>
      <div className="col-span-2 text-sm text-slate-800 dark:text-slate-200 break-words">{String(v)}</div>
    </div>
  )
}

