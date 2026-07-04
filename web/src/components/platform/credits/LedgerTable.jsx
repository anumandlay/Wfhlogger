import React from 'react'
import Pagination from '../../ui/Pagination.jsx'
import { usePagination } from '../../../hooks/usePagination.js'

export function LedgerTable({ selectedCompanyId, loading, history, onRefresh }) {
  const historyPg = usePagination(history, 10, [selectedCompanyId, history?.length || 0])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">Company ledger</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Recent credit/debit activity for the selected company.</div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!selectedCompanyId || loading}
          className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {!selectedCompanyId ? (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Select a company to view transaction history.</div>
      ) : loading ? (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading transactions…</div>
      ) : historyPg.total ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 text-left">Time</th>
                <th className="py-3 px-4 text-left">Type</th>
                <th className="py-3 px-4 text-right">Credits</th>
                <th className="py-3 px-4 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {historyPg.pageItems.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatTs(t.created_at)}</td>
                  <td className="py-3 px-4">
                    <span className={
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ' +
                      (t.type === 'debit'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')
                    }>
                      {t.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">{Number(t.credits || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{t.description || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-5">
            <Pagination
              page={historyPg.page}
              pageCount={historyPg.pageCount}
              total={historyPg.total}
              pageSize={historyPg.pageSize}
              onPageChange={historyPg.setPage}
            />
          </div>
        </div>
      ) : (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No transactions found.</div>
      )}
    </div>
  )
}

function formatTs(ts) {
  try {
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return String(ts || '')
    return d.toLocaleString()
  } catch {
    return String(ts || '')
  }
}
