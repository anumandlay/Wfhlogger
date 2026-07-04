import React, { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Docs() {
  const [activeSection, setActiveSection] = useState('getting-started')

  const sections = [
    { id: 'getting-started', title: 'Getting Started' },
    { id: 'organization', title: 'Organization Setup' },
    { id: 'employees', title: 'Managing Employees' },
    { id: 'tracking', title: 'Time Tracking' },
    { id: 'reports', title: 'Reports & Analytics' },
    { id: 'billing', title: 'Billing & Payments' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">TimeTracker Docs</span>
          </Link>
          <div className="flex gap-4">
            <Link to="/support" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Support</Link>
            <Link to="/login" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Login</Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 flex gap-12 items-start">
        {/* Sidebar Navigation */}
        <aside className="w-64 shrink-0 sticky top-32 hidden md:block">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Contents</h3>
          <ul className="space-y-1">
            {sections.map(section => (
              <li key={section.id}>
                <button
                  onClick={() => {
                    setActiveSection(section.id)
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeSection === section.id 
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          
          <section id="getting-started" className="mb-16 scroll-mt-32">
            <h1 className="text-4xl font-bold text-slate-900 mb-6">Getting Started</h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              Welcome to Time Tracker System. This comprehensive guide will help you set up your workspace, invite your team, and start tracking productivity in minutes.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Start Checklist</h3>
              <ul className="list-disc pl-5 space-y-2 text-blue-800">
                <li>Create a Company Account</li>
                <li>Download the Desktop Client</li>
                <li>Invite your first Manager or Employee</li>
              </ul>
            </div>
          </section>

          <section id="organization" className="mb-16 scroll-mt-32">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Organization Setup</h2>
            <p className="text-slate-600 mb-4">
              As a Super Admin, you have full control over your organization's structure.
            </p>
            <h3 className="text-xl font-semibold text-slate-800 mb-3">Creating Teams</h3>
            <p className="text-slate-600 mb-4">
              Navigate to the <strong>Organization</strong> tab in your dashboard. Here you can define departments or teams (e.g., Engineering, Sales) and assign Managers to oversee them.
            </p>
            <div className="bg-slate-100 rounded-lg p-4 font-mono text-sm text-slate-600 mb-4">
              Dashboard &gt; Organization &gt; Create New Team
            </div>
          </section>

          <section id="employees" className="mb-16 scroll-mt-32">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Managing Employees</h2>
            <p className="text-slate-600 mb-4">
              Employees are the core users who will track time. You can add employees manually or invite them via email.
            </p>
            <ul className="space-y-4">
              <li className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">1</div>
                <div>
                  <h4 className="font-semibold text-slate-800">Add Employee</h4>
                  <p className="text-slate-600 text-sm">Enter their email and assign them to a specific team/manager.</p>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">2</div>
                <div>
                  <h4 className="font-semibold text-slate-800">Credit Check</h4>
                  <p className="text-slate-600 text-sm">Ensure you have sufficient credits. Each active employee consumes 1 credit per month.</p>
                </div>
              </li>
            </ul>
          </section>

          <section id="tracking" className="mb-16 scroll-mt-32">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Time Tracking</h2>
            <p className="text-slate-600 mb-4">
              Employees use the desktop client to track time. The client runs quietly in the background and captures:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-2">Activity Levels</h4>
                <p className="text-sm text-slate-500">Measures keyboard and mouse activity to calculate productivity scores.</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-2">Screenshots</h4>
                <p className="text-sm text-slate-500">Takes random screenshots (every ~3 mins) to verify work progress.</p>
              </div>
            </div>
          </section>

          <section id="reports" className="mb-16 scroll-mt-32">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Reports & Analytics</h2>
            <p className="text-slate-600 mb-4">
              Gain insights into your team's performance with detailed reports.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li><strong>Daily Summary:</strong> Total hours worked per employee.</li>
              <li><strong>Timeline:</strong> Visual timeline of work sessions and idle gaps.</li>
              <li><strong>Export:</strong> Download data in CSV or PDF format for payroll.</li>
            </ul>
          </section>

          <section id="billing" className="mb-16 scroll-mt-32">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Billing & Payments</h2>
            <p className="text-slate-600 mb-4">
              We use a simple credit-based system.
            </p>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Pricing Model</h3>
              <p className="text-yellow-800">
                <strong>$1.00 per active employee / month.</strong><br/>
                Credits are deducted automatically at the start of each billing cycle. Ensure your balance never hits zero to avoid service interruption.
              </p>
            </div>
          </section>

        </main>
      </div>
      
      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p>&copy; 2026 Time Tracker System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
