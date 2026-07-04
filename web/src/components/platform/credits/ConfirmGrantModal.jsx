import React from 'react'

export function ConfirmGrantModal({ company, credits, reason, canConfirm, submitting, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="text-lg font-bold text-slate-900 dark:text-white">Confirm free credits grant</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">This action updates the company’s credit balance immediately.</div>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row k="Company" v={company ? `${company.name} (ID: ${company.id})` : '—'} />
          <Row k="Credits" v={Number(credits || 0).toLocaleString()} />
          <Row k="Reason" v={reason || '—'} />
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Granting…' : 'Confirm grant'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-slate-500 dark:text-slate-400">{k}</div>
      <div className="font-semibold text-slate-900 dark:text-white text-right">{v}</div>
    </div>
  )
}

