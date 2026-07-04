import React from 'react'

export default function Pagination({ page, pageCount, total, pageSize = 10, onPageChange }) {
  const canPrev = page > 1
  const canNext = page < pageCount

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  if (pageCount <= 1 && total <= pageSize) return null

  const go = (p) => {
    const next = Math.min(Math.max(1, p), pageCount)
    onPageChange?.(next)
  }

  const pages = []
  const windowSize = 5
  const half = Math.floor(windowSize / 2)
  let startPage = Math.max(1, page - half)
  let endPage = Math.min(pageCount, startPage + windowSize - 1)
  startPage = Math.max(1, endPage - windowSize + 1)
  for (let p = startPage; p <= endPage; p++) pages.push(p)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{start}</span>–
        <span className="font-semibold text-slate-900 dark:text-slate-100">{end}</span> of{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={!canPrev}
          className={
            "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors " +
            (canPrev
              ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600")
          }
        >
          Prev
        </button>

        {startPage > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-white hover:bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          >
            1
          </button>
        )}
        {startPage > 2 && <span className="px-1 text-slate-500 dark:text-slate-500">…</span>}

        {pages.map((p) => {
          const active = p === page
          return (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              className={
                "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors " +
                (active
                  ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-100")
              }
            >
              {p}
            </button>
          )
        })}

        {endPage < pageCount - 1 && <span className="px-1 text-slate-500 dark:text-slate-500">…</span>}
        {endPage < pageCount && (
          <button
            type="button"
            onClick={() => go(pageCount)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-white hover:bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          >
            {pageCount}
          </button>
        )}

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={!canNext}
          className={
            "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors " +
            (canNext
              ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600")
          }
        >
          Next
        </button>
      </div>
    </div>
  )
}

