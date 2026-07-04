import React from 'react'

export function Tabs({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100/70 dark:bg-slate-800/70 p-1 border border-slate-200/60 dark:border-slate-700/60">
      {items.map((it) => {
        const active = value === it.value
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={
              "px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2 " +
              (active
                ? "bg-white text-slate-900 shadow-sm border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900/60")
            }
          >
            {it.icon}
            <span>{it.label}</span>
            {typeof it.count === 'number' && (
              <span
                className={
                  "ml-1 text-xs font-bold px-2 py-0.5 rounded-full border " +
                  (active
                    ? "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    : "bg-transparent border-slate-200/70 text-slate-500 dark:border-slate-700 dark:text-slate-400")
                }
              >
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

