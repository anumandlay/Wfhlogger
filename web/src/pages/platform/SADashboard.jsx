import React from 'react'
import { Link } from 'react-router-dom'

export default function SADashboard() {
  const [data, setData] = React.useState({ total_companies: 0, total_revenue: 0, per_company: [], country_distribution: {}, timezone_distribution: {}, growth: { monthly_revenue: [] } })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  
  React.useEffect(() => {
    import('../../api.js').then(({ resolveApiBase }) => resolveApiBase().then(base => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      fetch(`${base}/api/platform/metrics`, { headers })
        .then(r => {
          if (!r.ok) throw new Error('Failed to load metrics')
          return r.json()
        })
        .then(setData)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }))
  }, [])
  
  const distEntries = (obj) => Object.entries(obj).sort((a,b)=> b[1]-a[1])
  
  if (loading) return <div className="p-8 text-center text-slate-500">Loading overview...</div>

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back, Super Admin</p>
        </div>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Companies</div>
          <div className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{data.total_companies}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Revenue (USD)</div>
          <div className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">${Number(data.total_revenue || 0).toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-sm font-medium">System Credits Balance</div>
          <div className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">
            {data.per_company.reduce((s,c)=> s + (c.credits || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top Performing Companies</h2>
            <Link to="/platform/companies" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">View All &rarr;</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-4 font-medium">Company</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.per_company
                  .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                  .slice(0, 5)
                  .map(c => (
                  <tr key={c.company_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{c.name}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300 capitalize">{c.plan}</td>
                    <td className="py-3 pr-4 text-right font-medium text-slate-900 dark:text-white">${Number(c.revenue || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {data.per_company.length === 0 && (
                  <tr><td colSpan="3" className="py-4 text-center text-slate-500">No companies yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Revenue Trend</h2>
            <Link to="/platform/revenue" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">Details &rarr;</Link>
          </div>
          <div className="space-y-3">
             {data.growth.monthly_revenue.slice(0, 5).map(it => (
              <div key={it.month} className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <span className="font-medium text-slate-700 dark:text-slate-300">{it.month}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">${Number(it.revenue || 0).toLocaleString()}</span>
              </div>
            ))}
            {data.growth.monthly_revenue.length === 0 && (
                <div className="py-8 text-center text-slate-500">No revenue data recorded</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Global Reach (Countries)</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {distEntries(data.country_distribution).map(([k,v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                <span className="text-slate-600 dark:text-slate-300">{k}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{v} Users</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Timezones</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {distEntries(data.timezone_distribution).map(([k,v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-slate-50 dark:border-slate-700/30 last:border-0">
                <span className="text-slate-600 dark:text-slate-300 truncate max-w-[70%]">{k}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{v} Users</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
