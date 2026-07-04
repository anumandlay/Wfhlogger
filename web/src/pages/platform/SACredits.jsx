import React from 'react'
import { CompanyPicker } from '../../components/platform/credits/CompanyPicker.jsx'
import { GrantCreditsCard } from '../../components/platform/credits/GrantCreditsCard.jsx'
import { LedgerTable } from '../../components/platform/credits/LedgerTable.jsx'
import { ConfirmGrantModal } from '../../components/platform/credits/ConfirmGrantModal.jsx'
import { Notice } from '../../components/platform/credits/Notice.jsx'

export default function SACredits() {
  const [query, setQuery] = React.useState('')
  const [companies, setCompanies] = React.useState([])
  const [loadingCompanies, setLoadingCompanies] = React.useState(true)
  const [selected, setSelected] = React.useState(null)
  const [history, setHistory] = React.useState([])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [credits, setCredits] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [notice, setNotice] = React.useState(null)

  const loadCompanies = React.useCallback(async (q) => {
    setLoadingCompanies(true)
    setNotice(null)
    try {
      const { resolveApiBase } = await import('../../api.js')
      const base = await resolveApiBase()
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const url = new URL(`${base}/api/platform/companies`)
      if (q) url.searchParams.set('q', q)
      const r = await fetch(url.toString(), { headers })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to load companies')
      setCompanies(Array.isArray(d?.companies) ? d.companies : [])
    } catch (e) {
      setNotice({ type: 'error', message: e.message || 'Failed to load companies' })
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  const loadCompanyHistory = React.useCallback(async (companyId) => {
    setLoadingHistory(true)
    try {
      const { resolveApiBase } = await import('../../api.js')
      const base = await resolveApiBase()
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const r = await fetch(`${base}/api/platform/companies/${companyId}/transactions`, { headers })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to load transaction history')
      setHistory(Array.isArray(d?.history) ? d.history : [])
    } catch (e) {
      setHistory([])
      setNotice({ type: 'error', message: e.message || 'Failed to load transaction history' })
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  React.useEffect(() => {
    loadCompanies('')
  }, [loadCompanies])

  React.useEffect(() => {
    const t = setTimeout(() => loadCompanies(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query, loadCompanies])

  const onSelect = (c) => {
    setSelected(c)
    setCredits('')
    setReason('')
    setShowConfirm(false)
    setNotice(null)
    loadCompanyHistory(c.id)
  }

  const creditNum = Math.floor(Number(credits))
  const creditValid = Number.isFinite(creditNum) && creditNum > 0
  const canSubmit = !!selected && creditValid && !submitting

  const submitGrant = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setNotice(null)
    try {
      const { resolveApiBase } = await import('../../api.js')
      const base = await resolveApiBase()
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      }
      const r = await fetch(`${base}/api/platform/companies/${selected.id}/grant-credits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ credits: creditNum, reason }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to grant credits')

      const nextSelected = { ...selected, credits: d.balance }
      setSelected(nextSelected)
      setCompanies((prev) => prev.map(x => (x.id === nextSelected.id ? nextSelected : x)))
      setNotice({ type: 'success', message: `Granted ${creditNum} credits to ${selected.name}.` })
      setCredits('')
      setReason('')
      setShowConfirm(false)
      loadCompanyHistory(selected.id)
    } catch (e) {
      setNotice({ type: 'error', message: e.message || 'Failed to grant credits' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Free Credits</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Select a company and grant free credits. Updates reflect immediately across the tenant.</p>
        </div>
      </div>

      {notice && (
        <Notice type={notice.type} message={notice.message} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <CompanyPicker
            query={query}
            onQueryChange={setQuery}
            onRefresh={() => loadCompanies(query.trim())}
            companies={companies}
            loading={loadingCompanies}
            selectedId={selected?.id || null}
            onSelect={onSelect}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          <GrantCreditsCard
            selected={selected}
            credits={credits}
            onCreditsChange={setCredits}
            reason={reason}
            onReasonChange={setReason}
            submitting={submitting}
            creditValid={creditValid}
            onOpenConfirm={() => setShowConfirm(true)}
          />

          <LedgerTable
            selectedCompanyId={selected?.id || null}
            loading={loadingHistory}
            history={history}
            onRefresh={() => selected && loadCompanyHistory(selected.id)}
          />
        </div>
      </div>

      {showConfirm && (
        <ConfirmGrantModal
          company={selected}
          credits={creditNum}
          reason={reason}
          canConfirm={canSubmit}
          onCancel={() => setShowConfirm(false)}
          onConfirm={submitGrant}
          submitting={submitting}
        />
      )}
    </div>
  )
}
