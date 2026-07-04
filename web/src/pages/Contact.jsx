import React from 'react'
import { Mail, MapPin, Clock, ShieldCheck } from 'lucide-react'
import { PublicShell } from '../components/public/PublicShell.jsx'
import { SupportRequestForm } from '../components/support/SupportRequestForm.jsx'

export default function Contact() {
  return (
    <PublicShell
      title="Contact"
      subtitle="Questions about pricing, onboarding, billing, or security? Send a message and we’ll route it to the right team."
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><Mail className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Email</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">support@wfhlogger.com</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">sales@wfhlogger.com</div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><Clock className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Response times</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Typically within 1 business day.</div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><ShieldCheck className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Security</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Report security issues to security@wfhlogger.com.</div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <IconWrap><MapPin className="w-5 h-5" /></IconWrap>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Office</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">123 Innovation Drive</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">San Francisco, CA 94103</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <SupportRequestForm type="contact" defaultSubject="General inquiry" />
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
