import React from 'react'

export function LegalPage({ updatedAt, toc, children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">On this page</div>
          <div className="mt-3 space-y-1">
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="block px-2 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t.label}
              </a>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">Last updated</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{updatedAt}</div>
          </div>
        </div>
      </aside>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="prose prose-slate max-w-none dark:prose-invert prose-p:leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

export function H2({ id, children }) {
  return (
    <h2 id={id} className="scroll-mt-24">
      {children}
    </h2>
  )
}

