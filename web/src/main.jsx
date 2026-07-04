import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './index.css'
import './api.js'
import axios from 'axios'
import { resolveApiBase } from './api.js'
import { ThemeProvider } from './ThemeContext.jsx'
import { CreditsProvider } from './CreditsContext.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SADashboard from './pages/platform/SADashboard.jsx'
import SACompanies from './pages/platform/SACompanies.jsx'
import SARevenue from './pages/platform/SARevenue.jsx'
import SACredits from './pages/platform/SACredits.jsx'
import LiveView from './pages/LiveView.jsx'
// Report page merged into TimeTracking
// import Report from './pages/Report.jsx'
import Activity from './pages/Activity.jsx'
import Setup from './pages/Setup.jsx'
import TimeTracking from './pages/TimeTracking.jsx'
import Downloads from './pages/Downloads.jsx'
import SuperAdminLogin from './pages/SuperAdminLogin.jsx'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import Billing from './pages/Billing.jsx'
import CompanyProfile from './pages/CompanyProfile.jsx'
import Requests from './pages/Requests.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Support from './pages/Support.jsx'
import Contact from './pages/Contact.jsx'
import Docs from './pages/Docs.jsx'
import Layout from './components/Layout.jsx'
import EmployeeDashboard from './pages/employee/Dashboard.jsx'
import EmployeeActivity from './pages/employee/Activity.jsx'
import EmployeeReports from './pages/employee/Reports.jsx'
import EmployeeProfile from './pages/employee/Profile.jsx'
import EmployeeLayout from './components/EmployeeLayout.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token')
  const location = useLocation()
  if (!token) {
    return <Navigate to="/login" replace />
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const effectiveRole = (payload.role === 'super_admin' && payload.company_id != null) ? 'company_admin' : payload.role
    
    if (allowedRoles) {
      if (!allowedRoles.includes(effectiveRole)) {
        const fallback = effectiveRole === 'super_admin' ? '/platform' : '/dashboard'
        return <Navigate to={fallback} replace />
      }
    }

    if (effectiveRole === 'super_admin' && !location.pathname.startsWith('/platform')) {
      return <Navigate to="/platform" replace />
    }

    // Use EmployeeLayout for employee role, regular Layout for others
    if (effectiveRole === 'employee') {
      return <EmployeeLayout>{children}</EmployeeLayout>
    }
  } catch (e) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function RoleElement({ employee, managerOrAdmin }) {
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const role = (payload.role === 'super_admin' && payload.company_id != null) ? 'company_admin' : payload.role
    if (role === 'employee') return employee
    return managerOrAdmin
  } catch {
    return null
  }
}

function TenantGuard({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const enforce = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return navigate('/login', { replace: true })
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        const role = (payload.role === 'super_admin' && payload.company_id != null) ? 'company_admin' : payload.role
        if (role === 'super_admin') { setReady(true); return }
        const segs = location.pathname.split('/').filter(Boolean)
        const currentSlug = segs[0] || ''
        const base = await resolveApiBase()
        const { data } = await axios.get(`${base}/api/company/slug`, { headers: { Authorization: `Bearer ${token}` } })
        const expected = data?.slug || ''
        if (!currentSlug || currentSlug !== expected) {
          const tail = '/' + segs.slice(1).join('/')
          navigate(`/${expected}${tail}`, { replace: true })
          return
        }
        setReady(true)
      } catch {
        navigate('/login', { replace: true })
      }
    }
    enforce()
  }, [location.pathname, navigate])

  if (!ready) return null
  return children
}

