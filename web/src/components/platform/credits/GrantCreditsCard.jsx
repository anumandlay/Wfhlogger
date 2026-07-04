import React from 'react'
import { Building2, Wallet, PlusCircle, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react'

export function GrantCreditsCard({ selected, credits, onCreditsChange, reason, onReasonChange, submitting, creditValid, onOpenConfirm }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Selected company</div>
              <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
                {selected ? selected.name : 'None selected'}
              </div>
              {selected && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">ID: {selected.id} · Plan: {selected.plan}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Credits</div>
            <div className="mt-0.5 inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
              <Wallet className="w-5 h-5 text-slate-400" />
              {selected ? Number(selected.credits || 0).toLocaleString() : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="text-lg font-bold text-slate-900 dark:text-white">Grant free credits</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Creates a ledger entry and pushes an instant credit update to the company.</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Credits to grant">
              <input
                value={credits}
                onChange={(e) => onCreditsChange(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 50"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Positive whole number.</div>
            </Field>
            <Field label="Reason (optional)">
              <input
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Promo, goodwill, onboarding…"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Appears in the company ledger description.</div>
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {selected ? (
                creditValid ? (
                  <span className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ready to grant</span>
                ) : (
                  <span className="inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Enter a valid credit amount</span>
                )
              ) : (
                <span className="inline-flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Select a company to continue</span>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenConfirm}
              disabled={!selected || !creditValid || submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PlusCircle className="w-4 h-4" />
              {submitting ? 'Granting…' : 'Grant credits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

