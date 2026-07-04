import React, { useState, useEffect, useMemo } from 'react'
import Pagination from '../../components/ui/Pagination.jsx'
import { usePagination } from '../../hooks/usePagination.js'

export default function SACompanies() {
  const [data, setData] = useState({ per_company: [], total_companies: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    import('../../api.js').then(({ resolveApiBase }) => resolveApiBase().then(base => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      fetch(`${base}/api/platform/metrics`, { headers })
        .then(r => {
          if (!r.ok) throw new Error('Failed to load companies')
          return r.json()
        })
        .then(setData)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }))
  }, [])

  const filteredCompanies = useMemo(() => {
    if (!data.per_company) return []
    return data.per_company.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [data.per_company, search])

  const companiesPg = usePagination(filteredCompanies, 10, [search, filteredCompanies.length])

  if (loading) return <div className="p-8 text-center text-slate-500">Loading tenants...</div>

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Companies</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and monitor all tenant workspaces</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/50">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-6">Company Name</th>
                <th className="py-3 px-6">Plan</th>
                <th className="py-3 px-6">Credits</th>
                <th className="py-3 px-6 text-center">Users (Adm/Mgr/Emp)</th>
                <th className="py-3 px-6 text-right">Revenue</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {companiesPg.total > 0 ? (
                companiesPg.pageItems.map(c => (
                  <tr key={c.company_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-900 dark:text-white">
                      {c.name}
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${c.plan === 'pro' || c.plan === 'enterprise' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' 
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-slate-600 dark:text-slate-300">
                      {c.credits}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span title="Admins" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">{c.admins}</span>
                        <span title="Managers" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded">{c.managers}</span>
                        <span title="Employees" className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">{c.employees}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right font-medium text-slate-900 dark:text-white">
                      ${Number(c.revenue || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No companies found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/30 px-6 py-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
          <span>Showing {companiesPg.total} of {data.per_company?.length || 0} companies</span>
          <div className="text-sm">
            <Pagination
              page={companiesPg.page}
              pageCount={companiesPg.pageCount}
              total={companiesPg.total}
              pageSize={companiesPg.pageSize}
              onPageChange={companiesPg.setPage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