function RedirectToTenant({ path }) {
  const navigate = useNavigate()
  React.useEffect(() => {
    const go = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return navigate('/login', { replace: true })
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        const role = (payload.role === 'super_admin' && payload.company_id != null) ? 'company_admin' : payload.role
        if (role === 'super_admin') { navigate('/platform', { replace: true }); return }
        const base = await resolveApiBase()
        const { data } = await axios.get(`${base}/api/company/slug`, { headers: { Authorization: `Bearer ${token}` } })
        const expected = data?.slug || ''
        navigate(`/${expected}${path}`, { replace: true })
      } catch {
        navigate('/login', { replace: true })
      }
    }
    go()
  }, [navigate, path])
  return null
}
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/super-admin/login" element={<SuperAdminLogin />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support" element={<Support />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/docs" element={<Docs />} />
      
      {/* Protected Routes wrapped in Layout */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}>
          <RedirectToTenant path="/dashboard" />
        </ProtectedRoute>
      } />
      <Route path="/live" element={<ProtectedRoute allowedRoles={['manager', 'company_admin']}><RedirectToTenant path="/live" /></ProtectedRoute>} />
      <Route path="/report" element={
        <ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}>
          <RedirectToTenant path="/report" />
        </ProtectedRoute>
      } />
      <Route path="/activity" element={
        <ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}>
          <RedirectToTenant path="/activity" />
        </ProtectedRoute>
      } />
      <Route path="/requests" element={<ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}><RedirectToTenant path="/requests" /></ProtectedRoute>} />
      <Route path="/setup" element={<ProtectedRoute allowedRoles={['manager', 'company_admin']}><RedirectToTenant path="/setup" /></ProtectedRoute>} />
      <Route path="/time-tracking" element={<ProtectedRoute allowedRoles={['manager', 'company_admin']}><RedirectToTenant path="/time-tracking" /></ProtectedRoute>} />
      <Route path="/downloads" element={<ProtectedRoute><RedirectToTenant path="/downloads" /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['company_admin']}><RedirectToTenant path="/admin" /></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['company_admin']}><RedirectToTenant path="/audit-logs" /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute allowedRoles={['company_admin']}><RedirectToTenant path="/billing" /></ProtectedRoute>} />
      <Route path="/company" element={<ProtectedRoute allowedRoles={['company_admin']}><RedirectToTenant path="/company" /></ProtectedRoute>} />
      <Route path="/platform" element={<ProtectedRoute allowedRoles={['super_admin']}><SADashboard /></ProtectedRoute>} />
      <Route path="/platform/companies" element={<ProtectedRoute allowedRoles={['super_admin']}><SACompanies /></ProtectedRoute>} />
      <Route path="/platform/credits" element={<ProtectedRoute allowedRoles={['super_admin']}><SACredits /></ProtectedRoute>} />
      <Route path="/platform/revenue" element={<ProtectedRoute allowedRoles={['super_admin']}><SARevenue /></ProtectedRoute>} />

      <Route path="/profile" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeProfile /></ProtectedRoute>} />

      <Route path="/employee/dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/employee/activity" element={<Navigate to="/activity" replace />} />
      <Route path="/employee/reports" element={<Navigate to="/report" replace />} />
      <Route path="/employee/profile" element={<Navigate to="/profile" replace />} />
      
      {/* Tenant-scoped routes */}
      <Route path="/:companySlug/login" element={<Login />} />
      <Route path="/:companySlug/signup" element={<Signup />} />
      <Route path="/:companySlug/forgot-password" element={<ForgotPassword />} />
      <Route path="/:companySlug/reset-password" element={<ResetPassword />} />
      <Route path="/:companySlug/dashboard" element={
        <ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}>
          <TenantGuard>
            <RoleElement employee={<EmployeeDashboard />} managerOrAdmin={<Dashboard />} />
          </TenantGuard>
        </ProtectedRoute>
      } />
      <Route path="/:companySlug/live" element={<ProtectedRoute allowedRoles={['manager', 'company_admin']}><TenantGuard><LiveView /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/report" element={
        <ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}>
          <TenantGuard>
            <RoleElement employee={<EmployeeReports />} managerOrAdmin={<TimeTracking />} />
          </TenantGuard>
        </ProtectedRoute>
      } />
      <Route path="/:companySlug/activity" element={<ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}><TenantGuard><RoleElement employee={<EmployeeActivity />} managerOrAdmin={<Activity />} /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/requests" element={<ProtectedRoute allowedRoles={['employee', 'manager', 'company_admin']}><TenantGuard><Requests /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/setup" element={<ProtectedRoute allowedRoles={['manager', 'company_admin']}><TenantGuard><Setup /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/time-tracking" element={<ProtectedRoute allowedRoles={['manager', 'company_admin']}><TenantGuard><TimeTracking /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/downloads" element={<ProtectedRoute><TenantGuard><Downloads /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/admin" element={<ProtectedRoute allowedRoles={['company_admin']}><TenantGuard><Admin /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/audit-logs" element={<ProtectedRoute allowedRoles={['company_admin']}><TenantGuard><AuditLogs /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/billing" element={<ProtectedRoute allowedRoles={['company_admin']}><TenantGuard><Billing /></TenantGuard></ProtectedRoute>} />
      <Route path="/:companySlug/company" element={<ProtectedRoute allowedRoles={['company_admin']}><TenantGuard><CompanyProfile /></TenantGuard></ProtectedRoute>} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <CreditsProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CreditsProvider>
    </ThemeProvider>
  </React.StrictMode>
)
