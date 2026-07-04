import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  Clock, BarChart3, Users, Shield, Download, ArrowRight,
  Star, Activity, Target, Zap, Search, Bell,
  TrendingUp, UserCheck, FileText, Settings,
  LogOut, PieChart
} from 'lucide-react'
import { resolveApiBase } from '../api.js'
import { Link001, Link002, Link003 } from '@/components/ui/skiper-ui/skiper40.jsx'

function useApiBase() {
  const [apiBase, setApiBase] = useState('http://localhost:4000')
  useEffect(() => { resolveApiBase().then(setApiBase) }, [])
  return apiBase
}

function FadeUp({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerContainer({ children, className = '' }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function StaggerItem({ children, className = '' }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function Counter({ from = 0, to, suffix = '', decimals = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(from)
  useEffect(() => {
    if (!isInView) return
    let start = from
    const duration = 2000
    const step = Math.max(1, Math.floor((to - from) / (duration / 16)))
    const timer = setInterval(() => {
      start += step
      if (start >= to) { setCount(to); clearInterval(timer) }
      else setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, from, to])
  return <span ref={ref}>{count.toFixed(decimals)}{suffix}</span>
}

const features = [
  { icon: Clock, title: 'Real-Time Tracking', desc: 'Automatic time capture with idle detection, screenshot proof, and granular activity logging.' },
  { icon: BarChart3, title: 'Smart Reports', desc: 'Visual dashboards with exportable timesheets, productivity trends, and team analytics.' },
  { icon: Users, title: 'Team Management', desc: 'Multi-tenant architecture with role-based access for employees, managers, and admins.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 ready, encrypted storage, secure API with JWT auth and audit trails.' },
  { icon: Activity, title: 'Live Monitoring', desc: 'Real-time activity dashboard with screenshots, app usage, and productivity scoring.' },
  { icon: Target, title: 'Project Tracking', desc: 'Billable hours, project budgets, and invoice-ready reports for client billing.' },
]

const stats = [
  { label: 'Active Users', value: 12500, suffix: '+' },
  { label: 'Hours Tracked', value: 2500000, suffix: '+' },
  { label: 'Companies', value: 850, suffix: '+' },
  { label: 'Uptime', value: 99.9, suffix: '%', decimals: 1 },
]

const testimonials = [
  { name: 'Sarah Chen', role: 'CTO, TechFlow Inc', avatar: 'SC', text: 'TimeTracker transformed how we manage remote productivity. The real-time dashboards are a game changer.' },
  { name: 'Marcus Rivera', role: 'Operations Lead, DesignLab', avatar: 'MR', text: 'Setup was seamless. Our team adopted it immediately. The reporting alone saves us 10+ hours a week.' },
  { name: 'Aisha Patel', role: 'CEO, CloudStack', avatar: 'AP', text: 'Enterprise-grade tracking without the complexity. The multi-tenant setup is perfect for our agency.' },
]

const sidebarItems = [
  { icon: BarChart3, label: 'Dashboard', active: true },
  { icon: Clock, label: 'Time Logs' },
  { icon: Users, label: 'Team' },
  { icon: FileText, label: 'Reports' },
  { icon: PieChart, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
]

const timeEntries = [
  { name: 'Alex Morgan', project: 'Frontend Dev', hours: '6h 24m', status: 'active', color: 'emerald' },
  { name: 'Jamie Lee', project: 'API Integration', hours: '4h 10m', status: 'active', color: 'blue' },
  { name: 'Taylor Smith', project: 'UI Design', hours: '3h 45m', status: 'idle', color: 'amber' },
  { name: 'Jordan Park', project: 'Database', hours: '2h 30m', status: 'active', color: 'blue' },
  { name: 'Casey Brown', project: 'Testing', hours: '1h 15m', status: 'break', color: 'purple' },
]

export default function Home() {
  const apiBase = useApiBase()
  const downloadUrl = `${apiBase}/downloads/TimeTrackerSetup.exe`
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0.2])
  const heroScale = useTransform(scrollYProgress, [0, 0.35], [1, 0.95])

  const [currentTime, setCurrentTime] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useEffect(() => {
    const update = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-[#1a1a2e] overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 z-50 origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-3 z-40 mx-auto max-w-6xl rounded-xl sm:rounded-2xl border border-white/20 bg-white/70 backdrop-blur-xl shadow-sm"
      >
        <div className="flex items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">TimeTracker</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            <Link to="/docs" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Docs</Link>
            <Link to="/contact" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Contact</Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Log In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-16 inset-x-3 z-50 mx-auto max-w-6xl rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl md:hidden"
        >
          <div className="p-4 flex flex-col gap-2">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Features</a>
            <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Testimonials</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Pricing</a>
            <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Docs</Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Contact</Link>
            <hr className="my-1 border-slate-100" />
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Log In</Link>
          </div>
        </motion.div>
      )}

      <main onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}>
        {/* Hero Section */}
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-24 sm:pt-28 pb-16 sm:pb-20 overflow-hidden"
        >
          {/* Background Effects */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-400/10 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-400/10 blur-[120px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-400/5 blur-[150px]" />
          </div>

          <div className="relative z-10 text-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 text-sm font-medium text-blue-700 mb-8"
            >
              <Zap className="w-3.5 h-3.5" />
              Trusted by 800+ companies worldwide
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] sm:leading-[1.05]"
            >
              <span className="text-slate-900">Productivity tracking for </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                modern teams
              </span>
              <span className="inline-block ml-2 text-slate-900">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.7 }}
              className="mt-6 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed"
            >
              Gain visibility into work hours, automate timesheets, and boost team efficiency
              with our secure, enterprise-ready platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/signup"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-2xl hover:shadow-xl hover:shadow-blue-500/25 transition-all hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Start Tracking Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href={downloadUrl}
                className="px-8 py-4 bg-white text-slate-700 text-lg font-semibold rounded-2xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-5 h-5" />
                Download Client
              </a>
            </motion.div>

            {/* Professional Time Tracker Dashboard Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="mt-16 w-full max-w-6xl mx-auto relative"
            >
              <div className="relative rounded-2xl bg-gradient-to-b from-[#0c0f1e] to-[#0a0d1a] p-[3px] shadow-2xl shadow-indigo-500/10">
                <div className="rounded-2xl bg-[#0b0e1a] overflow-hidden">
                  {/* Browser Bar */}
                  <div className="h-11 bg-[#0f1225]/90 border-b border-white/[0.06] flex items-center px-5 gap-3">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-[0_0_6px_rgba(255,95,87,0.3)]" />
                      <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-[0_0_6px_rgba(254,188,46,0.3)]" />
                      <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-[0_0_6px_rgba(40,200,64,0.3)]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="h-6 px-4 rounded-md bg-[#1a1d35]/80 border border-white/[0.05] flex items-center gap-2 text-xs text-slate-300">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 2.5-2 4-2 4m0 0c0 0 2-1.5 2-4m0 0c0-2.5-2-4-2-4m0 0c0 0 2 1.5 2 4" />
                        </svg>
                        app.timetracker.io/dashboard
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Content — flex row */}
                  <div className="flex flex-col md:flex-row min-h-[400px] md:min-h-[520px]">  
                    {/* Sidebar */}
                    <div className="w-[200px] bg-[#0a0d1a]/80 border-r border-white/[0.04] p-4 hidden md:flex flex-col gap-1 shrink-0">
                      <div className="flex items-center gap-2.5 px-3 py-3 mb-3 border-b border-white/[0.04]">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-white/80 tracking-tight">TimeTracker</span>
                      </div>
                      {sidebarItems.map((item, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                            item.active
                              ? 'bg-blue-500/15 text-blue-400 font-medium'
                              : 'text-slate-300 hover:text-white/70 hover:bg-white/[0.03]'
                          }`}
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                          {item.active && <div className="ml-auto w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]" />}
                        </div>
                      ))}
                      <div className="mt-auto pt-4 border-t border-white/[0.04] flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 p-3 sm:p-5 md:p-6 overflow-hidden">
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-6 gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-semibold text-white/90 truncate">Dashboard</h3>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">{currentTime} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <div className="relative hidden xs:block">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              placeholder="Search..."
                              className="w-28 sm:w-40 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] pl-8 pr-3 text-xs text-white/80 placeholder:text-slate-500 outline-none focus:border-blue-500/30 transition-colors"
                            />
                          </div>
                          <div className="relative">
                            <Bell className="w-4 h-4 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors" />
                            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]" />
                          </div>
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-blue-500/20">
                            AD
                          </div>
                        </div>
                      </div>

                      {/* Stats Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-5">
                        {[
                          { label: 'Total Hours', value: '164h 32m', change: '+12%', icon: Clock, color: 'blue' },
                          { label: 'Active Employees', value: '24', change: '+3', icon: UserCheck, color: 'emerald' },
                          { label: 'Projects', value: '8', change: '2 pending', icon: Target, color: 'amber' },
                        ].map((card, i) => (
                          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 hover:bg-white/[0.05] transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className={`w-8 h-8 rounded-lg bg-${card.color}-500/10 flex items-center justify-center`}>
                                <card.icon className={`w-4 h-4 text-${card.color}-400`} />
                              </div>
                              <span className={`text-[10px] font-medium ${
                                card.color === 'blue' ? 'text-blue-400' :
                                card.color === 'emerald' ? 'text-emerald-400' : 'text-amber-400'
                              }`}>{card.change}</span>
                            </div>
                            <div className="text-base font-bold text-white/90">{card.value}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{card.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Row: Chart + Activity */}
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Productivity Chart */}
                        <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-semibold text-white/70">Weekly Productivity</h4>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">+8.2%</span>
                              <span>vs last week</span>
                            </div>
                          </div>
                          <div className="flex items-end justify-between gap-2 h-24">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                              const heights = [70, 85, 65, 92, 78, 45, 30]
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                  <div
                                    className="w-full rounded-md bg-gradient-to-t from-blue-500/40 to-indigo-500/20 transition-all duration-500"
                                    style={{ height: `${heights[i]}%` }}
                                  >
                                    <div
                                      className="w-full rounded-md bg-gradient-to-t from-blue-400 to-indigo-400 transition-all duration-500"
                                      style={{ height: `${heights[i] * 0.7}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-slate-500">{day}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="w-full lg:w-[240px] shrink-0 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-semibold text-white/70">Live Activity</h4>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[9px] text-emerald-400/70 font-medium">5 active</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {timeEntries.map((entry, i) => (
                              <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.03] last:border-0">
                                <div className={`w-7 h-7 rounded-full bg-${entry.color}-500/15 flex items-center justify-center text-[10px] font-bold text-${entry.color}-400`}>
                                  {entry.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] text-white/70 font-medium truncate">{entry.name}</div>
                                  <div className="text-[9px] text-slate-400 truncate">{entry.project}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[11px] text-white/60 font-medium">{entry.hours}</div>
                                  <div className={`text-[8px] font-medium uppercase ${
                                    entry.status === 'active' ? 'text-emerald-400' :
                                    entry.status === 'idle' ? 'text-amber-400' : 'text-purple-400'
                                  }`}>{entry.status}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-20 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 blur-[60px] rounded-full" />
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500"
          >
            <span className="text-xs font-medium">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-5 h-8 rounded-full border-2 border-slate-400 flex justify-center pt-1.5"
            >
              <div className="w-1 h-1.5 rounded-full bg-slate-400" />
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Features Section */}
          <section id="features" className="relative px-4 sm:px-6 py-16 sm:py-28">
          <div className="max-w-7xl mx-auto">
            <FadeUp className="text-center mb-16">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-200/50 mb-4">
                Platform Features
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">
                Everything you need to{' '}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                  track productivity
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
                From automatic time tracking to detailed analytics, we provide all the tools
                to keep your team focused and accountable.
              </p>
            </FadeUp>

            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <StaggerItem key={i}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group relative p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-4 border border-blue-100/50 group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
                      <f.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Stats Section */}
          <section className="relative px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 blur-[100px] rounded-full" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto text-center">
            <FadeUp>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Trusted by teams worldwide
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-16">
                Our platform helps businesses of all sizes understand and optimize their team's productivity.
              </p>
            </FadeUp>
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {stats.map((s, i) => (
                <StaggerItem key={i}>
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      <Counter from={0} to={s.value} suffix={s.suffix} decimals={s.decimals || 0} />
                    </div>
                    <div className="mt-2 text-sm text-slate-500 font-medium">{s.label}</div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="relative px-4 sm:px-6 py-16 sm:py-28">
          <div className="max-w-7xl mx-auto">
            <FadeUp className="text-center mb-16">
              <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-200/50 mb-4">
                Testimonials
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">
                Loved by{' '}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent">
                  teams like yours
                </span>
              </h2>
            </FadeUp>

            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <StaggerItem key={i}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-lg transition-all"
                  >
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">"{t.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                        {t.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.role}</div>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* CTA Section */}
        <section id="pricing" className="relative px-4 sm:px-6 py-16 sm:py-28 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 right-1/3 w-[300px] h-[300px] bg-blue-300/10 blur-[80px] rounded-full" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <FadeUp>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to transform your team's productivity?
              </h2>
              <p className="text-lg text-blue-100/80 max-w-2xl mx-auto mb-10">
                Join thousands of companies already using TimeTracker to gain
                complete visibility into their workforce productivity.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="px-8 py-4 bg-white text-indigo-700 text-lg font-semibold rounded-2xl hover:shadow-xl hover:shadow-black/10 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Start Free Trial
                </Link>
                <a
                  href={downloadUrl}
                  className="px-8 py-4 bg-white/10 text-white text-lg font-semibold rounded-2xl border border-white/20 hover:bg-white/20 transition-all hover:-translate-y-0.5 active:scale-[0.98] backdrop-blur-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Client
                </a>
              </div>
            </FadeUp>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0f0f1a] text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="font-bold text-lg text-white tracking-tight">TimeTracker</span>
              </Link>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                Enterprise-grade time tracking and productivity monitoring for modern teams.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-sm hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/docs" className="text-sm hover:text-white transition-colors">Documentation</Link></li>
                <li><Link to="/downloads" className="text-sm hover:text-white transition-colors">Downloads</Link></li>
                <li><Link to="/signup" className="text-sm hover:text-white transition-colors">Sign Up</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/login" className="text-sm hover:text-white transition-colors">Log In</Link></li>
                <li><Link to="/contact" className="text-sm hover:text-white transition-colors">Contact</Link></li>
                <li><Link to="/support" className="text-sm hover:text-white transition-colors">Support</Link></li>
                <li><Link to="/privacy" className="text-sm hover:text-white transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-sm hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Connect</h4>
              <ul className="space-y-3">
                <li>
                  <Link001 href="https://github.com/IamHammadDevX/" className="text-sm !text-slate-400 hover:!text-white">
                    GitHub
                  </Link001>
                </li>
                <li>
                  <Link002 href="mailto:hello@timetracker.com" className="text-sm !text-slate-400 hover:!text-white">
                    Email
                  </Link002>
                </li>
                <li>
                  <Link003 href="/contact" className="text-sm !text-slate-400 hover:!text-white">
                    Contact
                  </Link003>
                </li>
                <li>
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-white transition-colors">
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-500">
              Copyright © {new Date().getFullYear()} Time Tracker System. All rights reserved.
            </p>
            <p className="text-xs text-slate-500">
              Built by{' '}
              <a href="https://github.com/IamHammadDevX/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">
                Hammad
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
