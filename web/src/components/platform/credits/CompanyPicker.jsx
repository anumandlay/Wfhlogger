import React from 'react'
import { Search } from 'lucide-react'
import Pagination from '../../ui/Pagination.jsx'
import { usePagination } from '../../../hooks/usePagination.js'

export function CompanyPicker({ query, onQueryChange, onRefresh, companies, loading, selectedId, onSelect }) {
  const companiesPg = usePagination(companies, 10, [query, companies?.length || 0])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search company name or ID"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/40 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading companies…</div>
        ) : companiesPg.total ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {companiesPg.pageItems.map((c) => (
              <CompanyRow
                key={c.id}
                company={c}
                active={selectedId === c.id}
                onSelect={() => onSelect(c)}
              />
            ))}
          </ul>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No companies found.</div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <Pagination
          page={companiesPg.page}
          pageCount={companiesPg.pageCount}
          total={companiesPg.total}
          pageSize={companiesPg.pageSize}
          onPageChange={companiesPg.setPage}
        />
      </div>
    </div>
  )
}

function CompanyRow({ company, active, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={
          'w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ' +
          (active
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'hover:bg-slate-50 dark:hover:bg-slate-700/30')
        }
      >
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 dark:text-white truncate">{company.name}</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">ID: {company.id} · {company.plan}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400">Credits</div>
          <div className="font-bold text-slate-900 dark:text-white">{Number(company.credits || 0).toLocaleString()}</div>
        </div>
      </button>
    </li>
  )
}
