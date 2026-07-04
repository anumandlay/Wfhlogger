import React from 'react'
import axios from 'axios'
import { Send, CheckCircle2, AlertTriangle } from 'lucide-react'

export function SupportRequestForm({ type, defaultSubject }) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [subject, setSubject] = React.useState(defaultSubject || '')
  const [message, setMessage] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [ok, setOk] = React.useState(false)
  const [requestId, setRequestId] = React.useState('')
  const [err, setErr] = React.useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErr('')
    setOk(false)
    setRequestId('')

    try {
      const r = await axios.post('/api/support/request', {
        type,
        name,
        email,
        subject,
        message,
      })
      setOk(true)
      setRequestId(r.data?.requestId || '')
      setMessage('')
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2.message || 'Failed to send. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {ok ? (
        <div className="py-6">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
            Message received
          </div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">We’ll reply as soon as possible. If you have additional details, send a follow‑up referencing this ID.</div>
          {requestId && (
            <div className="mt-4 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Request ID:</span>{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{requestId}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOk(false)}
            className="mt-6 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Send a message</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Share details and we’ll route this to the right team.</div>
          </div>

          {err && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 inline-flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>{err}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="you@company.com"
              />
            </Field>
          </div>

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder={type === 'support' ? 'Issue with screenshots / login / billing…' : 'Sales, billing, partnership…'}
            />
          </Field>

          <Field label="Message">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder={type === 'support' ? 'Include steps, timestamps, and error messages if possible.' : 'How can we help?'}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
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

