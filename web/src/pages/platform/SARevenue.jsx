import React, { useMemo, useState, useEffect } from 'react'
import FinanceLineChart from '../../components/ui/FinanceLineChart.jsx'

export default function SARevenue() {
  const [data, setData] = useState({ total_revenue: 0, growth: { monthly_revenue: [] }, per_company: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('12m')
  const [countryData, setCountryData] = useState({ rows: [], totalRevenue: 0 })
  const [countryLoading, setCountryLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    import('../../api.js').then(({ resolveApiBase }) => resolveApiBase().then(base => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      fetch(`${base}/api/platform/metrics`, { headers })
        .then(r => {
          if (!r.ok) throw new Error('Failed to load financial data')
          return r.json()
        })
        .then(setData)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }))
  }, [])

  const loadCountryData = async (from, to) => {
    setCountryLoading(true)
    try {
      const { resolveApiBase } = await import('../../api.js')
      const base = await resolveApiBase()
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const r = await fetch(`${base}/api/platform/revenue-by-country?${params}`, { headers })
      if (!r.ok) throw new Error('Failed to load')
      const json = await r.json()
      setCountryData(json)
    } catch (e) {
      console.error('Country revenue error:', e)
    } finally {
      setCountryLoading(false)
    }
  }

  useEffect(() => {
    loadCountryData('', '')
  }, [])

  // Calculate some derived stats
  const monthlyRevenue = data.growth?.monthly_revenue || []
  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthRev = monthlyRevenue.find(m => m.month === currentMonth)?.revenue || 0
  const totalCredits = data.per_company?.reduce((acc, c) => acc + (c.credits || 0), 0) || 0

  const series = useMemo(() => {
    const sorted = [...monthlyRevenue].sort((a, b) => (a.month > b.month ? 1 : -1))
    if (range === '6m') return sorted.slice(-6)
    if (range === '12m') return sorted.slice(-12)
    return sorted
  }, [monthlyRevenue, range])

  const mom = useMemo(() => {
    const s = series
    if (s.length < 2) return { pct: null, prev: 0, cur: s[0]?.revenue || 0 }
    const cur = Number(s[s.length - 1]?.revenue) || 0
    const prev = Number(s[s.length - 2]?.revenue) || 0
    if (prev <= 0) return { pct: null, prev, cur }
    return { pct: ((cur - prev) / prev) * 100, prev, cur }
  }, [series])

  const rangeLabel = range === '6m' ? 'Last 6 months' : range === '12m' ? 'Last 12 months' : 'All time'

  if (loading) return <div className="p-8 text-center text-slate-500">Loading financials...</div>

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Revenue & Finance</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Platform financial health and credit usage</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/50">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                ${Number(data.total_revenue).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">This Month</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                ${Number(thisMonthRev).toLocaleString()}
              </div>
              {mom.pct != null && (
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold">
                  <span className={`px-2 py-1 rounded-lg border ${mom.pct >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/40'}`}>
                    {mom.pct >= 0 ? '+' : ''}{mom.pct.toFixed(1)}%
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">MoM</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Outstanding Credits</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalCredits.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue growth</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{rangeLabel} • Hover for details</div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            <button type="button" onClick={() => setRange('6m')} className={`px-3 py-1.5 text-sm font-bold rounded-lg ${range === '6m' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>6M</button>
            <button type="button" onClick={() => setRange('12m')} className={`px-3 py-1.5 text-sm font-bold rounded-lg ${range === '12m' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>12M</button>
            <button type="button" onClick={() => setRange('all')} className={`px-3 py-1.5 text-sm font-bold rounded-lg ${range === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>All</button>
          </div>
        </div>
        {series.length ? (
          <FinanceLineChart
            title="Revenue"
            subtitle="Multi-tenant platform revenue trend"
            series={series}
          />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-10 border border-slate-200 dark:border-slate-700 shadow-sm text-center text-slate-500">
            No revenue data available
          </div>
        )}
      </div>

      {/* Recent Transactions / Top Performers */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Top Revenue Sources</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 text-left font-medium">Company</th>
                <th className="py-2 text-right font-medium">Credits Held</th>
                <th className="py-2 text-right font-medium">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {[...(data.per_company || [])]
                .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                .slice(0, 5)
                .map(c => (
                  <tr key={c.company_id}>
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-300">{c.credits}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white">
                      ${Number(c.revenue || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              {data.per_company?.length === 0 && (
                <tr>
                  <td colSpan="3" className="py-4 text-center text-slate-500">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country-wise Revenue */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Revenue by Country</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Filter by date range to see revenue per country</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <button onClick={() => loadCountryData(fromDate, toDate)} disabled={countryLoading}
              className="mt-5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-70 inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {countryLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 text-left font-medium">Country</th>
                <th className="py-2 text-right font-medium">Companies</th>
                <th className="py-2 text-right font-medium">Transactions</th>
                <th className="py-2 text-right font-medium">Revenue</th>
                <th className="py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {countryData.rows?.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">No revenue data for the selected period</td>
                </tr>
              ) : (
                countryData.rows?.map((r, i) => (
                  <tr key={r.country} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">{i + 1}</span>
                      {r.country}
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-300">{r.companies}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-300">{r.transactions}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white">${Number(r.revenue).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {countryData.totalRevenue > 0 ? ((r.revenue / countryData.totalRevenue) * 100).toFixed(1) : 0}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {countryData.totalRevenue > 0 && (
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td className="py-3 font-bold text-slate-900 dark:text-white">Total</td>
                  <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{countryData.rows?.reduce((s, r) => s + r.companies, 0)}</td>
                  <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{countryData.rows?.reduce((s, r) => s + r.transactions, 0)}</td>
                  <td className="py-3 text-right font-bold text-slate-900 dark:text-white">${Number(countryData.totalRevenue).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-slate-900 dark:text-white">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
