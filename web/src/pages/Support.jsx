import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, LifeBuoy, Download, ShieldAlert } from 'lucide-react'
import { PublicShell } from '../components/public/PublicShell.jsx'
import { SupportRequestForm } from '../components/support/SupportRequestForm.jsx'

export default function Support() {
  return (
    <PublicShell
      title="Support"
      subtitle="Get help, learn best practices, and submit a request to our support team."
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><BookOpen className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Docs</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Setup, tracking, reports, and admin workflows.</div>
                <Link to="/docs" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Open documentation</Link>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><Download className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Downloads</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Get the desktop tracker and client tools.</div>
                <Link to="/downloads" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Open downloads</Link>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><LifeBuoy className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">What to include</div>
                <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                  <li>Account email + company name</li>
                  <li>Steps to reproduce + timestamps</li>
                  <li>Any error messages or screenshots</li>
                </ul>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><ShieldAlert className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Urgent issues</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">For security concerns, contact security@timetracker.com.</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <SupportRequestForm type="support" defaultSubject="Technical support" />
        </div>
      </div>
    </PublicShell>
  )
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  )
}

function IconWrap({ children }) {
  return (
    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900">
      {children}
    </div>
  )
}
