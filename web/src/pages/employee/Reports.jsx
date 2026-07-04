import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiBaseSync } from '../../api.js'
import Pagination from '../../components/ui/Pagination.jsx'
import { usePagination } from '../../hooks/usePagination.js'

export default function EmployeeReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [format, setFormat] = useState('csv')

  const reportsPg = usePagination(reports, 10, [reports.length])

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const response = await axios.get('/api/employee/reports', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setReports(response.data.reports || [])
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to load reports'
      setError(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    try {
      setGenerating(true)
      setError('')
      const token = localStorage.getItem('token')
      
      const response = await axios.post('/api/employee/generate-report', {
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        format: format
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Add the new report to the list
      setReports(prev => [response.data, ...prev])
      
      // Auto-download the report
      if (response.data.download_url) {
        const fname = response.data.download_url.split('/').pop() || 'report.csv'
        const base = getApiBaseSync()
        const resp = await axios.get(`${base}/api/employee/reports/${encodeURIComponent(fname)}/download`, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` }
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(resp.data)
        link.setAttribute('download', fname)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to generate report'
      setError(`Error: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-6"></div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-2"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                  </div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-100 dark:border-red-900/50">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Reports</h1>
        <button
          onClick={fetchReports}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Report Generator */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Generate New Report</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Format</label>
            <span className="text-sm text-slate-700 dark:text-slate-300">CSV</span>
          </div>
          <button
            onClick={generateReport}
            disabled={generating}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Report History */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Report History</h2>
        </div>
        <div className="p-6">
          {reportsPg.total > 0 ? (
            <div className="space-y-4">
              {reportsPg.pageItems.map((report, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        Activity Report
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(report.start_date)} - {formatDate(report.end_date)} • {report.format?.toUpperCase()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Generated {report.created_at_local || formatDate(report.created_at)} • {formatFileSize(report.file_size)}
                      </p>
                      {report.timezone && (
                        <p className="text-xs text-slate-500 dark:text-slate-500">Timezone: {report.timezone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.download_url && (
                      <button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token')
                            const fname = report.download_url.split('/').pop() || 'report.csv'
                            const base = getApiBaseSync()
                            const resp = await axios.get(`${base}/api/employee/reports/${encodeURIComponent(fname)}/download`, {
                              responseType: 'blob',
                              headers: { Authorization: `Bearer ${token}` }
                            })
                            const link = document.createElement('a')
                            link.href = URL.createObjectURL(resp.data)
                            link.setAttribute('download', fname)
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            URL.revokeObjectURL(link.href)
                          } catch {
                            // Final fallback: navigate directly
                            const token = localStorage.getItem('token')
                            const fname = report.download_url.split('/').pop() || 'report.csv'
                            const base = getApiBaseSync()
                            window.location.href = `${base}/api/employee/reports/${encodeURIComponent(fname)}/download?token=${encodeURIComponent(token)}`
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Download
                      </button>
                    )}
                    {report.expires_at && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Expires {formatDate(report.expires_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <Pagination
                page={reportsPg.page}
                pageCount={reportsPg.pageCount}
                total={reportsPg.total}
                pageSize={reportsPg.pageSize}
                onPageChange={reportsPg.setPage}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No reports generated</h3>
              <p className="text-slate-600 dark:text-slate-400">Use the form above to create your first personal report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
