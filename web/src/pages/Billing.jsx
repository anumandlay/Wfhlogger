import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from '../api.js'
import AddCreditsModal from '../components/AddCreditsModal'
import { useCredits } from '../CreditsContext.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import { usePagination } from '../hooks/usePagination.js'

export default function Billing() {
  const { refreshCredits, credits, creditsError } = useCredits()
  const [tab, setTab] = useState('transactions')
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [apiBase, setApiBase] = useState('')
  const [amount, setAmount] = useState(25)
  const [resolving, setResolving] = useState(false)
  const [resolveMsg, setResolveMsg] = useState('')
  const presets = [10, 25, 50, 100, 250]

  const displayCredits = Math.max(Number(credits || 0), Number(balance || 0))

  const historyPg = usePagination(history, 10, [tab, history.length])
  const invoicesPg = usePagination(invoices, 10, [tab, invoices.length])

  useEffect(() => {
    let cancelled = false
    resolveApiBase().then(async base => {
      if (cancelled) return
      setApiBase(base)
      await fetchData(base)
      try {
        const params = new URLSearchParams(window.location.search)
        if (params.get('status') === 'success') {
          setConfirming(true)
          await confirmAndRefresh(base, params.get('session_id'))
          setConfirming(false)
        }
      } catch {
        setConfirming(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const fetchData = async (base) => {
    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const summary = await axios.get(`${base}/api/billing/summary`, { headers })
      const nextBalance = Number(summary?.data?.balance)
      if (!Number.isFinite(nextBalance)) throw new Error('Invalid billing summary (balance)')
      if (!Array.isArray(summary?.data?.history)) throw new Error('Invalid billing summary (history)')
      setBalance(nextBalance)
      setHistory(summary.data.history)

      const inv = await axios.get(`${base}/api/billing/invoices`, { headers })
      if (!Array.isArray(inv?.data?.invoices)) throw new Error('Invalid invoices response')
      setInvoices(inv.data.invoices)
      try { await refreshCredits() } catch {}
    } catch (e) {
      setError('Failed to load billing info')
    } finally {
      setLoading(false)
    }
  }

  const confirmAndRefresh = async (base, sessionId) => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
    try {
      // Skip confirm-session if session_id is literal template (Stripe didn't replace it)
      if (sessionId && !sessionId.includes('{CHECKOUT_SESSION_ID}')) {
        await axios.post(`${base}/api/billing/stripe/confirm-session`, { session_id: sessionId }, { headers })
      }
    } catch (e) {
      console.warn('[billing] confirm-session failed, falling back to poll:', e?.response?.data || e?.message)
    }
    // Poll balance until credits update (catches webhook-delayed or already-applied)
    const lastKnown = Number(credits ?? balance ?? 0)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const { data } = await axios.get(`${base}/api/billing/balance?t=${Date.now()}`, { headers: { ...headers, 'Cache-Control': 'no-cache' } })
      const cur = Number(data?.credits)
      if (!Number.isFinite(cur)) continue
      if (cur > lastKnown) {
        setBalance(cur)
        await fetchData(base)
        await refreshCredits()
        return
      }
    }
  }

  const handleAddCredits = async (amount) => {
    setProcessing(true)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const return_path = (() => {
        try { return window.location.pathname || '/billing' } catch { return '/billing' }
      })()

      const { data } = await axios.post(`${apiBase}/api/billing/stripe/checkout-session`, { amount_usd: amount, return_path }, { headers })
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL')
      }
    } catch (e) {
      setError('Failed to initiate secure checkout')
      setProcessing(false)
    }
  }

  const handleResolvePending = async () => {
    setResolving(true)
    setResolveMsg('')
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const { data } = await axios.post(`${apiBase}/api/billing/stripe/resolve-pending`, {}, { headers })
      setResolveMsg(data?.message || 'No pending credits found')
      if (data?.resolved > 0) {
        setBalance(data?.balance ?? balance)
        await fetchData(apiBase)
        await refreshCredits()
      }
    } catch (e) {
      setResolveMsg('Failed to check for pending credits')
    } finally {
      setResolving(false)
    }
  }

  if (loading && balance === undefined) return <div className="p-8 text-slate-500 dark:text-slate-400">Loading...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white mb-6 sm:mb-8">Billing & Payments</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="w-full sm:w-auto">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Available Credits</h2>
              <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">{displayCredits}</div>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">$1.00 / active employee / month</p>
              {resolveMsg && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{resolveMsg}</p>}
            </div>
            <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-wrap w-full sm:w-auto">
              <div className="text-xs text-slate-500 dark:text-slate-400">Secured by</div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Stripe</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 7a5 5 0 015-5h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7z"/></svg>
              </div>
              <button
                onClick={handleResolvePending}
                disabled={resolving}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  resolving
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                }`}
              >
                {resolving ? 'Checking...' : 'Resolve Pending Credits'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add Credits</h2>
            {error && <div className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {!error && creditsError && <div className="mb-4 text-red-600 dark:text-red-400 text-sm">{creditsError}</div>}
            {!error && confirming && <div className="mb-4 text-slate-600 dark:text-slate-300 text-sm">Payment confirmed! Applying credits...</div>}
            <div className="flex flex-wrap gap-3 mb-4">
              {presets.map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    amount === v
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  disabled={processing}
                >
                  ${v}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={e => setAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full sm:w-40 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                onClick={() => handleAddCredits(amount)}
                disabled={processing}
                className={`px-5 py-2 rounded-lg font-semibold transition text-center ${processing ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'}`}
              >
                {processing ? 'Redirecting…' : 'Secure Checkout'}
              </button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Your payment is processed on Stripe’s PCI‑compliant checkout. We never see or store your card details.
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Security</h3>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>Hosted Stripe Checkout</li>
              <li>No card data stored on our servers</li>
              <li>TLS encryption end‑to‑end</li>
              <li>Role‑scoped multi‑tenant access</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4 sm:gap-6">
          <button className={`text-sm font-semibold ${tab==='transactions' ? 'text-blue-600' : 'text-slate-600 dark:text-slate-300'}`} onClick={()=>setTab('transactions')}>Transactions</button>
          <button className={`text-sm font-semibold ${tab==='invoices' ? 'text-blue-600' : 'text-slate-600 dark:text-slate-300'}`} onClick={()=>setTab('invoices')}>Invoices</button>
        </div>
        {tab === 'transactions' ? (
          <div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-3 sm:px-6 py-3">Date</th>
                    <th className="px-3 sm:px-6 py-3">Description</th>
                    <th className="px-3 sm:px-6 py-3">Type</th>
                    <th className="px-3 sm:px-6 py-3">Amount</th>
                    <th className="px-3 sm:px-6 py-3">Credits</th>
                    <th className="px-3 sm:px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {historyPg.total === 0 ? (
                    <tr><td colSpan="6" className="px-3 sm:px-6 py-8 text-center text-slate-400 dark:text-slate-500">No transactions yet</td></tr>
                  ) : (
                    historyPg.pageItems.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="px-3 sm:px-6 py-3 min-w-[120px]">{t.description}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${t.type === 'credit' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">${Number(t.amount).toFixed(2)}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">{t.credits > 0 ? `+${t.credits}` : t.credits}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap capitalize">{t.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3 p-3">
              {historyPg.total === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No transactions yet</div>
              ) : (
                historyPg.pageItems.map(t => (
                  <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${t.type === 'credit' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {t.type}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{t.description}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Amount: <strong className="text-slate-900 dark:text-white">${Number(t.amount).toFixed(2)}</strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Credits: <strong className="text-slate-900 dark:text-white">{t.credits > 0 ? `+${t.credits}` : t.credits}</strong>
                      </span>
                      <span className={`capitalize font-semibold ${t.status === 'completed' || t.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{t.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-3 sm:px-6 pb-5">
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
          <div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-3 sm:px-6 py-3">Invoice ID</th>
                    <th className="px-3 sm:px-6 py-3">Date</th>
                    <th className="px-3 sm:px-6 py-3">Amount</th>
                    <th className="px-3 sm:px-6 py-3">Status</th>
                    <th className="px-3 sm:px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {invoicesPg.total === 0 ? (
                    <tr><td colSpan="5" className="px-3 sm:px-6 py-8 text-center text-slate-400 dark:text-slate-500">No invoices yet</td></tr>
                  ) : (
                    invoicesPg.pageItems.map(inv => (
                      <tr key={inv.invoice_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap font-mono text-xs">{inv.invoice_id}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">${Number(inv.total_amount || 0).toFixed(2)}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap capitalize">{inv.payment_status || 'paid'}</td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                          <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={async ()=>{
                            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
                            const base = await resolveApiBase()
                            const res = await axios.get(`${base}/api/billing/invoices/${inv.invoice_id}/download`, { headers, responseType: 'blob' })
                            const url = URL.createObjectURL(res.data)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${inv.invoice_id}.pdf`
                            document.body.appendChild(a)
                            a.click()
                            a.remove()
                            URL.revokeObjectURL(url)
                          }}>Download</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3 p-3">
              {invoicesPg.total === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No invoices yet</div>
              ) : (
                invoicesPg.pageItems.map(inv => (
                  <div key={inv.invoice_id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-slate-900 dark:text-white truncate max-w-[60%]">{inv.invoice_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${(inv.payment_status || 'paid') === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {inv.payment_status || 'paid'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {new Date(inv.invoice_date).toLocaleDateString()}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">${Number(inv.total_amount || 0).toFixed(2)}</span>
                    </div>
                    <button className="w-full mt-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-semibold"
                      onClick={async ()=>{
                        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
                        const base = await resolveApiBase()
                        const res = await axios.get(`${base}/api/billing/invoices/${inv.invoice_id}/download`, { headers, responseType: 'blob' })
                        const url = URL.createObjectURL(res.data)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${inv.invoice_id}.pdf`
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                      }}>Download PDF</button>
                  </div>
                ))
              )}
            </div>
            <div className="px-3 sm:px-6 pb-5">
              <Pagination
                page={invoicesPg.page}
                pageCount={invoicesPg.pageCount}
                total={invoicesPg.total}
                pageSize={invoicesPg.pageSize}
                onPageChange={invoicesPg.setPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
