import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Pagination from '../../components/ui/Pagination.jsx'
import { usePagination } from '../../hooks/usePagination.js'

export default function EmployeeActivity() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [filter, setFilter] = useState('all')

  const activitiesPg = usePagination(activities, 10, [dateRange.start_date, dateRange.end_date, filter, activities.length])

  useEffect(() => {
    fetchActivities()
  }, [dateRange, filter])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        ...(filter !== 'all' && { type: filter })
      })
      
      const response = await axios.get(`/api/employee/activity-timeline?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setActivities(response.data.activities || [])
      if (response.data.timezone) setTimezone(response.data.timezone)
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to load activity data'
      setError(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const formatTime = (isoString) => {
    if (!isoString) return 'N/A'
    try {
      return new Date(isoString).toLocaleString('en-US', { timeZone: timezone })
    } catch {
      return new Date(isoString).toLocaleString()
    }
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'tracked_session':
        return (
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'manual_entry':
        return (
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                  </div>
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Activity</h1>
        <button
          onClick={fetchActivities}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Activity Type</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            >
              <option value="all">All Activities</option>
              <option value="tracked_session">Tracked Sessions</option>
              <option value="manual_entry">Manual Entries</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activity Timeline</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Showing {activities.length} activities from {dateRange.start_date} to {dateRange.end_date}
          </p>
        </div>
        <div className="p-6">
          {activitiesPg.total > 0 ? (
            <div className="space-y-4">
              {activitiesPg.pageItems.map((activity, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-slate-900 dark:text-white capitalize">
                        {activity.type?.replace('_', ' ')}
                      </h3>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {formatTime(activity.start_time)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Duration: {formatDuration(activity.duration)}
                        {activity.idle_time > 0 && ` (Idle: ${formatDuration(activity.idle_time)})`}
                      </p>
                      {activity.applications && activity.applications.length > 0 && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium">Applications used:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {activity.applications.slice(0, 3).map((app, i) => (
                              <span key={i} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                                {app.name} ({formatDuration(app.duration)})
                              </span>
                            ))}
                            {activity.applications.length > 3 && (
                              <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                                +{activity.applications.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {activity.screenshots > 0 && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Screenshots: {activity.screenshots}
                        </p>
                      )}
                      {activity.manual_entry && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          <p><span className="font-medium">Description:</span> {activity.manual_entry.description}</p>
                          <p><span className="font-medium">Status:</span> 
                            <span className={`ml-1 px-2 py-1 rounded text-xs ${
                              activity.manual_entry.status === 'approved' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : activity.manual_entry.status === 'rejected'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {activity.manual_entry.status}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      activity.productivity_status === 'productive' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : activity.productivity_status === 'neutral'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {activity.productivity_status || 'unknown'}
                    </span>
                  </div>
                </div>
              ))}
              <Pagination
                page={activitiesPg.page}
                pageCount={activitiesPg.pageCount}
                total={activitiesPg.total}
                pageSize={activitiesPg.pageSize}
                onPageChange={activitiesPg.setPage}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No activities found</h3>
              <p className="text-slate-600 dark:text-slate-400">No work activities recorded for the selected date range and filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
