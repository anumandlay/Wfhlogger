import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectMongo } from './db.js';
import { db, getUserByEmail, getSuperAdmin, createUser, verifyPassword, seedDefaultSuperAdmin, createOrganization, listManagers, getOrganizationByManagerId, upsertEmployeePassword, deleteUserById, deleteUserByEmail, deleteOrganizationByManagerId, createCompany, getCompanyById, updateCompanyCredits, createTransaction, getTransactions, getTransactionByReferenceId, createTimeRequest, getTimeRequests, updateTimeRequestStatus, getTimeRequestById, getWorkSessions, creditCompanyWithTransaction, debitCompanyWithTransaction, ensureEmployeeBillingSchedule, updateCompanyProfile, getNextInvoiceNo, createInvoice, listInvoices, getInvoiceByCompany, setInvoicePdfPath, recordEmployeeTempPassword, updateEmployeeTempPassword, listEmployeeTempPasswords, recordManagerTempPassword, listManagerTempPasswords, deleteManagerTempPassword, createPasswordResetToken, verifyResetToken, resetPassword, updateUserProfile, updateUserTimezone, listCompanies, listUsersByCompany, listAllUsers, markWebhookEventProcessed, listWebhookEvents, applyStripeCheckoutCreditsOnce, activateCompany } from './sqlite.js';
import { generateInvoicePdf } from './invoices/pdf.js'

import { formatLocalDateTime, localDateKey, parseLocalDateTimeToUtcMs, toIsoZ } from './timezone.js'
import bcrypt from 'bcryptjs';
// Razorpay disabled (kept for future re-enable)
// import { createOrder, verifySignature } from './payment.js';
import { createStripeCheckoutSession, verifyStripeWebhookAndExtract, retrieveCheckoutSession, listRecentCheckoutSessions } from './payments/stripe.js';
import { sendEmail, sendPaymentSuccess, sendLowCreditWarning, sendCreationBlocked, sendSubscriptionDeduction, sendRequestStatus, sendNewUserCreated, sendMonthlyBillingSummary, sendContactFormEmail, sendPasswordResetEmail, sendEmployeeCreatedDeduction, sendAccountSuspensionWarning, sendActivationEmail } from './email.js';
import { runEmployeeMonthlyBilling, getCompanyAdminEmail } from './subscriptionBilling.js'
import { uploadScreenshot, getScreenshotStream, getStorageQuota, getCompanyStorageQuota, deleteScreenshotsByEmployee } from './s3.js'
import cron from 'node-cron';
import crypto from 'crypto';
import { Readable } from 'stream';

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map(s => String(s || '').trim())
    .map(s => s.replace(/^`|`$/g, '').replace(/^"|"$/g, '').replace(/^'|'$/g, ''))
    .map(s => s.replace(/\/$/, ''))
    .filter(Boolean)
}

const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const DATA_DIR = process.env.DATA_DIR || 'data';
const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase();

function validateProductionEnv() {
  const env = String(process.env.NODE_ENV || '').toLowerCase()
  if (env !== 'production') return

  const jwt = String(process.env.JWT_SECRET || '')
  if (!jwt || jwt === 'dev_secret' || jwt.length < 32) {
    throw new Error('Invalid JWT_SECRET for production')
  }

  const origins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  if (!origins.length) {
    throw new Error('ALLOWED_ORIGINS must be set in production')
  }
  if (origins.some(o => o === '*' || o.startsWith('http://'))) {
    throw new Error('ALLOWED_ORIGINS must not contain * or http:// in production')
  }
}

validateProductionEnv()

function uuid() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  return crypto.randomBytes(16).toString('hex')
}

// Ensure upload directory exists (relative to current working dir)
const uploadPath = path.resolve(process.cwd(), UPLOAD_DIR);
fs.mkdirSync(uploadPath, { recursive: true });
const metaFile = path.join(uploadPath, 'index.json');
if (!fs.existsSync(metaFile)) {
  fs.writeFileSync(metaFile, '[]');
}

// Ensure data directory exists
const dataPath = path.resolve(process.cwd(), DATA_DIR);
fs.mkdirSync(dataPath, { recursive: true });
const orgFile = path.join(dataPath, 'organization.json');
const usersFile = path.join(dataPath, 'users.json');
const intervalsFile = path.join(dataPath, 'intervals.json');
const sessionsFile = path.join(dataPath, 'work_sessions.json');
const auditFile = path.join(dataPath, 'audit_logs.json');
if (!fs.existsSync(orgFile)) fs.writeFileSync(orgFile, JSON.stringify({ name: '', createdAt: null }, null, 2));
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]');
if (!fs.existsSync(intervalsFile)) fs.writeFileSync(intervalsFile, '{}');
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, '[]');
if (!fs.existsSync(auditFile)) fs.writeFileSync(auditFile, '[]');
const screenshotsS3File = path.join(dataPath, 'screenshots.s3.json');
if (!fs.existsSync(screenshotsS3File)) fs.writeFileSync(screenshotsS3File, '[]');
const transactionsFile = path.join(dataPath, 'transactions.sqlite.json');
if (!fs.existsSync(transactionsFile)) fs.writeFileSync(transactionsFile, '[]');

cron.schedule('0 0 * * *', () => {
  console.log('[Billing] Running daily employee subscription cycle...')
  runEmployeeMonthlyBilling({
    emitCreditsUpdated: (company_id, balance) => {
      try { io.to(`company:${company_id}`).emit('company:credits_updated', { company_id, balance }) } catch {}
    }
  }).catch(e => {
    console.error('[Billing] Subscription error:', e?.message || e)
  })
});

// Users/team helpers
function readUsers(){
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf-8')); } catch { return []; }
}
function writeUsers(arr){ fs.writeFileSync(usersFile, JSON.stringify(arr, null, 2)); }

function getEmployeeTimezone(email, companyId) {
  const e = String(email || '').trim().toLowerCase()
  if (!e) return 'UTC'
  try {
    const u = getUserByEmail(e)
    if (u && (!companyId || u.company_id == companyId)) return (u.timezone || 'UTC')
  } catch {}
  try {
    const arr = readUsers()
    const r = arr.find(x => String(x.email || '').toLowerCase() === e && (!companyId || x.company_id == companyId))
    return (r?.timezone || 'UTC')
  } catch {}
  return 'UTC'
}

function setEmployeeTimezone(email, companyId, timezone) {
  const e = String(email || '').trim().toLowerCase()
  const tz = String(timezone || '').trim() || 'UTC'
  if (!e) return null
  try {
    const u = getUserByEmail(e)
    if (u && (!companyId || u.company_id == companyId)) {
      try { updateUserTimezone(e, tz) } catch {}
    }
  } catch {}
  try {
    const arr = readUsers()
    const idx = arr.findIndex(x => String(x.email || '').toLowerCase() === e && (!companyId || x.company_id == companyId))
    if (idx >= 0) {
      arr[idx].timezone = tz
      writeUsers(arr)
    }
  } catch {}
  return tz
}
function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; } }
function writeJSON(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
function getTeamEmailsForManager(managerKey, companyId){
  const users = readUsers();
  // Accept either manager numeric id or email; resolve both forms
  const keyStr = String(managerKey || '').trim();
  const matchManager = (u) => {
    const mid = String(u.managerId || '').trim();
    return mid === keyStr || mid.toLowerCase() === keyStr.toLowerCase();
  };
  return users
    .filter(u => u.role === 'employee' && matchManager(u) && (companyId ? u.company_id == companyId : true))
    .map(u => u.email);
}
function appendAudit(type, details, company_id){
  try {
    const arr = JSON.parse(fs.readFileSync(auditFile, 'utf-8'));
    arr.push({ type, details, company_id, ts: new Date().toISOString() });
    fs.writeFileSync(auditFile, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('[audit] append failed:', e);
  }
}

function slugifyName(name) {
  try {
    return String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  } catch {
    return 'company'
  }
}

function signPreviewToken(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}
function verifyPreviewToken(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 2) return null
    const [payload, sig] = parts
    const expSig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expSig)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!obj?.exp || Date.now() > Number(obj.exp)) return null
    return obj
  } catch {
    return null
  }
}

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `${ts}-${file.originalname}`);
  }
});
const upload = multer({ storage });

const app = express();
app.set('etag', false)
const httpServer = createServer(app);
// Socket.IO: allow all origins because desktop clients are non-browser
// and rely on JWT for authorization. Express CORS remains restricted.
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    credentials: false
  },
  transports: ['websocket', 'polling'] // Explicitly allow both
});

// Middlewares
// Relax CSP/CORP for cross-origin resource loading from the web dev server
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
})
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler)
// Allow all origins for dev and do not set credentials to avoid the invalid '*' + credentials combination
app.use(cors({ origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*', credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
// Serve uploaded images statically for the web UI
app.use('/uploads', express.static(uploadPath));
const publicDownloadsPath = path.join(process.cwd(), 'public', 'downloads');

app.get(['/downloads', '/downloads/'], (req, res) => {
  const indexPath = path.join(process.cwd(), 'web', 'dist', 'index.html')
  const accept = String(req.headers?.accept || '')
  const wantsHtml = accept.includes('text/html') || accept.includes('*/*')
  if (wantsHtml && fs.existsSync(indexPath)) {
    return res.sendFile(indexPath)
  }
  if (wantsHtml && !fs.existsSync(indexPath)) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    return res.redirect(`${frontendUrl}/downloads`)
  }
  return res.redirect('/downloads/TimeTrackerSetup.exe')
})

// Robust download serving: check public/downloads, then desktop folder candidates
app.use('/downloads', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  
  const requestedFile = req.path.replace(/^\//, ''); // e.g. "TimeTrackerSetup.exe"
  if (!requestedFile) return next();
  
  // Candidates for the file
  const candidates = [
    path.join(publicDownloadsPath, requestedFile),
    path.join(process.cwd(), 'desktop', requestedFile),
    path.join(process.cwd(), '..', 'desktop', requestedFile),
    path.join(process.cwd(), '..', 'desktop', 'dist', requestedFile),
    // Fallback for TimeTrackerSetup.exe -> TimeTracker.exe if setup not found
    (requestedFile === 'TimeTrackerSetup.exe') ? path.join(process.cwd(), 'desktop', 'TimeTracker.exe') : null,
    (requestedFile === 'TimeTrackerSetup.exe') ? path.join(process.cwd(), '..', 'desktop', 'TimeTracker.exe') : null
  ].filter(Boolean);

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return res.download(file, requestedFile); // Serve with correct name
    }
  }
  
  // If no file found, let express.static handle or 404
  next();
});
app.use('/downloads', express.static(publicDownloadsPath));
// Serve generated personal reports
const publicReportsPath = path.join(process.cwd(), 'public', 'reports');
fs.mkdirSync(publicReportsPath, { recursive: true });
app.use('/reports', express.static(publicReportsPath));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Startup warnings for production hardening
if (JWT_SECRET === 'dev_secret') {
  console.warn('[security] Using default JWT_SECRET. Set a strong JWT_SECRET for production.');
}
if (!ALLOWED_ORIGINS.length) {
  console.warn('[cors] ALLOWED_ORIGINS not set. CORS is wide open (*) for development.');
}

// Seed default Super Admin on startup
seedDefaultSuperAdmin();

// Auth
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) return res.status(400).json({ error: 'Email, password and role are required' });
    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const effectiveRole = (user.role === 'super_admin' && user.company_id != null) ? 'company_admin' : user.role;
    if (String(role) !== String(effectiveRole)) {
      try { appendAudit('rbac_role_mismatch', { email, selectedRole: role, actualRole: effectiveRole }, user.company_id); } catch {}
      return res.status(403).json({ error: 'Forbidden: role mismatch' });
    }

    const ok = verifyPassword(user, password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Check if the company is activated (skip for super_admin)
    if (effectiveRole !== 'super_admin' && user.company_id) {
      const company = getCompanyById(user.company_id)
      if (company && company.is_active != null && company.is_active === 0) {
        return res.status(403).json({ error: 'Account not activated. Please check your email for the activation link.', needsActivation: true })
      }
    }

    let tz = (user.timezone || 'UTC')
    const clientTz = String(req.body?.client_timezone || '').trim()
    if ((!tz || tz === 'UTC') && clientTz && clientTz.toUpperCase() !== 'UTC') {
      tz = setEmployeeTimezone(user.email, user.company_id, clientTz) || tz
    }

    const token = jwt.sign({ sub: user.email, email: user.email, role: effectiveRole, uid: user.id, company_id: user.company_id, full_name: user.full_name, country: user.country || '', timezone: tz || 'UTC' }, JWT_SECRET, { expiresIn: '8h' });
    try {
      if (user.role === 'employee') {
        appendAudit('employee_web_login', { email, ip: req.ip, ua: req.headers['user-agent'] }, user.company_id);
      }
    } catch {}
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, country: user.country || '', timezone: tz || 'UTC', role: effectiveRole } });
  } catch (e) {
    console.error('[auth:login] error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Signup (Multi-tenant)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { companyName, email, password, fullName, country, timezone } = req.body || {};
    if (!companyName || !email || !password || !fullName || !country || !timezone) return res.status(400).json({ error: 'All fields are required' });
    
    const existing = getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User already exists' });

    // Create Company
    const company = createCompany({ name: companyName, billing_email: email, admin_contact_email: email });
    
    const user = createUser({ email, full_name: fullName, country, timezone, password, role: 'company_admin', company_id: company.id });
    
    // Create Default Team (Organization) linked to company
    createOrganization({ name: `${companyName}`, managerId: user.id, company_id: company.id });

    // Send activation email
    let emailSent = false
    let emailError = null
    try {
      const baseUrl = String(process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
      const slug = String(companyName || 'company').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company'
      const loginUrl = `${baseUrl}/${slug}/login`
      const activateUrl = `${baseUrl}/api/auth/activate/${company.activation_token}`
      
      await sendActivationEmail(email, { fullName, companyName, activateUrl, loginUrl, password })
      emailSent = true
    } catch (emailErr) {
      console.error('[auth:signup] Activation email failed:', emailErr?.message || emailErr)
      emailError = emailErr?.message || 'Email service unavailable'
    }

    if (!emailSent) {
      // Company + user created, but email failed. Return partial success with warning.
      return res.status(201).json({
        ok: true,
        message: 'Workspace created but activation email could not be sent.',
        needsActivation: true,
        activation_email: email,
        email_error: emailError,
        activation_token: company.activation_token
      })
    }
    
    res.status(201).json({ ok: true, message: 'Workspace created! Check your email for the activation link.', needsActivation: true, activation_email: email });
  } catch (e) {
    console.error('[auth:signup] error:', e);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Account Activation
app.get('/api/auth/activate/:token', async (req, res) => {
  try {
    const { token } = req.params
    if (!token) return res.status(400).send('Activation token is required')

    const company = activateCompany(token)
    if (!company) {
      return res.status(404).send(`
        <!doctype html><html><head><meta charset="utf-8"/><title>Activation Failed</title></head>
        <body style="font-family:system-ui;margin:40px;line-height:1.5;text-align:center;">
          <h2 style="color:#E11D48;">Activation link invalid or expired</h2>
          <p style="color:#64748B;">Please contact support for assistance.</p>
        </body></html>
      `)
    }

    const baseUrl = String(process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
    const slug = String(company.name || 'company').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company'
    const loginUrl = `${baseUrl}/${slug}/login?activated=true`

    res.redirect(301, loginUrl)
  } catch (e) {
    console.error('[auth:activate] error:', e)
    res.status(500).send('Activation failed')
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email is required' })
    
    const user = getUserByEmail(email)
    if (!user) {
      // Don't reveal user existence
      return res.json({ ok: true, message: 'If an account exists, instructions have been sent.' })
    }

    if (user.role === 'employee') {
      return res.status(400).json({ 
        error: 'Employee account', 
        message: 'Please contact your Manager to reset your password.' 
      })
    }

    if (user.role === 'manager') {
      return res.status(400).json({ 
        error: 'Manager account', 
        message: 'Please contact your Company Admin to reset your password.' 
      })
    }

    if (user.role === 'super_admin') {
      const token = createPasswordResetToken(user.email)
      // Determine base URL: In production it's likely the same domain.
      // In dev, frontend is usually 5173, backend is 4000.
      // We should use an environment variable FRONTEND_URL.
      // Fallback: If request origin header exists, use it (likely the frontend making the request).
      const origin = req.headers.origin || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173'; 
      const resetUrl = `${origin}/reset-password?token=${token}`
      // Log for development ease
      console.log(`[AUTH] Password Reset Link for ${user.email}: ${resetUrl}`);
      await sendPasswordResetEmail(user.email, resetUrl)
      return res.json({ ok: true, message: 'Password reset link sent to your email.' })
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('[auth:forgot] error:', e)
    res.status(500).json({ error: 'Request failed' })
  }
})

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, password } = req.body || {}
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' })
    
    const success = resetPassword(token, password)
    if (!success) return res.status(400).json({ error: 'Invalid or expired token' })
    
    res.json({ ok: true, message: 'Password reset successfully' })
  } catch (e) {
    console.error('[auth:reset] error:', e)
    res.status(500).json({ error: 'Reset failed' })
  }
})

// Contact Us Form Submission
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Determine support email - defaulting to env var or a fallback
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
    
    if (supportEmail) {
      await sendContactFormEmail(supportEmail, { name, email, subject, message });
      // Send auto-reply to user? (Optional enhancement)
    } else {
      console.warn('[contact] No support email configured to receive messages.');
    }

    res.json({ ok: true, message: 'Message sent successfully' });
  } catch (e) {
    console.error('[contact] error:', e);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const supportRate = new Map()
function checkRate(key, limit, windowMs) {
  const now = Date.now()
  const cur = supportRate.get(key)
  if (!cur || now - cur.start > windowMs) {
    supportRate.set(key, { start: now, count: 1 })
    return { ok: true }
  }
  if (cur.count >= limit) {
    const retryAfterMs = windowMs - (now - cur.start)
    return { ok: false, retryAfterMs }
  }
  cur.count += 1
  return { ok: true }
}

app.post('/api/support/request', async (req, res) => {
  try {
    const ipKey = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim() || 'unknown'
    const rl = checkRate(`support:${ipKey}`, 5, 60_000)
    if (!rl.ok) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)))
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' })
    }

    const { type, name, email, subject, message, userId, companyId } = req.body || {}
    const t = String(type || '').trim().toLowerCase()
    if (t !== 'contact' && t !== 'support') return res.status(400).json({ error: 'Invalid type' })
    const n = String(name || '').trim()
    const e = String(email || '').trim()
    const s = String(subject || '').trim()
    const m = String(message || '').trim()
    if (!n || !e || !s || !m) return res.status(400).json({ error: 'All fields are required' })
    if (s.length > 200) return res.status(400).json({ error: 'Subject is too long' })
    if (m.length > 8000) return res.status(400).json({ error: 'Message is too long' })

    const requestId = uuid()
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
    const prefix = t === 'support' ? 'Support Request' : 'Contact Request'
    const decoratedSubject = `${prefix}: ${s}`
    const decoratedMessage = `${m}\n\n---\nRequest ID: ${requestId}\nType: ${t}\nFrom IP: ${ipKey}\nUser ID: ${userId || ''}\nCompany ID: ${companyId || ''}`

    if (supportEmail) {
      await sendContactFormEmail(supportEmail, { name: n, email: e, subject: decoratedSubject, message: decoratedMessage })
    } else {
      console.warn('[support] No SUPPORT_EMAIL/EMAIL_USER configured to receive messages.')
    }

    try { appendAudit('support_request_created', { requestId, type: t, email: e, subject: s }, companyId || null) } catch {}
    return res.json({ ok: true, requestId })
  } catch (err) {
    console.error('[support:request] error:', err)
    return res.status(500).json({ error: 'Failed to send message' })
  }
})

// Simple auth middleware
function requireRole(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      try { appendAudit('rbac_unauthorized', { path: req.path, method: req.method }, null) } catch {}
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (roles.length && !roles.includes(payload.role)) {
        try { appendAudit('rbac_forbidden', { path: req.path, method: req.method, role: payload.role, company_id: payload.company_id }, payload.company_id) } catch {}
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (e) {
      try { appendAudit('rbac_invalid_token', { path: req.path, method: req.method }, null) } catch {}
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Organization setup
app.post('/api/org', requireRole(['manager', 'super_admin']), (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const role = req.user?.role;
  const company_id = req.user?.company_id;

  try {
    if (role === 'super_admin') {
      // Super Admin: Update Company Name in SQLite
      if (db) {
        db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name.trim(), company_id);
      } else {
        // Fallback JSON update
        const comps = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, 'companies.sqlite.json'), 'utf-8'));
        const idx = comps.findIndex(c => c.id == company_id);
        if (idx >= 0) {
          comps[idx].name = name.trim();
          fs.writeFileSync(path.resolve(process.cwd(), DATA_DIR, 'companies.sqlite.json'), JSON.stringify(comps, null, 2));
        }
      }
      return res.json({ ok: true, organization: { name: name.trim() } });
    }

    if (role === 'manager') {
      // Manager: Update their Team (Organization) Name
      // Find the org managed by this user
      const mgrId = req.user?.uid;
      let org = getOrganizationByManagerId(mgrId);
      
      if (!org) {
        // Create if missing? Or error?
        // Usually managers have an org created on assignment.
        return res.status(404).json({ error: 'Organization not found for manager' });
      }

      // Ensure org belongs to company
      if (org.company_id != company_id) return res.status(403).json({ error: 'Forbidden' });

      if (db) {
        db.prepare('UPDATE organizations SET name = ? WHERE id = ?').run(name.trim(), org.id);
      } else {
        const orgs = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, 'organizations.sqlite.json'), 'utf-8'));
        const idx = orgs.findIndex(o => o.id == org.id);
        if (idx >= 0) {
          orgs[idx].name = name.trim();
          fs.writeFileSync(path.resolve(process.cwd(), DATA_DIR, 'organizations.sqlite.json'), JSON.stringify(orgs, null, 2));
        }
      }
      return res.json({ ok: true, organization: { name: name.trim() } });
    }
  } catch (e) {
    console.error('[org:update] error:', e);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

app.get('/api/org', requireRole(['manager', 'super_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const role = req.user?.role;

    if (role === 'super_admin') {
      const company = getCompanyById(company_id);
      if (company) return res.json({ organization: { name: company.name, createdAt: company.created_at } });
    }

    if (role === 'manager') {
      const mgrId = req.user?.uid;
      let org = getOrganizationByManagerId(mgrId);
      // Ensure org belongs to same company
      if (org && org.company_id == company_id) {
        return res.json({ organization: { name: org.name, createdAt: org.created_at } });
      }
    }
    
    return res.json({ organization: { name: '', createdAt: null } });
  } catch {
    res.json({ organization: { name: '', createdAt: null } });
  }
});

// Team info for the authenticated manager (maps to organization by manager)
app.get('/api/team', requireRole(['manager', 'super_admin', 'company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id;
    // For super_admin owner or company_admin, we return the company info as the "team"
    if (req.user?.role === 'super_admin' || req.user?.role === 'company_admin') {
      const company = getCompanyById(company_id);
      if (company) {
        return res.json({ team: { id: company.id, name: company.name } });
      }
      // If company not found (should not happen), fallback to finding the default org
      // This ensures we display something instead of "Not configured"
      const org = getOrganizationByManagerId(req.user?.uid);
      if (org) {
        return res.json({ team: { id: org.id, name: org.name } });
      }
    }

    if (req.user?.role === 'manager') {
      const mgrId = req.user?.uid;
      const mgrEmail = req.user?.sub;
      let org = null;
      try { org = getOrganizationByManagerId(mgrId); } catch {}
      if (!org) {
        try { org = getOrganizationByManagerId(mgrEmail); } catch {}
      }
      // Ensure org belongs to same company
      if (org && org.company_id == company_id) {
        return res.json({ team: { id: org.id, name: org.name } });
      }
      return res.json({ team: null });
    }
    return res.json({ team: null });
  } catch {
    return res.json({ team: null });
  }
});

// Company slug by token
app.get('/api/company/slug', requireRole(['employee', 'manager', 'company_admin', 'super_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const company = getCompanyById(company_id)
    if (!company) return res.status(404).json({ error: 'Company not found' })
    const slug = slugifyName(company.name)
    res.json({ slug })
  } catch (e) {
    res.status(500).json({ error: 'Failed to resolve slug' })
  }
})

function listScopedEmployeeEmails(viewer, company_id) {
  const users = readUsers().filter(u => u.role === 'employee' && u.company_id == company_id)
  if (viewer?.role === 'manager') {
    const teamEmails = getTeamEmailsForManager(viewer?.uid || viewer?.sub, company_id)
    return users.map(u => u.email).filter(e => teamEmails.includes(e))
  }
  return users.map(u => u.email)
}

// ── S3 Storage Routes ──

app.get('/api/storage/status', requireRole(['employee']), (req, res) => {
  res.json({ connected: true, provider: 's3' })
})

app.get('/api/storage/quota', requireRole(['manager', 'company_admin']), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const employeeId = String(req.query?.employeeId || '').trim().toLowerCase()
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' })
    const scoped = listScopedEmployeeEmails(req.user, company_id).map(e => String(e).toLowerCase())
    if (!scoped.includes(employeeId)) return res.status(403).json({ error: 'Forbidden' })
    const quota = await getStorageQuota(company_id, employeeId)
    res.json({ quota })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch quota' })
  }
})

app.get('/api/storage/quota/list', requireRole(['manager', 'company_admin']), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const emails = listScopedEmployeeEmails(req.user, company_id).map(e => String(e).trim().toLowerCase()).filter(Boolean)
    const out = []
    for (const email of emails) {
      try {
        const q = await getStorageQuota(company_id, email)
        out.push(q)
      } catch {
        out.push({ connected: false, employee_id: email })
      }
    }
    res.json({ quotas: out })
  } catch {
    res.status(500).json({ error: 'Failed to list quotas' })
  }
})

app.get('/api/storage/quota/self', requireRole(['employee']), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const email = String(req.user?.sub || '').trim().toLowerCase()
    if (!company_id || !email) return res.status(400).json({ error: 'Missing context' })
    const quota = await getStorageQuota(company_id, email)
    res.json({ quota })
  } catch {
    res.status(500).json({ error: 'Failed to fetch quota' })
  }
})

app.post('/api/uploads/drive', requireRole(['employee']), multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('screenshot'), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const employee_id = req.user?.sub
    const now = new Date()
    const { key } = await uploadScreenshot(req.file?.buffer || Buffer.alloc(0), company_id, employee_id, now)
    const meta = readJSON(screenshotsS3File)
    let manager_id = null
    try {
      const emp = getUserByEmail(employee_id)
      manager_id = emp?.managerId || emp?.manager_id || emp?.manager || null
    } catch {}
    meta.push({ company_id, manager_id, employee_id, s3_key: key, captured_at: now.toISOString() })
    writeJSON(screenshotsS3File, meta)
    res.json({ ok: true, s3_key: key, captured_at: now.toISOString() })
  } catch (e) {
    res.status(500).json({ error: 'upload_failed' })
  }
})

app.get('/api/uploads/preview/:key', async (req, res) => {
  try {
    const s3key = String(req.params.key)
    // Auth check
    let user = null
    try {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      if (token) user = jwt.verify(token, JWT_SECRET)
    } catch {}
    if (!user && req.query?.pt) {
      const pt = verifyPreviewToken(req.query.pt)
      if (pt && pt.fileId === s3key) {
        user = { sub: pt.sub, role: pt.role, uid: pt.uid || null, company_id: pt.company_id }
      }
    }
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    const meta = readJSON(screenshotsS3File)
    const m = meta.find(x => x.s3_key === s3key)
    if (!m) return res.status(404).end()
    const role = user?.role
    const company_id = user?.company_id
    if (role === 'super_admin') return res.status(403).end()
    if (m.company_id != company_id) return res.status(403).end()
    if (role === 'employee' && m.employee_id !== user?.sub) return res.status(403).end()
    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(user?.uid || user?.sub, company_id)
      if (!teamEmails.includes(m.employee_id)) return res.status(403).end()
    }
    const { stream, contentType } = await getScreenshotStream(s3key)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline')
    try {
      const nodeStream = Readable.fromWeb(stream)
      nodeStream.on('error', () => { try { res.end() } catch {} })
      nodeStream.pipe(res)
    } catch {
      const ab = await stream.arrayBuffer()
      res.end(Buffer.from(ab))
    }
  } catch (e) {
    res.status(500).end()
  }
})

// ── End S3 Storage Routes ──

// Employees
app.post('/api/employees', requireRole(['manager', 'company_admin']), (req, res) => {
  const { email, name, country, timezone, managerId: bodyManagerId, password } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Full name is required' });
  if (!country || !String(country).trim()) return res.status(400).json({ error: 'Country is required' });
  if (!timezone || !String(timezone).trim()) return res.status(400).json({ error: 'Timezone is required' });
  try {
    const users = readUsers();
    // Scope check: Check if user exists in THIS company? 
    // Email is globally unique usually.
    if (users.find(u => u.email.toLowerCase() === String(email).toLowerCase())) {
      return res.status(409).json({ error: 'User already exists' });
    }
    // Also prevent duplicate login user in sqlite
    const existingLogin = getUserByEmail(email);
    if (existingLogin) {
      return res.status(409).json({ error: 'Login user already exists' });
    }
    const requesterRole = req.user?.role;
    const requesterUid = req.user?.uid || req.user?.sub;
    const managerId = (requesterRole === 'manager') ? requesterUid : (bodyManagerId || requesterUid || null);
    const company_id = req.user?.company_id;

    // Credit Check for Employee Creation
    // Check if company has credits. Cost = 1 credit? 
    // Or just check if balance > 0 to allow adding? 
    // "validate the company’s available credit balance; if credits are insufficient, block"
    // Assuming 1 employee = 1 credit/month. We check if they have at least 1 credit to add a user?
    // Or subscription model: credits are deducted monthly. Adding user might not deduct immediately but requires balance?
    // Let's enforce: Must have at least 1 credit to add an employee.
    const company = getCompanyById(company_id);
    if (company && (company.credits || 0) < 1) {
      const to = getCompanyAdminEmail(company_id, company) || req.user?.email
      if (to) sendCreationBlocked({ to, company, actor: req.user?.email || req.user?.uid || req.user?.sub })
      return res.status(402).json({ error: 'Insufficient credits. Please add credits to your account.' });
    }

    // Generate a temporary password if not provided
    const tempPassword = password && String(password).trim()
      ? String(password).trim()
      : Math.random().toString(36).slice(2, 10);

    // Create login user in sqlite (or JSON fallback) with company_id
    // We pass 'name' as full_name
  const loginUser = createUser({ email, full_name: name || '', country, timezone, password: tempPassword, role: 'employee', company_id });

    // Store team mapping and display name in simple JSON store
    // Note: 'name' here in users.json is redundant if we use sqlite full_name, but kept for legacy JSON compatibility
  const record = { id: loginUser.id, email, name: name || '', country, timezone, role: 'employee', managerId, company_id, createdAt: new Date().toISOString() };
    users.push(record);
    writeUsers(users);

    try { recordEmployeeTempPassword(company_id, loginUser.email, tempPassword) } catch {}

    // Send New User Created Emails
    try {
       const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}`;
       const company = getCompanyById(company_id)
       const adminEmail = company?.billing_email || listAllUsers().find(u => u.company_id == company_id && u.role === 'company_admin')?.email || company?.admin_contact_email || null
       // 2. To Assigned Manager (if any)
       let manager = null;
       if (managerId) {
         // managerId can be ID or Email.
         const allUsers = readUsers();
         manager = allUsers.find(u => u.id == managerId || u.email === managerId);
       }
       
       // Get Team Name
       let teamName = 'Unassigned';
       if (managerId) {
         const org = getOrganizationByManagerId(managerId);
         if (org) teamName = org.name;
       }

       const emailData = {
         name: name || email,
         email,
         role: 'employee',
         teamName,
         password: tempPassword,
         loginUrl,
         company
       };

       if (adminEmail) {
         sendNewUserCreated(adminEmail, emailData);
       }
       if (manager && manager.email && manager.email !== adminEmail) {
         sendNewUserCreated(manager.email, emailData);
       }
       // Send welcome email to the employee themselves
       sendNewUserCreated(email, emailData);
    } catch (emailErr) {
       console.warn('[employees:create] failed to send emails:', emailErr);
    }

    // Immediate debit: $1 (1 credit) for employee activation
    try {
      const comp = getCompanyById(company_id) || { id: company_id }
      const newBalance = debitCompanyWithTransaction({
        company_id,
        amount_usd: 1,
        credits: 1,
        description: 'Employee activation',
        reference_id: `emp_${loginUser.id}`
      })
      try { ensureEmployeeBillingSchedule({ company_id, employee_id: loginUser.id, start_at: new Date().toISOString() }) } catch {}
      const admin = listAllUsers().find(u => u.company_id == company_id && u.role === 'company_admin');
      if (admin) {
        sendEmployeeCreatedDeduction({
          to: admin.email,
          company: comp,
          employeeName: name || email,
          employeeEmail: email,
          deducted: 1,
          remaining: newBalance
        });
        
        // Check for Low Balance or Suspension after deduction
        if (newBalance <= 0) {
          sendAccountSuspensionWarning({ to: admin.email, company: comp });
        } else if (newBalance < 5) {
          sendLowCreditWarning({ to: admin.email, balance: newBalance, company: comp });
        }
      }
      try { io.to(`company:${company_id}`).emit('company:credits_updated', { company_id, balance: newBalance }) } catch {}
    } catch (e) {
      console.warn('[employees:debit_on_create] failed:', e?.message || e);
    }

    try { io.to(`company:${company_id}`).emit('employees:updated', { company_id, email }) } catch {}
    res.status(201).json({
      user: record,
      login: { id: loginUser.id, email: loginUser.email, tempPassword }
    });
  } catch (e) {
    console.error('[employees] write error:', e);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

app.post('/api/employees/timezone', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const { email, timezone } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email is required' })
    if (!timezone || !String(timezone).trim()) return res.status(400).json({ error: 'Timezone is required' })

    const company_id = req.user?.company_id
    const targetEmail = String(email).trim().toLowerCase()

    const allUsers = readUsers()
    const target = allUsers.find(u => u.role === 'employee' && String(u.email || '').toLowerCase() === targetEmail)
    if (!target || target.company_id != company_id) return res.status(404).json({ error: 'Employee not found' })

    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id)
      if (!teamEmails.includes(target.email)) return res.status(403).json({ error: 'Forbidden: not your team' })
    }

    const oldTz = target.timezone || getEmployeeTimezone(target.email, company_id) || 'UTC'
    const tz = setEmployeeTimezone(target.email, company_id, timezone)
    appendAudit('employee_timezone_updated', { actorId: req.user?.uid || req.user?.sub, employeeEmail: target.email, oldTimezone: oldTz, timezone: tz }, company_id)
    res.json({ ok: true, email: target.email, timezone: tz })
  } catch (e) {
    res.status(500).json({ error: 'Failed to update timezone' })
  }
})

// ---- Super Admin: Manager creation ----
app.post('/api/admin/managers', requireRole(['company_admin']), (req, res) => {
  try {
    const { email, password, orgName, name, country, timezone } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (!orgName || !String(orgName).trim()) return res.status(400).json({ error: 'Team name is required' });
    // name is mandatory now
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Manager full name is required' });
    if (!country || !String(country).trim()) return res.status(400).json({ error: 'Country is required' });
    if (!timezone || !String(timezone).trim()) return res.status(400).json({ error: 'Timezone is required' });

    const existing = getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User already exists' });
    
    const company_id = req.user?.company_id;
    const manager = createUser({ email, full_name: name, country, timezone, password, role: 'manager', company_id });
    try { recordManagerTempPassword(company_id, manager.email, password) } catch {}
    const org = createOrganization({ name: orgName.trim(), managerId: manager.id, company_id });
    
    // Send New User Created Emails (Manager)
    try {
       const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}`;
       const company = getCompanyById(company_id)
       const adminEmail = req.user?.email || listAllUsers().find(u => u.company_id == company_id && u.role === 'company_admin')?.email || null
       const emailData = {
         name: name, 
         email,
         role: 'manager',
         teamName: orgName.trim(),
         password: password,
         loginUrl,
         company
       };
       // Send to Admin (copy)
       if (adminEmail) sendNewUserCreated(adminEmail, emailData);
       // Send to New Manager
       sendNewUserCreated(email, emailData);
    } catch (e) {
      console.warn('[admin:create_manager] email send failed', e);
    }

    res.status(201).json({ ok: true, manager: { id: manager.id, email: manager.email, full_name: manager.full_name, country: manager.country || '', timezone: manager.timezone || 'UTC', role: manager.role, employeeCount: 0, organization: { id: org.id, name: org.name } }, organization: org });
  } catch (e) {
    console.error('[admin:create_manager] error:', e);
    res.status(500).json({ error: 'Failed to create manager' });
  }
});

// Admin: List manager initial credentials
app.get('/api/admin/managers/creds', requireRole(['company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const rows = listManagerTempPasswords(company_id)
    res.json({ creds: rows })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load manager credentials' })
  }
})

// Manager/Admin: List employee initial credentials (tenant-scoped)
app.get('/api/employees/initial-creds', requireRole(['manager','company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const role = req.user?.role
    const email = req.user?.sub
    let rows = listEmployeeTempPasswords(company_id)

    // Managers should only see credentials for their own employees
    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || email, company_id)
      const myEmails = new Set(teamEmails)
      rows = rows.filter(r => myEmails.has(r.employee_email))
    }

    res.json({ creds: rows })
  } catch (e) {
    console.error('[initial-creds] error:', e)
    res.status(500).json({ error: 'Failed to load credentials' })
  }
})

// ---- Super Admin: Managers list with employee counts ----
app.get('/api/admin/managers', requireRole(['company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const managers = listManagers(company_id);
    const allUsers = readUsers();
    // Scope employees to company
    const employees = allUsers.filter(u => u.role === 'employee' && u.company_id == company_id);
    const enriched = managers.map(m => {
      const org = getOrganizationByManagerId(m.id) || null;
      // Extra check: ensure org belongs to company
      const orgData = (org && org.company_id == company_id) ? { id: org.id, name: org.name } : null;
      const count = employees.filter(e => String(e.managerId) === String(m.id) || String(e.managerId) === String(m.email)).length;
      return { id: m.id, email: m.email, full_name: m.full_name || '', employeeCount: count, organization: orgData };
    });
    res.json({ managers: enriched });
  } catch (e) {
    console.error('[admin:list_managers] error:', e);
    res.status(500).json({ error: 'Failed to list managers' });
  }
});

// ---- Super Admin: Delete a manager ----
app.delete('/api/admin/managers/:id', requireRole(['company_admin']), (req, res) => {
  try {
    const { id } = req.params;
    // Verify manager exists
    let exists = null;
    if (db) {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'manager'");
      exists = stmt.get(id);
    } else {
      try {
        const arr = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, 'users.sqlite.json'), 'utf-8'));
        exists = arr.find(u => String(u.id) === String(id) && u.role === 'manager');
      } catch {}
    }
    if (!exists) return res.status(404).json({ error: 'Manager not found' });

    // Delete orgs tied to this manager
    try { deleteOrganizationByManagerId(id); } catch {}
    // Delete manager creds
    try { if (exists.email) deleteManagerTempPassword(exists.email); } catch {}
    // Delete manager login
    const ok = deleteUserById(id);
    if (!ok) return res.status(500).json({ error: 'Failed to delete manager' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[admin:delete_manager] error:', e);
    res.status(500).json({ error: 'Delete manager failed' });
  }
});

// ---- Company Admin: Update manager (e.g. replace manager, reassign employees) ----
app.put('/api/admin/managers/:id', requireRole(['company_admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, country, timezone, reassign_to_id } = req.body || {};
    const company_id = req.user?.company_id;

    // Find the manager
    let manager = null;
    if (db) {
      manager = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'manager' AND company_id = ?").get(id, company_id);
    } else {
      try {
        const arr = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, 'users.sqlite.json'), 'utf-8'));
        manager = arr.find(u => String(u.id) === String(id) && u.role === 'manager' && u.company_id == company_id);
      } catch {}
    }
    if (!manager) return res.status(404).json({ error: 'Manager not found' });

    // Update manager fields
    if (db) {
      if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, id);
      if (full_name) db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, id);
    } else {
      try {
        const arr = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, 'users.sqlite.json'), 'utf-8'));
        const idx = arr.findIndex(u => String(u.id) === String(id));
        if (idx >= 0) {
          if (email) arr[idx].email = email;
          if (full_name) arr[idx].full_name = full_name;
          fs.writeFileSync(path.resolve(process.cwd(), DATA_DIR, 'users.sqlite.json'), JSON.stringify(arr, null, 2));
        }
      } catch {}
    }

    // If reassign_to_id is provided, reassign all employees from this manager to another
    if (reassign_to_id && String(reassign_to_id) !== String(id)) {
      const users = readUsers();
      let changed = 0;
      // Normalize to number to match SQLite id type
      const targetId = Number(reassign_to_id);
      const updated = users.map(u => {
        if (u.role === 'employee' && u.company_id == company_id && (String(u.managerId) === String(id) || String(u.managerId) === manager.email)) {
          changed++;
          return { ...u, managerId: targetId };
        }
        return u;
      });
      if (changed > 0) writeUsers(updated);
      console.log(`[admin:update_manager] reassigned ${changed} employees from manager ${id} to ${reassign_to_id}`);
    }

    appendAudit('manager_updated', { actorId: req.user?.uid || req.user?.sub, managerId: id, newEmail: email || manager.email, reassignToId: reassign_to_id || null }, company_id);
    res.json({ ok: true, message: 'Manager updated successfully' });
  } catch (e) {
    console.error('[admin:update_manager] error:', e);
    res.status(500).json({ error: 'Failed to update manager' });
  }
});

// ---- Super Admin: Audit logs ----
app.get('/api/admin/audit-logs', requireRole(['company_admin']), (req, res) => {
  try {
    let logs = [];
    try { logs = JSON.parse(fs.readFileSync(auditFile, 'utf-8')); } catch {}
    const company_id = req.user?.company_id;
    // Strict Company Filter
    logs = logs.filter(l => l.company_id == company_id);

    const { managerId, employeeId, actor, employee, type, from, to } = req.query || {};
    const actorQ = String(actor || managerId || '').trim();
    const employeeQ = String(employee || employeeId || '').trim();
    const typeQ = String(type || '').trim();

    const fromMs = from ? new Date(String(from)).getTime() : null
    const toMs = to ? new Date(String(to)).getTime() : null
    if (Number.isFinite(fromMs)) logs = logs.filter(l => (l?.ts ? Date.parse(l.ts) : 0) >= fromMs)
    if (Number.isFinite(toMs)) logs = logs.filter(l => (l?.ts ? Date.parse(l.ts) : 0) <= toMs)
    if (typeQ) logs = logs.filter(l => String(l.type || '').toLowerCase() === typeQ.toLowerCase())
    if (actorQ) logs = logs.filter(l => {
      const v = l?.details?.actorId ?? l?.details?.actor ?? l?.details?.email ?? ''
      return String(v).toLowerCase().includes(actorQ.toLowerCase())
    })
    if (employeeQ) logs = logs.filter(l => {
      const v = l?.details?.employeeId ?? l?.details?.employeeEmail ?? l?.details?.employee_id ?? ''
      return String(v).toLowerCase().includes(employeeQ.toLowerCase())
    })

    const company = getCompanyById(company_id)
    const usersSql = listAllUsers().filter(u => u.company_id == company_id)
    const usersJson = readUsers().filter(u => u.company_id == company_id)
    const findUser = (key) => {
      const s = String(key || '').trim()
      if (!s) return null
      const sl = s.toLowerCase()
      return usersSql.find(u => String(u.id || '').toLowerCase() === sl || String(u.uid || '').toLowerCase() === sl || String(u.email || '').toLowerCase() === sl) ||
        usersJson.find(u => String(u.id || '').toLowerCase() === sl || String(u.managerId || '').toLowerCase() === sl || String(u.email || '').toLowerCase() === sl) ||
        null
    }
    const asActor = (u) => {
      if (!u) return null
      return {
        id: u.id ?? u.uid ?? null,
        email: u.email || null,
        name: u.full_name || u.name || null,
        role: u.role || null,
      }
    }
    const asTargetEmployee = (u) => {
      if (!u) return null
      return {
        email: u.email || null,
        name: u.full_name || u.name || null,
        managerId: u.managerId || u.manager_id || null,
      }
    }
    const getEmployeeKey = (details) => {
      return details?.employeeEmail || details?.employeeId || details?.employee_id || details?.employee || null
    }
    const getActorKey = (details) => {
      return details?.actorEmail || details?.actorId || details?.actor || details?.email || null
    }
    const buildSummary = (l, actorUser, targetUser) => {
      const d = l?.details || {}
      const actorName = actorUser?.full_name || actorUser?.name || actorUser?.email || String(getActorKey(d) || 'Actor')
      const targetName = targetUser?.full_name || targetUser?.name || targetUser?.email || String(getEmployeeKey(d) || 'Employee')
      const secsToLabel = (s) => {
        if (s == null) return 'none'
        const m = Math.floor(Number(s) / 60)
        const sec = Number(s) % 60
        return m > 0 ? `${m}min${sec > 0 ? ` ${sec}sec` : ''}` : `${sec}sec`
      }
      switch (String(l?.type || '')) {
        case 'employee_timezone_updated': {
          const oldVal = d.oldTimezone || null
          const newVal = d.timezone || 'UTC'
          return oldVal && oldVal !== newVal
            ? `${actorName} changed ${targetName} timezone from ${oldVal} to ${newVal}`
            : `${actorName} set ${targetName} timezone to ${newVal}`
        }
        case 'interval_set': {
          const oldVal = secsToLabel(d.oldIntervalSeconds)
          const newVal = secsToLabel(d.intervalSeconds)
          return oldVal !== 'none' && oldVal !== newVal
            ? `${actorName} changed ${targetName} capture interval from ${oldVal} to ${newVal}`
            : `${actorName} set ${targetName} capture interval to ${newVal}`
        }
        case 'company_profile_updated':
          return `${actorName} updated company profile`
        case 'live_view_start':
          return `${actorName} started live view for ${targetName}`
        case 'rbac_forbidden':
          return `Forbidden request to ${d.method || ''} ${d.path || ''}`.trim()
        case 'rbac_invalid_token':
          return `Invalid token on ${d.method || ''} ${d.path || ''}`.trim()
        default:
          if (String(l?.type || '').startsWith('request_')) {
            const s = String(l.type).replace('request_', '')
            return `${actorName} set request ${d.requestId || ''} to ${s}`.trim()
          }
          return String(l?.type || 'Audit event')
      }
    }
    const viewerTz = req.user?.timezone || 'UTC'
    logs = logs.map(l => {
      const subject = l?.details?.employeeId || l?.details?.employeeEmail || l?.details?.employee_id || null
      const tz = subject ? getEmployeeTimezone(subject, company_id) : viewerTz
      const ms = l?.ts ? Date.parse(l.ts) : null
      const ts_local = ms ? formatLocalDateTime(ms, tz, { withSeconds: true }) : null
      const actorUser = findUser(getActorKey(l?.details || {}))
      const targetUser = findUser(getEmployeeKey(l?.details || {}))
      return {
        ...l,
        timezone: tz,
        ts_local,
        company: { id: company_id, name: company?.name || null, slug: company?.slug || null },
        actor: asActor(actorUser),
        targetEmployee: asTargetEmployee(targetUser),
        summary: buildSummary(l, actorUser, targetUser),
      }
    })
    // Sort most recent first
    logs.sort((a, b) => {
      const aTs = a?.ts ? Date.parse(a.ts) : 0
      const bTs = b?.ts ? Date.parse(b.ts) : 0
      return bTs - aTs
    })
    res.json({ logs });
  } catch (e) {
    console.error('[admin:audit_logs] error:', e);
    res.status(500).json({ error: 'Failed to read audit logs' });
  }
});

app.get('/api/employees', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const allUsers = readUsers();
    const company_id = req.user?.company_id;
    // Filter by company
    const users = allUsers.filter(u => u.company_id == company_id);

    const enrich = (u) => {
      const tz = u?.timezone || getEmployeeTimezone(u?.email, company_id)
      const createdAt = u?.createdAt || u?.created_at || null
      const ms = createdAt ? Date.parse(createdAt) : null
      return {
        ...u,
        timezone: tz,
        createdAt_local: ms ? formatLocalDateTime(ms, tz, { withSeconds: true }) : null,
        createdAt_utc: createdAt,
      }
    }

    const role = req.user?.role;
    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id);
      const teamUsers = users.filter(u => u.role === 'employee' && teamEmails.includes(u.email));
      return res.json({ users: teamUsers.map(enrich) });
    }
    // Super Admin: return ALL employees in company
    // Currently, `users` contains all users in company. We should return all employees for stats?
    // Or return managers too?
    // Dashboard expects `filteredEmployees` which are usually just 'employees'.
    // If we return all users, dashboard filters `role === 'employee'`? No, it trusts backend.
    // Let's return all users in company so dashboard can filter or display.
    // BUT frontend expects `users` array of employee objects.
    
    // Fix: Return all employees of the company for super_admin
    const companyEmployees = users.filter(u => u.role === 'employee');
    res.json({ users: companyEmployees.map(enrich) });
  } catch {
    res.json({ users: [] });
  }
});

// ---- Admin/Manager: Delete an employee ----
app.delete('/api/employees/:email', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    let { email } = req.params;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    email = String(email).toLowerCase();
    const allUsers = readUsers();
    const employee = allUsers.find(u => u.role === 'employee' && String(u.email).toLowerCase() === String(email).toLowerCase());
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    // Managers may only remove their team
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, req.user?.company_id);
      if (!teamEmails.includes(employee.email)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
    }
    const remaining = allUsers.filter(u => String(u.email).toLowerCase() !== String(email).toLowerCase());
    writeUsers(remaining);
    try { deleteUserByEmail(email); } catch {}
    // Clean up any temp password records for this employee
    try { db?.prepare('DELETE FROM employee_creds WHERE lower(employee_email) = lower(?)').run(email); } catch {}
    try {
      const ecredFile = path.resolve(process.cwd(), DATA_DIR, 'employee_creds.sqlite.json')
      if (fs.existsSync(ecredFile)) {
        let arr = JSON.parse(fs.readFileSync(ecredFile, 'utf-8'))
        const before = arr.length
        arr = arr.filter(r => String(r.employee_email).toLowerCase() !== String(email).toLowerCase())
        if (arr.length !== before) fs.writeFileSync(ecredFile, JSON.stringify(arr, null, 2))
      }
    } catch {}
    // Also clean up manager_creds in case this was a manager-level employee reference
    try { db?.prepare('DELETE FROM manager_creds WHERE lower(manager_email) = lower(?)').run(email); } catch {}
    try {
      const mcredFile = path.resolve(process.cwd(), DATA_DIR, 'manager_creds.sqlite.json')
      if (fs.existsSync(mcredFile)) {
        let arr = JSON.parse(fs.readFileSync(mcredFile, 'utf-8'))
        const before = arr.length
        arr = arr.filter(r => String(r.manager_email).toLowerCase() !== String(email).toLowerCase())
        if (arr.length !== before) fs.writeFileSync(mcredFile, JSON.stringify(arr, null, 2))
      }
    } catch {}
    // Terminate any ongoing live streams for this employee
    try {
      liveStreamOn.set(email, false);
      io.to(viewersRoom(email)).emit('live_view:terminate', { by: email, reason: 'deleted' });
    } catch {}

    // Cleanup screenshots/files and metadata for this employee for consistency
    try {
      let meta = [];
      try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')); } catch {}
      const targets = meta.filter(m => String(m.employeeId).toLowerCase() === String(email).toLowerCase());
      let removed = 0;
      let bytesFreed = 0;
      for (const m of targets) {
        try {
          const fname = path.basename(String(m.file || ''));
          const abs = path.join(uploadPath, fname);
          try { bytesFreed += fs.statSync(abs).size; } catch {}
          if (fs.existsSync(abs)) fs.unlinkSync(abs);
          removed += 1;
        } catch {}
      }
      const keep = meta.filter(m => String(m.employeeId).toLowerCase() !== String(email).toLowerCase());
      try { fs.writeFileSync(metaFile, JSON.stringify(keep, null, 2)); } catch {}
      try { io.emit('uploads:cleanup_done', { removed, bytesFreed, employeeId: email }); } catch {}
    } catch (cleanupErr) {
      console.warn('[employees:delete] screenshot cleanup failed:', cleanupErr?.message || cleanupErr);
    }

    try { io.to(`company:${req.user?.company_id}`).emit('employees:updated', { company_id: req.user?.company_id, email }) } catch {}
    res.json({ ok: true });
  } catch (e) {
    console.error('[employees:delete] error:', e);
    res.status(500).json({ error: 'Delete employee failed' });
  }
});

// Admin/Manager: Set or reset an employee password (provision login if missing)
app.post('/api/admin/employees/password', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    email = String(email).toLowerCase();
    const allUsers = readUsers();
    const employee = allUsers.find(u => u.role === 'employee' && u.email.toLowerCase() === String(email).toLowerCase());
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    // Managers can only modify their team
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, req.user?.company_id);
      if (!teamEmails.includes(employee.email)) return res.status(403).json({ error: 'Forbidden: not your team' });
    }
    const loginUser = upsertEmployeePassword(employee.email, String(password));
    res.json({ ok: true, user: { email: employee.email }, login: { id: loginUser.id, email: loginUser.email } });
  } catch (e) {
    console.error('[admin:set_employee_password] error:', e);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// ---- Time Requests (Manual Entry) ----

app.post('/api/requests', requireRole(['employee']), (req, res) => {
  try {
    const { date, start_time, end_time, reason, timezone } = req.body;
    const { company_id, uid } = req.user;

    // Basic Validation
    if (!date || !start_time || !end_time || !reason) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const tz = String(timezone || req.user?.timezone || 'UTC').trim() || 'UTC'
    const startMs = parseLocalDateTimeToUtcMs(date, start_time, tz)
    const endMs = parseLocalDateTimeToUtcMs(date, end_time, tz)
    if (startMs == null || endMs == null) return res.status(400).json({ error: 'Invalid date or time' })
    if (endMs <= startMs) return res.status(400).json({ error: 'End time must be after start time' });

    const request = createTimeRequest({
      company_id,
      employee_id: uid,
      date,
      start_time,
      end_time,
      timezone: tz,
      start_utc: toIsoZ(startMs),
      end_utc: toIsoZ(endMs),
      reason
    });

    // Send email to the employee's manager only
    try {
      const employeeEmail = req.user?.sub || ''
      const users = readUsers()
      const employeeData = users.find(u => String(u.email).toLowerCase() === String(employeeEmail).toLowerCase() && u.company_id == company_id)
      if (employeeData?.managerId) {
        const managers = listManagers(company_id)
        const manager = managers.find(m => String(m.id) === String(employeeData.managerId) || String(m.email).toLowerCase() === String(employeeData.managerId).toLowerCase())
        const managerEmail = manager?.email || null
        if (managerEmail) {
          const employeeName = employeeData.name || employeeEmail
          const subject = `Time request from ${employeeName}`
          const body = `${employeeName} has submitted a manual time request.\n\nDate: ${date}\nTime: ${start_time} - ${end_time}\nTimezone: ${tz}\nReason: ${reason}\n\nPlease review and respond in the Time Tracker app.`
          sendEmail(managerEmail, subject, body)
        }
      }
    } catch (emailErr) {
      console.warn('[requests:create] failed to notify manager:', emailErr)
    }

    res.json({ request });
  } catch (e) {
    console.error('[requests:create]', e);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.get('/api/requests', requireRole(['manager', 'company_admin', 'employee']), (req, res) => {
  try {
    const { company_id, role, uid } = req.user;

    const allLoginUsers = (() => {
      try { return listAllUsers().filter(u => u.company_id == company_id) } catch { return [] }
    })()
    const userById = (id) => allLoginUsers.find(u => u.id == id) || null
    const enrich = (r) => {
      const userRow = userById(r.employee_id)
      const employee_email = userRow?.email || null
      const employee_name = userRow?.full_name || userRow?.name || null
      const tz = String(r.timezone || (employee_email ? getEmployeeTimezone(employee_email, company_id) : req.user?.timezone) || 'UTC').trim() || 'UTC'
      const startUtc = r.start_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.start_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const endUtc = r.end_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.end_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const start_local = startUtc ? formatLocalDateTime(Date.parse(startUtc), tz, { withSeconds: true }) : null
      const end_local = endUtc ? formatLocalDateTime(Date.parse(endUtc), tz, { withSeconds: true }) : null
      const created_at_local = r.created_at ? formatLocalDateTime(Date.parse(r.created_at), tz, { withSeconds: true }) : null
      const action_at_local = r.action_at ? formatLocalDateTime(Date.parse(r.action_at), tz, { withSeconds: true }) : null
      return { ...r, employee_email, employee_name, timezone: tz, start_utc: startUtc, end_utc: endUtc, start_local, end_local, created_at_local, action_at_local }
    }

    if (role === 'employee') {
      const requests = getTimeRequests(company_id, uid);
      return res.json({ requests: requests.map(enrich) });
    }
    // Managers/Admins see company requests; managers are restricted to their team
    let requests = getTimeRequests(company_id);
    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(uid, company_id);
      const teamIds = new Set(teamEmails.map(em => {
        try { const u = getUserByEmail(em); return u?.id || null } catch { return null }
      }).filter(Boolean));
      requests = requests.filter(r => teamIds.has(r.employee_id));
    }
    
    // Filter pending only? Or all? Let's return all sorted.
    res.json({ requests: requests.map(enrich) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Lightweight pending count for sidebar badge
app.get('/api/requests/pending-count', requireRole(['manager', 'company_admin', 'employee']), (req, res) => {
  try {
    const { company_id, role, uid } = req.user;
    let requests = getTimeRequests(company_id);
    if (role === 'employee') {
      requests = requests.filter(r => r.employee_id == uid);
    } else if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(uid, company_id);
      const teamIds = new Set(teamEmails.map(em => {
        try { const u = getUserByEmail(em); return u?.id || null } catch { return null }
      }).filter(Boolean));
      requests = requests.filter(r => teamIds.has(r.employee_id));
    }
    const pending = requests.filter(r => r.status === 'pending').length;
    res.json({ count: pending });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/requests/:id/:action', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const { id, action } = req.params; // action: approve or reject
    const { company_id, uid } = req.user;
    
    const request = getTimeRequestById(id);
    if (!request || request.company_id != company_id) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }
    // Managers can only act on their team
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(uid, company_id);
      const teamIds = new Set(teamEmails.map(em => {
        try { const u = getUserByEmail(em); return u?.id || null } catch { return null }
      }).filter(Boolean));
      if (!teamIds.has(request.employee_id)) {
        return res.status(403).json({ error: 'Forbidden: not your team' });
      }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updated = updateTimeRequestStatus(id, newStatus, uid);

    if (newStatus === 'approved') {
      const byId = readUsers().find(u => u.id == request.employee_id) || null
      const employeeEmail = byId?.email || (() => {
        try { return listAllUsers().find(u => u.company_id == company_id && u.id == request.employee_id)?.email || null } catch { return null }
      })()

      const tz = String(request.timezone || (employeeEmail ? getEmployeeTimezone(employeeEmail, company_id) : 'UTC')).trim() || 'UTC'
      const startUtc = request.start_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(request.date, request.start_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const endUtc = request.end_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(request.date, request.end_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()

      if (employeeEmail && startUtc && endUtc) {
        const sessions = readSessions()
        const startMs = Date.parse(startUtc)
        const record = {
          id: `${employeeEmail}-manual-${request.id}`,
          employeeId: employeeEmail,
          company_id,
          startedAt: startUtc,
          endedAt: endUtc,
          isActive: false,
          idleSeconds: 0,
          lastHeartbeatAt: endUtc,
          date: localDateKey(startMs, tz),
          type: 'manual',
          approved_by: uid,
          request_id: Number(request.id)
        }
        sessions.push(record)
        writeSessions(sessions)
      }
    }
    
    // Send Email
    const user = readUsers().find(u => u.id == request.employee_id);
    if (user) {
      sendRequestStatus(user.email, newStatus, request.date, request.reason);
    }
    
    // Audit Log
    appendAudit(`request_${newStatus}`, { requestId: id, actorId: uid }, company_id);

    res.json({ ok: true, request: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ---- Billing & Payments ----

// Razorpay order endpoint deactivated
app.post('/api/billing/order', requireRole(['super_admin']), async (req, res) => {
  return res.status(503).json({ error: 'Razorpay is temporarily disabled' });
});

// Razorpay verify endpoint deactivated
app.post('/api/billing/verify', requireRole(['super_admin']), async (req, res) => {
  return res.status(503).json({ error: 'Razorpay is temporarily disabled' });
});

app.get('/api/billing/history', requireRole(['company_admin']), (req, res) => {
  try {
    const history = getTransactions(req.user?.company_id);
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/billing/balance', requireRole(['company_admin', 'manager']), (req, res) => {
  try {
    const company = getCompanyById(req.user?.company_id);
    res.json({ credits: company?.credits || 0, plan: company?.plan });
  } catch (e) {
    res.json({ credits: 0 });
  }
});

// Billing summary (admin)
app.get('/api/billing/summary', requireRole(['company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const company = getCompanyById(company_id);
    const balance = company?.credits || 0;
    const history = getTransactions(company_id);
    res.json({ balance, history });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

app.get('/api/billing/diagnostics', requireRole(['company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const company = getCompanyById(company_id)
    const history = getTransactions(company_id) || []
    const lastTransaction = history[0] || null
    const lastCredit = history.find(t => t.type === 'credit') || null
    const webhookEvents = listWebhookEvents({ provider: 'stripe', company_id, limit: 10 })
    res.json({
      ok: true,
      storage: db ? 'sqlite' : 'json',
      company_id,
      credits: company?.credits || 0,
      plan: company?.plan || 'free',
      last_transaction: lastTransaction,
      last_credit: lastCredit,
      last_webhook_events: webhookEvents,
      now: new Date().toISOString()
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to fetch diagnostics' })
  }
})

app.get('/api/billing/invoices', requireRole(['company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const list = listInvoices(company_id)
    res.json({ invoices: list })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch invoices' })
  }
})

app.get('/api/billing/invoices/:invoice_id/download', requireRole(['company_admin']), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const invoice_id = req.params.invoice_id
    const inv = getInvoiceByCompany(company_id, invoice_id)
    if (!inv) return res.status(404).json({ error: 'Invoice not found' })

    // Check if PDF exists on disk
    let pdfPath = inv.pdf_path ? path.resolve(process.cwd(), inv.pdf_path) : null
    let exists = pdfPath && fs.existsSync(pdfPath)

    if (!exists) {
      // Generate on the fly
      try {
        pdfPath = await generateInvoicePdf(inv)
        setInvoicePdfPath(company_id, invoice_id, pdfPath)
        exists = true
      } catch (genErr) {
        console.error('[invoice] generation failed:', genErr)
        return res.status(500).json({ error: 'Failed to generate invoice PDF' })
      }
    }

    if (exists) {
      res.download(pdfPath, `${invoice_id}.pdf`)
    } else {
      res.status(404).json({ error: 'Invoice PDF not available' })
    }
  } catch (e) {
    console.error('[invoice] download error:', e)
    res.status(500).json({ error: 'Failed to download invoice' })
  }
})

// ---- Company Profile (Admin only) ----
app.get('/api/company/profile', requireRole(['company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const c = getCompanyById(company_id)
    if (!c) return res.status(404).json({ error: 'Company not found' })
    res.json({
      id: c.id,
      name: c.name,
      logo_url: c.logo_url || '',
      billing_email: c.billing_email || '',
      billing_address: c.billing_address || '',
      subscription_plan: c.plan || 'free',
      credit_balance: c.credits || 0,
      admin_contact_email: c.admin_contact_email || '',
      created_at: c.created_at,
      updated_at: c.updated_at || c.created_at
    })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load company profile' })
  }
})

// Accept multipart for logo; and JSON fields for name/emails
const logoUpload = upload.single('logo')
app.put('/api/company/profile', requireRole(['company_admin']), (req, res, next) => logoUpload(req, res, next), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const { name, billing_email, admin_contact_email } = req.body || {}
    let logo_url = null
    if (req.file) {
      const mime = req.file.mimetype || ''
      const ok = ['image/png','image/jpeg','image/webp'].includes(mime)
      if (!ok) return res.status(400).json({ error: 'Invalid logo file type' })
      logo_url = `/uploads/${req.file.filename}`
    }
    const updated = updateCompanyProfile(company_id, { name, logo_url, billing_email, admin_contact_email })
    appendAudit('company_profile_updated', { actorId: req.user?.uid || req.user?.sub, company_id, changes: { name, billing_email, admin_contact_email, logo: !!logo_url } }, company_id)
    res.json({ ok: true, company: updated })
  } catch (e) {
    res.status(500).json({ error: 'Failed to update company profile' })
  }
})

// Company brand (name/logo) for all roles, scoped by company_id
app.get('/api/company/brand', requireRole(['company_admin','manager','employee']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const c = getCompanyById(company_id)
    if (!c) return res.status(404).json({ error: 'Company not found' })
    res.json({ name: c.name, logo_url: c.logo_url || '' })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load brand' })
  }
})
// Stripe: Create Checkout Session
app.post('/api/billing/stripe/checkout-session', requireRole(['company_admin']), async (req, res) => {
  try {
    if (PAYMENT_PROVIDER !== 'stripe') return res.status(503).json({ error: 'Stripe disabled' });
    const { amount_usd, return_path } = req.body || {};
    const amount = Number(amount_usd);
    if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const company_id = req.user?.company_id;
    const user_id = req.user?.uid;
    const url = await createStripeCheckoutSession({ company_id, user_id, creditAmount: amount, origin: req.headers.origin, return_path });
    return res.json({ url });
  } catch (e) {
    console.error('[stripe:checkout-session] error:', e);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.post('/api/billing/stripe/confirm-session', requireRole(['company_admin']), async (req, res) => {
  try {
    if (PAYMENT_PROVIDER !== 'stripe') return res.status(503).json({ error: 'Stripe disabled' });
    
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const company_id = req.user?.company_id;
    if (!company_id) return res.status(403).json({ error: 'Invalid company' });

    // Retrieve session from Stripe to verify payment
    const session = await retrieveCheckoutSession(session_id);
    
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed', payment_status: session.payment_status });
    }

    const meta = session?.metadata || {};
    const metaCompanyId = Number(meta.companyId || meta.company_id || '');
    
    // Verify session belongs to this company
    if (metaCompanyId !== company_id) {
      return res.status(403).json({ error: 'Session does not belong to your company' });
    }

    const credits = Number(meta.creditAmount || meta.credits || '');
    if (!Number.isInteger(credits) || credits <= 0) {
      return res.status(400).json({ error: 'Invalid credit amount in session metadata' });
    }

    const amount_usd = Number(session.amount_total || 0) ? (Number(session.amount_total) / 100) : credits;
    const user_id = Number(meta.userId || meta.user_id || '');
    const reference_id = `stripe:${session_id}`;

    // Check if already applied (by webhook or previous confirm)
    const exists = getTransactionByReferenceId(company_id, reference_id);
    if (exists) {
      const company = getCompanyById(company_id);
      return res.json({ ok: true, already_applied: true, credits: company?.credits || 0 });
    }

    // Apply credits
    const result = applyStripeCheckoutCreditsOnce({
      company_id,
      user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : null,
      session_id,
      amount_usd,
      credits,
      reference_id
    });

    const newBalance = Number(result?.credits || 0);
    console.log('[stripe:confirm-session] credits applied', { company_id, session_id, credits, amount_usd, balance: newBalance });

    // Emit real-time update
    try {
      io.to(`company:${company_id}`).emit('company:credits_updated', { company_id, balance: newBalance });
    } catch {}

    // Generate invoice async
    setImmediate(async () => {
      try {
        const company = getCompanyById(company_id);
        const nextNo = getNextInvoiceNo(company_id);
        const invId = `INV-${company_id}-${String(nextNo).padStart(5, '0')}`;
        const invoice = createInvoice({
          company_id,
          invoice_no: nextNo,
          invoice_id: invId,
          company_name: company?.name || '',
          company_logo_url: company?.logo_url || '',
          billing_email: company?.billing_email || '',
          invoice_date: new Date().toISOString(),
          billing_period: 'one-time credit purchase',
          line_items: [{ description: `Credit Purchase – ${credits} Credits`, quantity: credits, unit_price: 1, subtotal: credits }],
          subtotal_amount: credits,
          tax_amount: 0,
          total_amount: credits,
          currency: 'USD',
          payment_provider: 'Stripe',
          payment_reference_id: reference_id,
          payment_status: 'paid'
        });
        try {
          const pdfPath = await generateInvoicePdf(invoice);
          setInvoicePdfPath(company_id, invId, pdfPath);
          appendAudit('invoice_generated', { company_id, invoice_id: invId }, company_id);
        } catch (e) {
          console.warn('[invoice] pdf generate failed:', e?.message || e);
        }
        try {
          const comp = getCompanyById(company_id) || company || { id: company_id };
          const to = getCompanyAdminEmail(company_id, comp);
          if (to) sendPaymentSuccess({ to, company: comp, amount_usd, credits, balance: newBalance, invoice_id: invId, payment_reference_id: reference_id });
        } catch {}
      } catch (e) {
        console.warn('[stripe:confirm-session] post-processing failed:', e?.message || e);
      }
    });

    return res.json({ ok: true, already_applied: false, credits: newBalance });
  } catch (e) {
    console.error('[stripe:confirm-session] error:', e);
    return res.status(500).json({ error: 'Failed to confirm session', details: String(e?.message || e) });
  }
})

// Emergency fallback endpoint for manual credit application when Stripe API fails
app.post('/api/billing/credits/apply-manual', requireRole(['super_admin']), async (req, res) => {
  try {
    if (String(process.env.ALLOW_MANUAL_CREDITS || '').trim() !== '1') {
      return res.status(410).json({ error: 'deprecated', message: 'Manual credit application is disabled.' })
    }
    const { session_id, credits, amount_usd } = req.body
    if (!session_id || !credits || !amount_usd) {
      return res.status(400).json({ error: 'session_id, credits, and amount_usd are required' })
    }
    
    const company_id = Number(req.user?.company_id)
    if (!company_id) return res.status(403).json({ error: 'Invalid company' })
    
    const reference_id = `stripe:${session_id}`
    const exists = getTransactionByReferenceId(company_id, reference_id)
    if (exists) {
      const company = getCompanyById(company_id)
      return res.json({ ok: true, already_applied: true, credits: company?.credits || 0 })
    }
    
    // Apply credits manually without Stripe API call
    const newBalance = creditCompanyWithTransaction({
      company_id,
      amount_usd: Number(amount_usd),
      credits: Number(credits),
      description: 'Manual credit application (Stripe API fallback)',
      reference_id
    })
    
    console.log('[billing:manual] credits applied manually', { company_id, credits, amount_usd, newBalance })
    return res.json({ ok: true, already_applied: false, credits: newBalance })
    
  } catch (e) {
    console.error('[billing:manual] error:', e)
    return res.status(500).json({ error: 'Failed to apply credits manually', details: String(e?.message || e) })
  }
})

// Resolve pending credits — finds any paid Stripe sessions not yet processed
app.post('/api/billing/stripe/resolve-pending', requireRole(['company_admin']), async (req, res) => {
  try {
    if (PAYMENT_PROVIDER !== 'stripe') return res.status(503).json({ error: 'Stripe disabled' });
    const company_id = req.user?.company_id;
    if (!company_id) return res.status(403).json({ error: 'Invalid company' });

    const sessions = await listRecentCheckoutSessions({ company_id, limit: 20 });
    if (!sessions.length) return res.json({ ok: true, resolved: 0, message: 'No recent Stripe sessions found' });

    let resolved = 0;
    let lastBalance = 0;

    for (const session of sessions) {
      const sessionId = String(session.id || '').trim();
      if (!sessionId) continue;
      if (session.payment_status !== 'paid') continue;

      const meta = session.metadata || {};
      const credits = Number(meta.creditAmount || meta.credits || '');
      if (!Number.isInteger(credits) || credits <= 0) continue;

      const reference_id = `stripe:${sessionId}`;
      const exists = getTransactionByReferenceId(company_id, reference_id);
      if (exists) {
        lastBalance = Number(exists.credits || 0);
        continue;
      }

      const amount_usd = Number(session.amount_total || 0) ? (Number(session.amount_total) / 100) : credits;
      const user_id = Number(meta.userId || meta.user_id || '');

      try {
        const result = applyStripeCheckoutCreditsOnce({
          company_id,
          user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : null,
          session_id: sessionId,
          amount_usd,
          credits,
          reference_id
        });
        if (result?.applied) {
          resolved++;
          lastBalance = Number(result?.credits || 0);
          console.log('[stripe:resolve-pending] applied credits', { company_id, session_id: sessionId, credits, balance: lastBalance });
        }
      } catch (e) {
        console.warn('[stripe:resolve-pending] failed for session', { session_id: sessionId, error: String(e?.message || e) });
      }
    }

    if (resolved > 0) {
      try {
        io.to(`company:${company_id}`).emit('company:credits_updated', { company_id, balance: lastBalance });
      } catch {}
    }

    return res.json({ ok: true, resolved, balance: lastBalance, message: resolved > 0 ? `Applied ${resolved} pending credit purchase(s)` : 'No pending credits found' });
  } catch (e) {
    console.error('[stripe:resolve-pending] error:', e);
    return res.status(500).json({ error: 'Failed to resolve pending credits', details: String(e?.message || e) });
  }
});

// Stripe Webhook (raw body needed)
async function stripeWebhookHandler(req, res) {
  if (PAYMENT_PROVIDER !== 'stripe') return res.status(503).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''))

  let event
  try {
    event = verifyStripeWebhookAndExtract(rawBody, sig)
  } catch (e) {
    console.warn('[stripe:webhook] verify failed:', e?.message || e)
    return res.status(400).end()
  }

  const type = String(event?.type || '')
  const eventId = String(event?.id || '')
  console.log('[stripe:webhook] received', { id: eventId, type })

  if (type !== 'checkout.session.completed' && type !== 'checkout.session.async_payment_succeeded') {
    return res.status(200).end()
  }

  const session = event.data.object
  const meta = session?.metadata || {}

  const paymentStatus = String(session?.payment_status || '')
  if (paymentStatus !== 'paid') {
    console.log('[stripe:webhook] ignoring unpaid session', { eventId, payment_status: paymentStatus, session_id: session?.id })
    return res.status(200).end()
  }

  const company_id = Number(meta.companyId || meta.company_id || '')
  const user_id = Number(meta.userId || meta.user_id || '')
  const credits = Number(meta.creditAmount || meta.credits || meta.credit_amount || '')
  const sessionId = String(session?.id || '').trim()

  if (!sessionId || !Number.isInteger(company_id) || company_id <= 0 || !Number.isInteger(credits) || credits <= 0) {
    console.warn('[stripe:webhook] invalid metadata', { eventId, sessionId, company_id, user_id, credits, meta })
    return res.status(200).end()
  }

  const amount_usd = Number(session.amount_total || 0) ? (Number(session.amount_total) / 100) : Number(credits)
  const reference_id = `stripe:${sessionId}`

  let applied
  let newBalance
  try {
    const result = applyStripeCheckoutCreditsOnce({ company_id, user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : null, session_id: sessionId, amount_usd, credits, reference_id })
    applied = !!result?.applied
    newBalance = Number(result?.credits)
  } catch (e) {
    console.error('[stripe:webhook] credit apply failed', { eventId, sessionId, company_id, error: String(e?.message || e) })
    return res.status(500).end()
  }

  markWebhookEventProcessed({ provider: 'stripe', event_id: eventId, company_id, reference_id: sessionId })

  if (!applied) {
    console.log('[stripe:webhook] already processed', { eventId, sessionId, company_id, credits, balance: newBalance })
    return res.status(200).end()
  }

  console.log('[stripe:webhook] credits added', { eventId, sessionId, company_id, credits, amount_usd, balance: newBalance })

  res.status(200).end()

  setImmediate(async () => {
    try {
      const company = getCompanyById(company_id)
      const nextNo = getNextInvoiceNo(company_id)
      const invId = `INV-${company_id}-${String(nextNo).padStart(5, '0')}`
      const invoice = createInvoice({
        company_id,
        invoice_no: nextNo,
        invoice_id: invId,
        company_name: company?.name || '',
        company_logo_url: company?.logo_url || '',
        billing_email: company?.billing_email || '',
        invoice_date: new Date().toISOString(),
        billing_period: 'one-time credit purchase',
        line_items: [{ description: `Credit Purchase – ${credits} Credits`, quantity: credits, unit_price: 1, subtotal: credits }],
        subtotal_amount: credits,
        tax_amount: 0,
        total_amount: credits,
        currency: 'USD',
        payment_provider: 'Stripe',
        payment_reference_id: reference_id,
        payment_status: 'paid'
      })

      try {
        const pdfPath = await generateInvoicePdf(invoice)
        setInvoicePdfPath(company_id, invId, pdfPath)
        appendAudit('invoice_generated', { company_id, invoice_id: invId }, company_id)
      } catch (e) {
        console.warn('[invoice] pdf generate failed:', e?.message || e)
      }

      try {
        const comp = getCompanyById(company_id) || company || { id: company_id }
        const to = getCompanyAdminEmail(company_id, comp)
        if (to) sendPaymentSuccess({ to, company: comp, amount_usd, credits, balance: newBalance, invoice_id: invId, payment_reference_id: reference_id })
      } catch {}

      try {
        io.to(`company:${company_id}`).emit('company:credits_updated', { company_id, balance: newBalance })
      } catch {}
    } catch (e) {
      console.warn('[stripe:webhook] post-processing failed', { eventId, sessionId, company_id, error: String(e?.message || e) })
    }
  })

  return
}

// ---- Screen capture interval configuration ----
const allowedSeconds = [
  5,
  15,
  30,
  60,
  120,
  180,
  240,
  300,
  360,
  480,
  600,
  720,
  900,
  1200,
];
app.get('/api/capture-interval', requireRole(['employee', 'manager', 'company_admin']), (req, res) => {
  try {
    const intervals = JSON.parse(fs.readFileSync(intervalsFile, 'utf-8'));
    const requesterRole = req.user?.role;
    const company_id = req.user?.company_id;
    let targetId = (requesterRole === 'employee') ? req.user?.sub : (req.query.employeeId || req.user?.sub);
    
    // Validate targetId belongs to company
    const allUsers = readUsers();
    const targetUser = allUsers.find(u => u.email === targetId);
    if (!targetUser || targetUser.company_id != company_id) {
       // If target user not found in company list, deny access (unless it's self, but self should exist)
       // Exception: if targetId is self (e.g. super_admin checking self?)
       if (targetId !== req.user?.sub) {
         return res.status(404).json({ error: 'Employee not found in company' });
       }
    }

    if (requesterRole === 'manager' && targetId) {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id);
      if (!teamEmails.includes(targetId)) return res.status(403).json({ error: 'Forbidden: not your team' });
    }
    const secs = intervals[targetId];
    if (!secs) return res.json({ assigned: false, intervalSeconds: null });
    res.json({ assigned: true, intervalSeconds: secs });
  } catch (e) {
    console.error('[interval:get] error:', e);
    res.status(500).json({ error: 'Failed to read interval' });
  }
});

app.post('/api/capture-interval', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const { employeeId, intervalMinutes, intervalSeconds } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

    const secs = (() => {
      if (intervalSeconds != null && intervalSeconds !== '') {
        return Number(intervalSeconds)
      }
      if (intervalMinutes != null && intervalMinutes !== '') {
        return Number(intervalMinutes) * 60
      }
      return NaN
    })()

    if (!Number.isFinite(secs) || secs <= 0) {
      return res.status(400).json({ error: 'intervalSeconds must be a positive number' })
    }
    if (!allowedSeconds.includes(secs)) {
      return res.status(400).json({ error: `intervalSeconds must be one of ${allowedSeconds.join(', ')}` })
    }
    
    const company_id = req.user?.company_id;
    const allUsers = readUsers();
    const targetUser = allUsers.find(u => u.email === employeeId);
    if (!targetUser || targetUser.company_id != company_id) {
      return res.status(404).json({ error: 'Employee not found in company' });
    }

    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub);
      if (!teamEmails.includes(employeeId)) return res.status(403).json({ error: 'Forbidden: not your team' });
    }
  const intervals = JSON.parse(fs.readFileSync(intervalsFile, 'utf-8'));
  const oldSecs = intervals[employeeId] || null
  intervals[employeeId] = secs;
  fs.writeFileSync(intervalsFile, JSON.stringify(intervals, null, 2));
  // Audit
  appendAudit('interval_set', { actorId: req.user?.uid || req.user?.sub, employeeId, oldIntervalSeconds: oldSecs, intervalSeconds: secs }, company_id);
  // Notify the employee in real-time via Socket.IO so their desktop reflects and starts tracking
  try {
    io.to(userRoom(employeeId)).emit('interval:assigned', { employeeId, intervalSeconds: secs });
  } catch (emitErr) {
    console.warn('[interval:set] emit failed:', emitErr?.message || emitErr);
    }
    res.json({ ok: true, employeeId, intervalSeconds: secs });
  } catch (e) {
    console.error('[interval:set] error:', e);
    res.status(500).json({ error: 'Failed to save interval' });
  }
});

app.get('/api/capture-intervals', requireRole(['manager','company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id
    const intervals = JSON.parse(fs.readFileSync(intervalsFile, 'utf-8'))
    const allUsers = readUsers().filter(u => u.company_id == company_id && u.role === 'employee')
    let list = allUsers.map(u => ({ email: u.email, name: u.name || '', intervalSeconds: intervals[u.email] || null }))
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id)
      list = list.filter(r => teamEmails.includes(r.email))
    }
    res.json({ intervals: list })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load intervals' })
  }
})

// ---- Work Hours Tracking ----
function readSessions(){
  try { return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8')); } catch { return []; }
}
function writeSessions(arr){
  fs.writeFileSync(sessionsFile, JSON.stringify(arr, null, 2));
}
function todayStr(){ return new Date().toISOString().slice(0,10); }

// ---- Employee Self-Service APIs ----
// Personal dashboard summary
app.get('/api/employee/dashboard-summary', requireRole(['employee']), (req, res) => {
  try {
    const email = req.user?.sub;
    const company_id = req.user?.company_id;
    const sessions = readSessions().filter(s => s.employeeId === email && s.company_id == company_id);
    const approvedManual = getTimeRequests(company_id, req.user?.uid).filter(r => r.status === 'approved' && r.employee_id == req.user?.uid);
    const userTimezone = getEmployeeTimezone(email, company_id) || req.user?.timezone || 'UTC'

    const nowMs = Date.now()
    const todayKey = localDateKey(nowMs, userTimezone)
    const keysBack = (days) => {
      const set = new Set()
      for (let i = 0; i < days; i += 1) {
        set.add(localDateKey(nowMs - i * 24 * 60 * 60 * 1000, userTimezone))
      }
      return set
    }
    const weekKeys = keysBack(7)
    const monthKeys = keysBack(30)

    const calcSeconds = (arr) => arr.reduce((sum, s) => {
      const startMs = new Date(s.startedAt).getTime();
      const endMs = s.endedAt ? new Date(s.endedAt).getTime() : nowMs;
      const active = Math.max(0, Math.floor((endMs - startMs)/1000));
      const idle = s.idleSeconds || 0;
      return sum + Math.max(0, active - idle);
    }, 0);

    const daySeconds = calcSeconds(sessions.filter(s => {
      const st = Date.parse(s.startedAt)
      return localDateKey(st, userTimezone) === todayKey
    }))
    const weekSeconds = calcSeconds(sessions.filter(s => {
      const st = Date.parse(s.startedAt)
      return weekKeys.has(localDateKey(st, userTimezone))
    }))
    const monthSeconds = calcSeconds(sessions.filter(s => {
      const st = Date.parse(s.startedAt)
      return monthKeys.has(localDateKey(st, userTimezone))
    }))

    const manualSeconds = approvedManual.reduce((sum, r) => {
      const tz = String(r.timezone || userTimezone || 'UTC').trim() || 'UTC'
      const startUtc = r.start_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.start_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const endUtc = r.end_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.end_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      if (!startUtc || !endUtc) return sum
      const st = Date.parse(startUtc)
      const en = Date.parse(endUtc)
      const dur = Math.max(0, Math.floor((en - st) / 1000))
      if (weekKeys.has(localDateKey(st, tz)) || monthKeys.has(localDateKey(st, tz)) || localDateKey(st, tz) === todayKey) {
        return sum + dur
      }
      return sum
    }, 0);

    const toHours = (secs) => Number((secs/3600).toFixed(1));
    const daily_hours = toHours(daySeconds);
    const weekly_hours = toHours(weekSeconds);
    const monthly_hours = toHours(monthSeconds);

    const recent_sessions = sessions.slice().sort((a,b)=> (a.startedAt < b.startedAt?1:-1)).slice(0,5).map(s => {
      const startMs = new Date(s.startedAt).getTime();
      const endMs = s.endedAt ? new Date(s.endedAt).getTime() : nowMs;
      const active = Math.max(0, Math.floor((endMs - startMs)/1000));
      const idle = s.idleSeconds || 0;
      const ratio = active ? (1 - Math.min(idle/active, 1)) : 0;
      const status = ratio >= 0.8 ? 'productive' : ratio >= 0.6 ? 'neutral' : 'unproductive';
      return { start_time_utc: s.startedAt, end_time_utc: s.endedAt, start_time_local: formatLocalDateTime(startMs, userTimezone, { withSeconds: true }), end_time_local: s.endedAt ? formatLocalDateTime(Date.parse(s.endedAt), userTimezone, { withSeconds: true }) : null, duration: active, idle_time: idle, productivity_status: status, timezone: userTimezone };
    });

    // Build approved/rejected requests with duration info
    const formatRequest = (r) => {
      const tz = String(r.timezone || userTimezone || 'UTC').trim() || 'UTC'
      const startUtc = r.start_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.start_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const endUtc = r.end_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.end_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const duration = (startUtc && endUtc) ? Math.max(0, Math.floor((Date.parse(endUtc) - Date.parse(startUtc)) / 1000)) : 0
      return { id: r.id, date: r.date, start_time: r.start_time, end_time: r.end_time, reason: r.reason, status: r.status, duration, timezone: tz, start_utc: startUtc, end_utc: endUtc, created_at: r.created_at, action_at: r.action_at }
    }

    const approved_requests = approvedManual.map(formatRequest)
    const allRequests = getTimeRequests(company_id, req.user?.uid) || []
    const rejected_requests = allRequests.filter(r => r.status === 'rejected').map(formatRequest)

    res.json({ daily_hours, weekly_hours, monthly_hours, approved_requests, rejected_requests, recent_sessions, timezone: userTimezone });
  } catch (e) {
    console.error('[employee:summary] error:', e);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// Activity timeline
app.get('/api/employee/activity-timeline', requireRole(['employee']), (req, res) => {
  try {
    const email = req.user?.sub;
    const company_id = req.user?.company_id;
    const { start_date, end_date, type } = req.query || {};
    const sessions = readSessions().filter(s => s.employeeId === email && s.company_id == company_id);
    const userTimezone = getEmployeeTimezone(email, company_id) || req.user?.timezone || 'UTC'
    const startMs = start_date ? parseLocalDateTimeToUtcMs(start_date, '00:00:00', userTimezone) : null;
    const endMs = end_date ? parseLocalDateTimeToUtcMs(end_date, '23:59:59', userTimezone) : null;
    const inRange = sessions.filter(s => {
      const t = new Date(s.startedAt).getTime();
      if (startMs && t < startMs) return false;
      if (endMs && t > endMs) return false;
      return true;
    });
    let activities = inRange.map(s => {
      const st = new Date(s.startedAt).getTime();
      const en = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const active = Math.max(0, Math.floor((en - st)/1000));
      const idle = s.idleSeconds || 0;
      const ratio = active ? (1 - Math.min(idle/active, 1)) : 0;
      const status = ratio >= 0.8 ? 'productive' : ratio >= 0.6 ? 'neutral' : 'unproductive';
      return { id: s.id, type: 'tracked_session', start_time: s.startedAt, end_time: s.endedAt, start_time_local: formatLocalDateTime(st, userTimezone, { withSeconds: true }), end_time_local: s.endedAt ? formatLocalDateTime(Date.parse(s.endedAt), userTimezone, { withSeconds: true }) : null, duration: active, idle_time: idle, productivity_status: status, applications: [], screenshots: 0, manual_entry: null, timezone: userTimezone };
    });

    const requests = getTimeRequests(company_id, req.user?.uid);
    const manualAct = requests.map(r => {
      const tz = String(r.timezone || userTimezone || 'UTC').trim() || 'UTC'
      const startUtc = r.start_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.start_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const endUtc = r.end_utc || (() => {
        const ms = parseLocalDateTimeToUtcMs(r.date, r.end_time, tz)
        return ms == null ? null : toIsoZ(ms)
      })()
      const st = startUtc ? Date.parse(startUtc) : null
      const en = endUtc ? Date.parse(endUtc) : null
      const duration = (st != null && en != null) ? Math.max(0, Math.floor((en - st) / 1000)) : 0
      return {
        id: `manual_${r.id}`,
        type: 'manual_entry',
        start_time: startUtc,
        end_time: endUtc,
        start_time_local: st != null ? formatLocalDateTime(st, tz, { withSeconds: true }) : null,
        end_time_local: en != null ? formatLocalDateTime(en, tz, { withSeconds: true }) : null,
        duration,
        idle_time: 0,
        productivity_status: r.status === 'approved' ? 'productive' : (r.status === 'rejected' ? 'unproductive' : 'neutral'),
        manual_entry: { description: r.reason || '', status: r.status },
        applications: [],
        screenshots: 0,
        timezone: tz
      }
    });

    activities = activities.concat(manualAct).sort((a,b)=> (a.start_time < b.start_time ? 1 : -1));
    if (type && type !== 'all') activities = activities.filter(a => a.type === type);
    res.json({ activities, timezone: userTimezone });
  } catch (e) {
    console.error('[employee:activity] error:', e);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// Profile read/update (timezone & full_name)
app.get('/api/employee/profile', requireRole(['employee']), (req, res) => {
  try {
    const email = req.user?.sub;
    const allUsers = readUsers();
    const u = allUsers.find(x => x.email === email) || {};
    // Also fetch from SQLite to get full_name if not in JSON
    const dbUser = getUserByEmail(email);
    
    const company = getCompanyById(req.user?.company_id);
    res.json({ 
      id: u?.id || req.user?.uid, 
      email, 
      full_name: dbUser?.full_name || u?.name || '', 
      country: dbUser?.country || u?.country || '', 
      role: 'employee', 
      timezone: u?.timezone || dbUser?.timezone || 'UTC', 
      company_name: company?.name || '' 
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.put('/api/employee/profile', requireRole(['employee']), (req, res) => {
  try {
    const email = req.user?.sub;
    const { timezone, full_name, country } = req.body || {};
    
    // Update JSON users file inplace
    const users = readUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx >= 0) {
      if (timezone) users[idx].timezone = timezone;
      if (full_name) users[idx].name = full_name; // Legacy JSON uses 'name'
      if (country) users[idx].country = country;
      writeUsers(users);
    }
    
    // Update SQLite
    const dbUser = getUserByEmail(email);
    if (dbUser) {
      updateUserProfile(dbUser.id, { full_name, email, country, timezone });
      if (timezone) {
        updateUserTimezone(email, timezone);
      }
    }

    const company = getCompanyById(req.user?.company_id);
    res.json({ 
      id: users[idx]?.id || req.user?.uid, 
      email, 
      full_name: full_name || dbUser?.full_name || '',
      country: country || dbUser?.country || '',
      role: 'employee', 
      timezone: timezone || 'UTC', 
      company_name: company?.name || '' 
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Employee Change Password
app.post('/api/employee/change-password', requireRole(['employee']), (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    const email = req.user?.sub;
    const company_id = req.user?.company_id;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const user = getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!verifyPassword(user, current_password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    upsertEmployeePassword(email, new_password, company_id);

    // Update existing password row so manager sees one entry, not duplicates
    try {
      updateEmployeeTempPassword(company_id, email, new_password);
    } catch {}

    // Emit socket event so manager/admin knows password changed
    try {
      io.to(`company:${company_id}`).emit('employee:password_changed', { email, company_id, new_password });
    } catch {}

    console.log('[employee:change-password] password changed for', email);
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (e) {
    console.error('[employee:change-password] error:', e);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Generic Profile Update for all roles (Manager/Admin)
app.get('/api/user/profile', requireRole(['manager', 'super_admin']), (req, res) => {
  try {
    const email = req.user?.sub;
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const company = getCompanyById(user.company_id);
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      country: user.country || '',
      role: user.role,
      timezone: user.timezone || 'UTC',
      company_name: company?.name || ''
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.put('/api/user/profile', requireRole(['manager', 'super_admin']), (req, res) => {
  try {
    const email = req.user?.sub;
    const { full_name, timezone, country } = req.body || {};
    const user = getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (full_name) {
      updateUserProfile(user.id, { full_name, country, timezone });
    }
    // Update timezone if needed (not yet in updateUserProfile)
    if (timezone) updateUserTimezone(email, timezone);
    
    res.json({ ok: true, full_name, country, timezone });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Reports listing
app.get('/api/employee/reports', requireRole(['employee']), (req, res) => {
  try {
    const email = req.user?.sub;
    const company_id = req.user?.company_id
    const tz = getEmployeeTimezone(email, company_id) || req.user?.timezone || 'UTC'
    const idxFile = path.join(dataPath, 'reports.index.json');
    let index = [];
    try { index = JSON.parse(fs.readFileSync(idxFile, 'utf-8')); } catch { index = []; }
    const mine = index.filter(r => r.email === email).sort((a,b)=> (a.created_at < b.created_at ? 1 : -1));
    const out = mine.map(r => {
      const ms = r?.created_at ? Date.parse(r.created_at) : null
      return { ...r, timezone: tz, created_at_local: ms ? formatLocalDateTime(ms, tz, { withSeconds: true }) : null }
    })
    res.json({ reports: out });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

// Report download with auth + proper Content-Disposition
app.get('/api/employee/reports/:filename/download', requireRole(['employee']), async (req, res) => {
  try {
    // Support both JWT header (from middleware) and query param fallback
    let email = req.user?.sub
    if (!email && req.query?.token) {
      try {
        const payload = jwt.verify(String(req.query.token), JWT_SECRET)
        email = payload?.sub || payload?.email
      } catch {}
    }
    if (!email) return res.status(401).json({ error: 'Unauthorized' })
    const fname = String(req.params.filename || '').replace(/\.\./g, '').replace(/[\/\\]/g, '')
    if (!fname) return res.status(400).json({ error: 'Invalid filename' })
    const filePath = path.join(publicReportsPath, fname)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
    // Verify the file belongs to this user via reports index
    const idxFile = path.join(dataPath, 'reports.index.json')
    let index = []
    try { index = JSON.parse(fs.readFileSync(idxFile, 'utf-8')) } catch {}
    const match = index.find(r => r.email === email && r.download_url && r.download_url.includes(fname))
    if (!match) return res.status(403).json({ error: 'Forbidden' })
    const contentType = fname.endsWith('.pdf') ? 'application/pdf' : 'text/csv'
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
    res.setHeader('Content-Type', contentType)
    res.sendFile(filePath)
  } catch (e) {
    res.status(500).json({ error: 'Download failed' })
  }
});

// Report generation (CSV)
app.post('/api/employee/generate-report', requireRole(['employee']), (req, res) => {
  try {
    const { report_type, start_date, end_date, format } = req.body || {};
    const email = req.user?.sub;
    const company_id = req.user?.company_id;
    const tz = getEmployeeTimezone(email, company_id) || req.user?.timezone || 'UTC'
    const sessions = readSessions().filter(s => s.employeeId === email && s.company_id == company_id);
    const startMs = start_date ? parseLocalDateTimeToUtcMs(start_date, '00:00:00', tz) : null;
    const endMs = end_date ? parseLocalDateTimeToUtcMs(end_date, '23:59:59', tz) : null;
    const inRange = sessions.filter(s => {
      const t = new Date(s.startedAt).getTime();
      if (startMs && t < startMs) return false;
      if (endMs && t > endMs) return false;
      return true;
    });

    const rows = [['StartLocal','EndLocal','StartUTC','EndUTC','Timezone','DurationSeconds','IdleSeconds','NetActiveSeconds']];
    for (const s of inRange) {
      const st = new Date(s.startedAt).getTime();
      const en = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const active = Math.max(0, Math.floor((en - st)/1000));
      const idle = s.idleSeconds || 0;
      const net = Math.max(0, active - idle);
      rows.push([
        formatLocalDateTime(st, tz, { withSeconds: true }),
        s.endedAt ? formatLocalDateTime(Date.parse(s.endedAt), tz, { withSeconds: true }) : '',
        s.startedAt,
        s.endedAt || '',
        tz,
        String(active),
        String(idle),
        String(net)
      ]);
    }

    const fname = `employee_${email.replace(/[^a-zA-Z0-9]/g,'_')}_${Date.now()}.csv`;
    const outPath = path.join(publicReportsPath, fname);
    const csv = rows.map(r => r.join(',')).join('\n');
    fs.writeFileSync(outPath, csv);
    const file_size = fs.statSync(outPath).size;

    const idxFile = path.join(dataPath, 'reports.index.json');
    let index = [];
    try { index = JSON.parse(fs.readFileSync(idxFile, 'utf-8')); } catch { index = []; }
    const record = {
      report_type: report_type || 'detailed_activity',
      start_date: start_date || '',
      end_date: end_date || '',
      format: 'csv',
      download_url: `${req.protocol}://${req.get('host')}/reports/${fname}`,
    created_at: new Date().toISOString(),
      file_size,
    email,
    timezone: tz,
    created_at_local: formatLocalDateTime(Date.now(), tz, { withSeconds: true })
    };
    index.push(record);
    fs.writeFileSync(idxFile, JSON.stringify(index, null, 2));
    res.json(record);
  } catch (e) {
    console.error('[employee:generate_report] error:', e);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Employee starts a work session
app.post('/api/work/start', requireRole(['employee']), (req, res) => {
  try {
    const employeeId = req.user?.sub;
    const company_id = req.user?.company_id;
    const sessions = readSessions();
    // If an active session exists, return it
    const active = sessions.find(s => s.employeeId === employeeId && s.isActive);
    if (active) return res.json({ ok: true, session: active });
    const now = new Date().toISOString();
    const record = { id: `${employeeId}-${Date.now()}`, employeeId, company_id, startedAt: now, endedAt: null, isActive: true, idleSeconds: 0, lastHeartbeatAt: now, date: todayStr() };
    sessions.push(record);
    writeSessions(sessions);
    try { io.to(`company:${company_id}`).emit('work:updated', { employeeId, company_id, event: 'start' }) } catch {}
    res.status(201).json({ ok: true, session: record });
  } catch (e) {
    console.error('[work:start] error:', e);
    res.status(500).json({ error: 'Failed to start work session' });
  }
});

// Employee heartbeat with idle delta seconds
app.post('/api/work/heartbeat', requireRole(['employee']), (req, res) => {
  try {
    const employeeId = req.user?.sub;
    const { idleDeltaSeconds = 0 } = req.body || {};
    const sessions = readSessions();
    const active = sessions.find(s => s.employeeId === employeeId && s.isActive);
    if (!active) return res.status(404).json({ error: 'No active session' });
    const delta = Math.max(0, Number(idleDeltaSeconds) || 0);
    active.idleSeconds = (active.idleSeconds || 0) + delta;
    active.lastHeartbeatAt = new Date().toISOString();
    writeSessions(sessions);
    res.json({ ok: true, idleSeconds: active.idleSeconds });
  } catch (e) {
    console.error('[work:heartbeat] error:', e);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// Employee stops the work session
app.post('/api/work/stop', requireRole(['employee']), (req, res) => {
  try {
    const employeeId = req.user?.sub;
    const sessions = readSessions();
    const active = sessions.find(s => s.employeeId === employeeId && s.isActive);
    if (!active) return res.status(404).json({ error: 'No active session' });
    active.endedAt = new Date().toISOString();
    active.isActive = false;
    writeSessions(sessions);
    // Terminate any ongoing live streams for this employee
    try {
      liveStreamOn.set(employeeId, false);
      io.to(viewersRoom(employeeId)).emit('live_view:terminate', { by: employeeId, reason: 'work_stop' });
    } catch {}
    try { io.to(`company:${req.user?.company_id}`).emit('work:updated', { employeeId, company_id: req.user?.company_id, event: 'stop' }) } catch {}
    res.json({ ok: true, session: active });
  } catch (e) {
    console.error('[work:stop] error:', e);
    res.status(500).json({ error: 'Failed to stop work session' });
  }
});

// Manager summary: today per employee
app.get('/api/work/summary/today', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const sessions = readSessions();
    
    // Filter by company
    const company_id = req.user?.company_id;
    const allUsers = readUsers();
    const companyUserEmails = new Set(allUsers.filter(u => u.company_id == company_id).map(u => u.email));
    const companySessions = sessions.filter(s => companyUserEmails.has(s.employeeId));

    const nowMs = Date.now()
    const tzByEmail = {}
    const todayKeyByEmail = {}
    for (const email of companyUserEmails) {
      const tz = getEmployeeTimezone(email, company_id) || 'UTC'
      tzByEmail[email] = tz
      todayKeyByEmail[email] = localDateKey(nowMs, tz)
    }

    const byEmp = {};
    for (const s of companySessions) {
      const k = s.employeeId;
      const tz = tzByEmail[k] || 'UTC'
      const st = Date.parse(s.startedAt)
      if (!st) continue
      if (localDateKey(st, tz) !== todayKeyByEmail[k]) continue
      if (!byEmp[k]) byEmp[k] = [];
      byEmp[k].push(s);
    }
    let entries = Object.entries(byEmp);
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, req.user?.company_id);
      entries = entries.filter(([employeeId]) => teamEmails.includes(employeeId));
    }
    const result = entries.map(([employeeId, arr]) => {
      // Active duration sums across sessions
      let totalActiveSeconds = 0;
      let totalIdleSeconds = 0;
      let loginTimes = [];
      let logoutTimes = [];
      const tz = tzByEmail[employeeId] || 'UTC'
      for (const s of arr) {
        const start = new Date(s.startedAt).getTime();
        const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
        totalActiveSeconds += Math.max(0, Math.floor((end - start) / 1000));
        totalIdleSeconds += s.idleSeconds || 0;
        loginTimes.push(s.startedAt);
        if (s.endedAt) logoutTimes.push(s.endedAt);
      }
      const netActiveSeconds = Math.max(0, totalActiveSeconds - totalIdleSeconds);
      const loginTimes_local = loginTimes.map(t => formatLocalDateTime(Date.parse(t), tz, { withSeconds: true }))
      const logoutTimes_local = logoutTimes.map(t => formatLocalDateTime(Date.parse(t), tz, { withSeconds: true }))
      return { employeeId, timezone: tz, today_local_date: todayKeyByEmail[employeeId], loginTimes, logoutTimes, loginTimes_local, logoutTimes_local, totalActiveSeconds, totalIdleSeconds, netActiveSeconds };
    });
    res.json({ today_utc: todayStr(), employees: result });
  } catch (e) {
    console.error('[work:summary] error:', e);
    res.status(500).json({ error: 'Summary failed' });
  }
});

// Manager endpoint: today sessions per employee with per-session details
app.get('/api/work/sessions/today', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const sessions = readSessions();
    
    // Filter by company
    const company_id = req.user?.company_id;
    const allUsers = readUsers();
    const companyUserEmails = new Set(allUsers.filter(u => u.company_id == company_id).map(u => u.email));
    const companySessions = sessions.filter(s => companyUserEmails.has(s.employeeId));

    const nowMs = Date.now()
    const tzByEmail = {}
    const todayKeyByEmail = {}
    for (const email of companyUserEmails) {
      const tz = getEmployeeTimezone(email, company_id) || 'UTC'
      tzByEmail[email] = tz
      todayKeyByEmail[email] = localDateKey(nowMs, tz)
    }

    const byEmp = {};
    for (const s of companySessions) {
      const k = s.employeeId;
      const tz = tzByEmail[k] || 'UTC'
      const startMs = new Date(s.startedAt).getTime();
      if (!startMs) continue
      if (localDateKey(startMs, tz) !== todayKeyByEmail[k]) continue
      const endMs = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const activeSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const idleSeconds = s.idleSeconds || 0;
      const netActiveSeconds = Math.max(0, activeSeconds - idleSeconds);
      if (!byEmp[k]) byEmp[k] = [];
      byEmp[k].push({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        startedAt_local: formatLocalDateTime(startMs, tz, { withSeconds: true }),
        endedAt_local: s.endedAt ? formatLocalDateTime(Date.parse(s.endedAt), tz, { withSeconds: true }) : null,
        timezone: tz,
        today_local_date: todayKeyByEmail[k],
        isActive: !!s.isActive,
        activeSeconds,
        idleSeconds,
        netActiveSeconds,
      });
    }
    let entries = Object.entries(byEmp);
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub);
      entries = entries.filter(([employeeId]) => teamEmails.includes(employeeId));
    }
    const result = entries.map(([employeeId, sessions]) => ({ employeeId, sessions }));
    res.json({ today_utc: todayStr(), employees: result });
  } catch (e) {
    console.error('[work:sessions] error:', e);
    res.status(500).json({ error: 'Sessions fetch failed' });
  }
});

// Screenshot upload
app.post('/api/uploads/screenshot', requireRole(['employee']), upload.single('screenshot'), async (req, res) => {
  try {
    const fileRelPath = path.relative(process.cwd(), req.file.path);
    const tokenEmail = req.user?.sub || req.user?.email || null
    const employeeId = tokenEmail || (req.body && (req.body.employeeId || req.body.email)) || 'unknown';
    const company_id = req.user?.company_id || (() => {
      if (!tokenEmail) return null
      try { return getUserByEmail(tokenEmail)?.company_id || null } catch { return null }
    })();
    const record = { file: fileRelPath.replace(/\\/g, '/'), employeeId, company_id, ts: new Date().toISOString() };
    // Append metadata to uploads/index.json (simple dev store)
    try {
      const arr = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      arr.push(record);
      fs.writeFileSync(metaFile, JSON.stringify(arr, null, 2));
    } catch (e) {
      console.error('[meta] write failed:', e);
    }
    try { io.emit('uploads:new', { employeeId, file: record.file, ts: record.ts }); } catch {}

    // Mark employee as online upon receiving a screenshot (helps Live View selection)
    if (employeeId && employeeId !== 'unknown') {
      onlineEmployees.add(employeeId);
      if (company_id) {
        io.to(`company:${company_id}`).emit('presence:online', { userId: employeeId });
      }
    }

    // If a manager has started live view for this employee, relay the frame to viewers
    try {
      const absFile = path.resolve(req.file.path);
      const frameBase64 = fs.readFileSync(absFile, { encoding: 'base64' });
      if (liveStreamOn.get(employeeId)) {
        io.to(viewersRoom(employeeId)).emit('live_view:frame', { employeeId, frameBase64, ts: record.ts });
      }
    } catch (e) {
      console.warn('[live_view] relay failed:', e?.message || e);
    }

    res.status(201).json({ file: record.file });
  } catch (err) {
    console.error('[upload] error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/uploads/cleanup', requireRole(['super_admin']), (req, res) => {
  try {
    const { from, to } = req.body || {};
    const toStartISO = (ds) => {
      if (!ds) return null;
      const base = new Date(ds);
      const d = new Date(`${base.toISOString().slice(0,10)}T00:00:00`);
      return d.toISOString();
    };
    const toEndISO = (ds) => {
      if (!ds) return null;
      const base = new Date(ds);
      const d = new Date(`${base.toISOString().slice(0,10)}T00:00:00`);
      return new Date(d.getTime() + 24*60*60*1000 - 1).toISOString();
    };
    const fromIso = from ? toStartISO(from) : null;
    const toIso = to ? toEndISO(to) : null;
    const fromMs = fromIso ? new Date(fromIso).getTime() : null;
    const toMs = toIso ? new Date(toIso).getTime() : null;
    let meta = [];
    try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')); } catch {}
    const inRange = (ts) => {
      const t = new Date(ts).getTime();
      if (fromMs && t < fromMs) return false;
      if (toMs && t > toMs) return false;
      return true;
    };
    const targets = meta.filter(m => m.ts && inRange(m.ts));
    let removed = 0;
    let bytesFreed = 0;
    for (const m of targets) {
      try {
        const fname = path.basename(String(m.file || ''));
        const abs = path.join(uploadPath, fname);
        try { bytesFreed += fs.statSync(abs).size; } catch {}
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
        removed += 1;
      } catch {}
    }
    const keep = meta.filter(m => !(m.ts && inRange(m.ts)));
    try { fs.writeFileSync(metaFile, JSON.stringify(keep, null, 2)); } catch {}
    try { io.emit('uploads:cleanup_done', { removed, bytesFreed, from: fromIso, to: toIso }); } catch {}
    res.json({ ok: true, removed, bytesFreed });
  } catch (err) {
    console.error('[uploads:cleanup] error:', err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// List uploaded screenshots (development helper)
app.get('/api/uploads/list', requireRole(['manager', 'company_admin']), async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    let items = readJSON(screenshotsS3File).filter(x => x.company_id == company_id);

    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id);
      items = items.filter(it => it.employee_id && teamEmails.includes(it.employee_id));
    }

    items.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1))
    const now = Date.now()
    const out = items.map(it => {
      const tz = getEmployeeTimezone(it.employee_id, company_id) || 'UTC'
      const ms = it.captured_at ? Date.parse(it.captured_at) : null
      const pt = signPreviewToken({ fileId: it.s3_key, sub: req.user?.sub, role: req.user?.role, uid: req.user?.uid || null, company_id, exp: now + 600_000 })
      return {
        employeeId: it.employee_id,
        ts: it.captured_at,
        timezone: tz,
        ts_local: ms ? formatLocalDateTime(ms, tz, { withSeconds: true }) : null,
        s3_key: it.s3_key,
        preview_url: `/api/uploads/preview/${encodeURIComponent(it.s3_key)}?pt=${pt}`
      }
    })
    res.json({ files: out });
  } catch (err) {
    console.error('[upload:list] error:', err);
    res.status(500).json({ error: 'List failed' });
  }
});

// Query uploaded screenshots by employee and date range
app.get('/api/uploads/query', requireRole(['manager', 'company_admin']), async (req, res) => {
  try {
    const { employeeId, from, to } = req.query || {};
    const company_id = req.user?.company_id;
    let meta = readJSON(screenshotsS3File).filter(x => x.company_id == company_id);

    // Manager scoping to team
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id);
      meta = meta.filter(m => m.employee_id && teamEmails.includes(m.employee_id));
    }
    
    // Filter by employee
    if (employeeId) {
      meta = meta.filter(m => String(m.employee_id).toLowerCase() === String(employeeId).toLowerCase());
    }
    const tzForRange = employeeId ? getEmployeeTimezone(employeeId, company_id) : null
    const parseMaybeDate = (ds, isEnd) => {
      if (!ds) return null
      const s = String(ds)
      if (tzForRange && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const t = isEnd ? '23:59:59' : '00:00:00'
        return parseLocalDateTimeToUtcMs(s, t, tzForRange)
      }
      const ms = new Date(s).getTime()
      return Number.isFinite(ms) ? ms : null
    }
    const fromMs = parseMaybeDate(from, false)
    const toMs = parseMaybeDate(to, true)
    if (fromMs) meta = meta.filter(m => new Date(m.captured_at).getTime() >= fromMs);
    if (toMs) meta = meta.filter(m => new Date(m.captured_at).getTime() <= toMs);
    // Sort by time ascending
    meta.sort((a, b) => (a.captured_at > b.captured_at ? 1 : -1));
    const now = Date.now()
    const out = meta.map(m => {
      const tz = getEmployeeTimezone(m.employee_id, company_id) || 'UTC'
      const ms = m.captured_at ? Date.parse(m.captured_at) : null
      const pt = signPreviewToken({ fileId: m.s3_key, sub: req.user?.sub, role: req.user?.role, uid: req.user?.uid || null, company_id, exp: now + 600_000 })
      return {
        employeeId: m.employee_id,
        ts: m.captured_at,
        timezone: tz,
        ts_local: ms ? formatLocalDateTime(ms, tz, { withSeconds: true }) : null,
        s3_key: m.s3_key,
        preview_url: `/api/uploads/preview/${encodeURIComponent(m.s3_key)}?pt=${pt}`
      }
    })
    res.json({ files: out });
  } catch (err) {
    console.error('[upload:query] error:', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/api/uploads/zip', requireRole(['manager', 'company_admin']), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const employeeId = String(req.query?.employeeId || '').trim().toLowerCase()
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' })

    let teamEmails = null
    if (req.user?.role === 'manager') {
      teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id).map(e => String(e).toLowerCase())
      if (!teamEmails.includes(employeeId)) return res.status(403).json({ error: 'Forbidden' })
    }

    let meta = readJSON(screenshotsS3File).filter(x => x.company_id == company_id)
    if (req.user?.role === 'manager') {
      meta = meta.filter(m => m.employee_id && teamEmails.includes(String(m.employee_id).toLowerCase()))
    }
    meta = meta.filter(m => String(m.employee_id || '').toLowerCase() === employeeId)

    const tzForRange = getEmployeeTimezone(employeeId, company_id) || null
    const parseMaybeDate = (ds, isEnd) => {
      if (!ds) return null
      const s = String(ds)
      if (tzForRange && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const t = isEnd ? '23:59:59' : '00:00:00'
        return parseLocalDateTimeToUtcMs(s, t, tzForRange)
      }
      const ms = new Date(s).getTime()
      return Number.isFinite(ms) ? ms : null
    }
    const fromMs = parseMaybeDate(req.query?.from, false)
    const toMs = parseMaybeDate(req.query?.to, true)
    if (fromMs) meta = meta.filter(m => new Date(m.captured_at).getTime() >= fromMs)
    if (toMs) meta = meta.filter(m => new Date(m.captured_at).getTime() <= toMs)
    meta.sort((a, b) => (a.captured_at > b.captured_at ? 1 : -1))

    // Extract the auth token for internal API calls
    const bearerToken = (req.headers.authorization || '').startsWith('Bearer ')
      ? (req.headers.authorization || '').slice(7)
      : null

    let localMeta = []
    try {
      const u = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
      localMeta = Array.isArray(u) ? u : []
    } catch {}
    localMeta = localMeta.filter(m => m.company_id == company_id && String(m.employeeId || '').toLowerCase() === employeeId)
    if (fromMs) localMeta = localMeta.filter(m => new Date(m.ts).getTime() >= fromMs)
    if (toMs) localMeta = localMeta.filter(m => new Date(m.ts).getTime() <= toMs)
    localMeta.sort((a, b) => (a.ts > b.ts ? 1 : -1))

    if (!meta.length && !localMeta.length) return res.status(404).json({ error: 'No screenshots found' })

    const safeName = String(employeeId).replace(/[^a-z0-9._-]+/gi, '_')
    const zipName = `screenshots_${safeName}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', () => { try { res.status(500).end() } catch {} })
    archive.pipe(res)

    for (const m of meta) {
      try {
        const url = `/api/uploads/preview/${encodeURIComponent(m.s3_key)}`
        const fr = await fetch(url, { headers: { Authorization: `Bearer ${bearerToken}` } })
        if (!fr.ok || !fr.body) continue
        const iso = String(m.captured_at || new Date().toISOString())
        const name = `screenshot_${iso.replace(/[:]/g, '-').replace('T', '_').replace('Z', '')}.jpg`
        archive.append(Readable.fromWeb(fr.body), { name })
      } catch {}
    }

    for (const m of localMeta) {
      try {
        const fname = path.basename(String(m.file || ''))
        const abs = path.join(uploadPath, fname)
        if (!fs.existsSync(abs)) continue
        const iso = String(m.ts || new Date().toISOString())
        const name = `local_${iso.replace(/[:]/g, '-').replace('T', '_').replace('Z', '')}_${fname}`
        archive.append(fs.createReadStream(abs), { name })
      } catch {}
    }

    await archive.finalize()
  } catch (e) {
    res.status(500).json({ error: 'ZIP failed' })
  }
})

// Sessions by date range with per-session details
app.get('/api/work/sessions/range', requireRole(['manager', 'company_admin', 'super_admin']), (req, res) => {
  try {
    const { employeeId, from, to } = req.query || {};
    const sessions = readSessions();
    
    // Filter by company
    const company_id = req.user?.company_id;
    const allUsers = readUsers();
    const companyUserEmails = new Set(allUsers.filter(u => u.company_id == company_id).map(u => u.email));
    const companySessions = sessions.filter(s => companyUserEmails.has(s.employeeId));

    const email = employeeId ? String(employeeId).trim() : null
    const tz = email ? getEmployeeTimezone(email, company_id) : null
    const fromStr = from ? String(from).slice(0,10) : null;
    const toStr = to ? String(to).slice(0,10) : null;
    const fromMs = (email && tz && fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)) ? parseLocalDateTimeToUtcMs(fromStr, '00:00:00', tz) : null
    const toMs = (email && tz && toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) ? parseLocalDateTimeToUtcMs(toStr, '23:59:59', tz) : null
    const inRange = companySessions.filter(s => {
      const st = new Date(s.startedAt).getTime()
      if (!Number.isFinite(st)) return false
      if (email && String(s.employeeId).toLowerCase() !== String(email).toLowerCase()) return false
      if (fromMs != null && st < fromMs) return false
      if (toMs != null && st > toMs) return false
      if (!email) {
        const d = s.date;
        if (fromStr && d < fromStr) return false;
        if (toStr && d > toStr) return false;
      }
      return true;
    });
    const byEmp = {};
    for (const s of inRange) {
      const k = s.employeeId;
      if (!byEmp[k]) byEmp[k] = [];
      const tzEmp = getEmployeeTimezone(k, company_id) || 'UTC'
      const startMs = new Date(s.startedAt).getTime();
      const endMs = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const activeSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const idleSeconds = s.idleSeconds || 0;
      const netActiveSeconds = Math.max(0, activeSeconds - idleSeconds);
      byEmp[k].push({
        id: s.id,
        date: s.date,
        date_local: localDateKey(startMs, tzEmp),
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        startedAt_local: formatLocalDateTime(startMs, tzEmp, { withSeconds: true }),
        endedAt_local: s.endedAt ? formatLocalDateTime(Date.parse(s.endedAt), tzEmp, { withSeconds: true }) : null,
        timezone: tzEmp,
        isActive: !!s.isActive,
        activeSeconds,
        idleSeconds,
        netActiveSeconds,
      });
    }
    let entries = Object.entries(byEmp);
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub);
      entries = entries.filter(([eid]) => teamEmails.includes(eid));
    }
    const result = entries.map(([employeeId, sessions]) => ({ employeeId, sessions }));
    res.json({ employees: result, from: fromStr, to: toStr });
  } catch (e) {
    console.error('[work:sessions_range] error:', e);
    res.status(500).json({ error: 'Sessions range failed' });
  }
});

// Activity: recent screenshots grouped by employee (dev helper)
app.get('/api/activity/recent', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const arr = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    // group by employeeId
    const company_id = req.user?.company_id;
    const allUsers = readUsers();
    const companyUserEmails = new Set(allUsers.filter(u => u.company_id == company_id).map(u => u.email));

    const byEmp = {};
    for (const r of arr) {
      const k = r.employeeId || 'unknown';
      if (!companyUserEmails.has(k)) continue;
      if (!byEmp[k]) byEmp[k] = [];
      byEmp[k].push(r);
    }
    let entries = Object.entries(byEmp);
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub);
      entries = entries.filter(([employeeId]) => teamEmails.includes(employeeId));
    }
    // Super Admin: sees all company employees (no extra filter needed)
    
    const result = entries.map(([employeeId, records]) => {
      const sorted = records.sort((a, b) => (a.ts < b.ts ? 1 : -1));
      const tz = getEmployeeTimezone(employeeId, company_id) || 'UTC'
      return {
        employeeId,
        timezone: tz,
        latest: sorted.slice(0, 3).map(r => ({ file: r.file, ts: r.ts, ts_local: r.ts ? formatLocalDateTime(Date.parse(r.ts), tz, { withSeconds: true }) : null })),
        count: records.length
      };
    });
    res.json({ employees: result });
  } catch (e) {
    console.error('[activity] error:', e);
    res.status(500).json({ error: 'Activity failed' });
  }
});

// Live View via Socket.IO with auth and viewer rooms
const userRoom = (userId) => `user:${userId}`;
const viewersRoom = (employeeId) => `live:viewers:${employeeId}`;
const onlineEmployees = new Set();
// Track live streaming enablement per employee; frames are relayed only when true
const liveStreamOn = new Map(); // employeeId -> boolean

io.use((socket, next) => {
  try {
    // Accept token from Authorization header or Socket.IO auth payload
    const authHeader = socket.handshake.headers?.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const authToken = socket.handshake.auth?.token || null;
    const qpToken = socket.handshake.query?.token || null; // fallback if needed
    const token = headerToken || authToken || qpToken;
    if (!token) return next(new Error('Unauthorized'));
    const payload = jwt.verify(token, JWT_SECRET);
    // attach to socket for downstream usage (production: trust only verified token)
    socket.data.userId = payload?.email || payload?.userId; // email identifier (employees/managers)
    socket.data.uid = payload?.uid || null; // numeric/uuid id (managers)
    let role = payload?.role || 'employee'
    let company_id = payload?.company_id || null
    if (!company_id && socket.data.userId) {
      try { company_id = getUserByEmail(socket.data.userId)?.company_id || null } catch {}
    }
    if (role === 'super_admin' && company_id != null) role = 'company_admin'
    socket.data.role = role
    socket.data.company_id = company_id
    next();
  } catch (err) {
    try {
      if (String(err?.message || '').toLowerCase().includes('invalid signature')) {
        console.warn('[socket] auth failed: invalid signature (token likely issued under a different JWT_SECRET)')
      } else {
        console.warn('[socket] auth failed:', err.message);
      }
    } catch {}
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const qpUserId = socket.handshake.query?.userId;
  const qpUid = socket.handshake.query?.uid;
  const userId = socket.data.userId || qpUserId;
  // Production: role must come from verified token. Ignore query role.
  const role = socket.data.role || 'employee';
  const managerUid = socket.data.uid || qpUid || null;
  const company_id = socket.data.company_id;
  
  // Join company room for scoped broadcasts
  if (company_id) {
    socket.join(`company:${company_id}`);
  }

  if (userId) {
    socket.join(userRoom(userId));
  }

  // Track presence: employees
  if (role === 'employee' && userId) {
    onlineEmployees.add(userId);
    if (company_id) {
      io.to(`company:${company_id}`).emit('presence:online', { userId });
    }
  }

  // On manager/company_admin connection, send current online employees list (scoped to team AND company)
  if (role === 'manager' || role === 'company_admin') {
    let users = Array.from(onlineEmployees);
    
    // Filter users by company (needs lookup if we don't store company_id in onlineEmployees)
    // Optimization: onlineEmployees could be Set<string> of emails. 
    // We can filter by checking against allUsers (memory cache)
    const allUsers = readUsers();
    users = users.filter(email => {
      const u = allUsers.find(au => au.email === email);
      return u && u.company_id == company_id;
    });

    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(managerUid || socket.data.uid || socket.data.userId || userId, company_id);
      users = users.filter(u => teamEmails.includes(u));
    }
    socket.emit('presence:list', { users });
  }

  // Manager can start live view: join the viewer room and signal employee
  socket.on('live_view:start', ({ employeeId }) => {
    if (role !== 'manager' && role !== 'company_admin') {
      try { appendAudit('rbac_forbidden_socket', { actorId: socket.data.userId || userId, event: 'live_view:start' }, company_id) } catch {}
      return;
    }

    // Validate permission
    const allUsers = readUsers();
    const targetUser = allUsers.find(u => u.email === employeeId);
    if (!targetUser || targetUser.company_id != company_id) {
       return; // Ignore if not in company
    }

    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(managerUid || socket.data.uid || socket.data.userId || userId, company_id);
      if (!teamEmails.includes(employeeId)) return; // ignore if not in team
    }
    socket.join(viewersRoom(employeeId));
    liveStreamOn.set(employeeId, true);
    io.to(userRoom(employeeId)).emit('live_view:initiate', { by: userId });
    appendAudit('live_view_start', { actorId: socket.data.userId || userId, employeeId }, company_id);
  });

  // Manager can stop live view: leave the viewer room and signal employee
  socket.on('live_view:stop', ({ employeeId }) => {
    if (role !== 'manager' && role !== 'company_admin') {
      try { appendAudit('rbac_forbidden_socket', { actorId: socket.data.userId || userId, event: 'live_view:stop' }, company_id) } catch {}
      return;
    }
    
    // Validate permission
    const allUsers = readUsers();
    const targetUser = allUsers.find(u => u.email === employeeId);
    if (!targetUser || targetUser.company_id != company_id) {
       return; 
    }

    if (role === 'manager') {
      const teamEmails = getTeamEmailsForManager(managerUid || socket.data.uid || socket.data.userId || userId, company_id);
      if (!teamEmails.includes(employeeId)) return; // ignore if not in team
    }
    socket.leave(viewersRoom(employeeId));
    liveStreamOn.set(employeeId, false);
    io.to(userRoom(employeeId)).emit('live_view:terminate', { by: userId, reason: 'manager_stop' });
    io.to(viewersRoom(employeeId)).emit('live_view:terminate', { by: userId, reason: 'manager_stop' });
  });

  // Employee can notify termination (e.g., tracking stopped)
  socket.on('live_view:terminate', ({ employeeId }) => {
    if (role !== 'employee') return;
    liveStreamOn.set(employeeId, false);
    io.to(viewersRoom(employeeId)).emit('live_view:terminate', { by: userId, reason: 'employee_terminate' });
  });

// Employee streams frames; server always relays to viewers of that employee
socket.on('live_view:frame', ({ employeeId, frameBase64, ts }) => {
  io.to(viewersRoom(employeeId)).emit('live_view:frame', { employeeId, frameBase64, ts });
});

  socket.on('disconnect', () => {
    // If an employee disconnects, proactively terminate any viewer sessions
    if (role === 'employee' && userId) {
      onlineEmployees.delete(userId);
      // Broadcast offline to company room
      const cid = socket.data.company_id;
      if (cid) {
        io.to(`company:${cid}`).emit('presence:offline', { userId });
      }
      liveStreamOn.set(userId, false);
      io.to(viewersRoom(userId)).emit('live_view:terminate', { by: userId, reason: 'offline' });
    }
  });
});

// DB connection
connectMongo(process.env.MONGO_URI);

httpServer.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use. Is another instance running?`);
    process.exit(1);
  } else {
    console.error('[server] Server error:', err);
  }
});

const shutdown = () => {
  try { io.disconnectSockets(true); } catch {}
  try { io.close(); } catch {}
  try {
    httpServer.close(() => process.exit(0));
  } catch {
    process.exit(0);
  }
  setTimeout(() => process.exit(0), 3000);
};

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
  try { process.on(sig, shutdown); } catch {}
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});

// Serve built frontend (SPA) in production if available
try {
  const webDistPath = path.join(process.cwd(), 'web', 'dist');
  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    // SPA fallback: send index.html for non-API routes
    // But exclude /reset-password if it's handled by frontend routing?
    // Wait, the error is "Cannot GET /reset-password" from Express.
    // This means Express is trying to handle it but finding no route, AND static file serving didn't catch it?
    // If 'web/dist' exists, line 2168 handles it.
    // If 'web/dist' does NOT exist (dev mode), Express returns 404 because no route matches.
    // In dev mode, we usually run Vite dev server on 5173.
    // The link generated is http://localhost:4000/reset-password...
    // If we are in dev mode, we should point to the frontend URL (e.g. localhost:5173 or process.env.FRONTEND_URL)
    
    app.get('/reset-password', (req, res) => {
      // In dev mode, redirect to frontend port 5173
      const token = req.query.token;
      if (token) {
        // Assume frontend is on 5173 if not specified
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/reset-password?token=${token}`);
      }
      res.status(404).send('Reset token missing');
    });

    app.get('*', (req, res, next) => {
      const isDownloadsRoot = req.path === '/downloads' || req.path === '/downloads/'
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || (req.path.startsWith('/downloads') && !isDownloadsRoot)) return next();
      // If we are serving static files, send index.html
      if (fs.existsSync(path.join(process.cwd(), 'web', 'dist', 'index.html'))) {
         res.sendFile(path.join(process.cwd(), 'web', 'dist', 'index.html'));
      } else {
         if (isDownloadsRoot) {
           const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
           return res.redirect(`${frontendUrl}/downloads`);
         }
         next();
      }
    });
    console.log('[server] Serving static frontend from', webDistPath);
  }
} catch (e) {
  console.warn('[server] Unable to configure static frontend serving:', e?.message || e);
}

app.post('/api/admin/reset-all', requireRole(['super_admin']), (req, res) => {
  try {
    const keepEmail = process.env.SUPERADMIN_EMAIL || 'admin@example.com'
    const keepPass = process.env.SUPERADMIN_PASSWORD || 'admin123'
    if (db) {
      db.transaction(() => {
        db.prepare('DELETE FROM organizations').run()
        db.prepare('DELETE FROM companies').run()
        db.prepare('DELETE FROM employee_creds').run()
        db.prepare('DELETE FROM manager_creds').run()
        db.prepare('DELETE FROM transactions').run()
        db.prepare('DELETE FROM invoices').run()
        db.prepare('DELETE FROM time_requests').run()
        db.prepare('DELETE FROM password_reset_tokens').run()
        db.prepare('DELETE FROM users WHERE lower(email) != lower(?)').run(keepEmail)
      })()
      const u = getUserByEmail(keepEmail)
      if (!u) createUser({ email: keepEmail, password: keepPass, role: 'super_admin' })
    } else {
      const ufile = path.resolve(process.cwd(), DATA_DIR, 'users.sqlite.json')
      const ofile = path.resolve(process.cwd(), DATA_DIR, 'organizations.sqlite.json')
      const cfile = path.resolve(process.cwd(), DATA_DIR, 'companies.sqlite.json')
      const ecred = path.resolve(process.cwd(), DATA_DIR, 'employee_creds.sqlite.json')
      const mcred = path.resolve(process.cwd(), DATA_DIR, 'manager_creds.sqlite.json')
      const txfile = path.resolve(process.cwd(), DATA_DIR, 'transactions.sqlite.json')
      const invfile = path.resolve(process.cwd(), DATA_DIR, 'invoices.sqlite.json')
      const reqfile = path.resolve(process.cwd(), DATA_DIR, 'time_requests.sqlite.json')
      const rtokens = path.resolve(process.cwd(), DATA_DIR, 'reset_tokens.sqlite.json')
      const legacyUsers = usersFile
      const legacyOrg = orgFile
      const intervals = intervalsFile
      const sessions = sessionsFile
      const audits = auditFile
      const reportsIdx = path.join(dataPath, 'reports.index.json')
      const keep = getUserByEmail(keepEmail)
      let arr = []
      try { arr = JSON.parse(fs.readFileSync(ufile, 'utf-8')) } catch {}
      arr = arr.filter(x => String(x.email).toLowerCase() === String(keepEmail).toLowerCase())
      if (!arr.length) {
        createUser({ email: keepEmail, password: keepPass, role: 'super_admin' })
        try { arr = JSON.parse(fs.readFileSync(ufile, 'utf-8')) } catch { arr = [] }
        arr = arr.filter(x => String(x.email).toLowerCase() === String(keepEmail).toLowerCase())
      }
      fs.writeFileSync(ufile, JSON.stringify(arr, null, 2))
      fs.writeFileSync(ofile, '[]')
      fs.writeFileSync(cfile, '[]')
      fs.writeFileSync(ecred, '[]')
      fs.writeFileSync(mcred, '[]')
      fs.writeFileSync(txfile, '[]')
      fs.writeFileSync(invfile, '[]')
      fs.writeFileSync(reqfile, '[]')
      fs.writeFileSync(rtokens, '[]')
      fs.writeFileSync(legacyUsers, '[]')
      fs.writeFileSync(legacyOrg, JSON.stringify({ name: '', createdAt: null }, null, 2))
      fs.writeFileSync(intervals, '{}')
      fs.writeFileSync(sessions, '[]')
      fs.writeFileSync(audits, '[]')
      fs.writeFileSync(reportsIdx, '[]')
      try {
        const meta = metaFile
        fs.writeFileSync(meta, '[]')
      } catch {}
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Reset failed' })
  }
})

app.get('/api/platform/metrics', requireRole(['super_admin']), (req, res) => {
  try {
    const companies = listCompanies()
    const users = listAllUsers()
    const total_companies = companies.length
    const country_distribution = {}
    const timezone_distribution = {}
    for (const u of users) {
      const c = (u.country || '').trim() || 'Unknown'
      const t = (u.timezone || '').trim() || 'UTC'
      country_distribution[c] = (country_distribution[c] || 0) + 1
      timezone_distribution[t] = (timezone_distribution[t] || 0) + 1
    }
    const per_company = companies.map(c => {
      const cu = users.filter(u => u.company_id == c.id)
      const admins = cu.filter(u => u.role === 'company_admin').length
      const managers = cu.filter(u => u.role === 'manager').length
      const employees = cu.filter(u => u.role === 'employee').length
      const tx = getTransactions(c.id) || []
      const revenue = tx.filter(t => t.type === 'credit').reduce((s, t) => s + (Number(t.amount) || 0), 0)
      return {
        company_id: c.id,
        name: c.name,
        plan: c.plan || 'free',
        credits: c.credits || 0,
        admins,
        managers,
        employees,
        revenue
      }
    })
    const total_revenue = per_company.reduce((s, r) => s + (r.revenue || 0), 0)
    const growth = (() => {
      const byMonth = {}
      for (const c of companies) {
        const tx = getTransactions(c.id) || []
        for (const t of tx) {
          if (t.type !== 'credit') continue
          const d = new Date(t.created_at)
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`
          byMonth[key] = (byMonth[key] || 0) + (Number(t.amount) || 0)
        }
      }
      const series = Object.entries(byMonth).sort((a,b)=> a[0] > b[0] ? 1 : -1).map(([month, revenue]) => ({ month, revenue }))
      return { monthly_revenue: series }
    })()
    res.json({ total_companies, total_revenue, per_company, country_distribution, timezone_distribution, growth })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load platform metrics' })
  }
})

app.get('/api/platform/revenue-by-country', requireRole(['super_admin']), (req, res) => {
  try {
    const { from, to } = req.query || {}
    const companies = listCompanies()
    const fromMs = from ? new Date(String(from)).getTime() : null
    const toMs = to ? new Date(String(to)).getTime() + 86400000 : null

    const countryMap = {}
    for (const c of companies) {
      const country = (c.name ? null : 'Unknown')
      // Get company admin to find country
      const users = listAllUsers().filter(u => u.company_id == c.id)
      const companyCountry = users.find(u => u.country)?.country || 'Unknown'
      const tx = getTransactions(c.id) || []
      let revenue = 0
      for (const t of tx) {
        if (t.type !== 'credit') continue
        const tMs = new Date(t.created_at).getTime()
        if (fromMs && tMs < fromMs) continue
        if (toMs && tMs > toMs) continue
        revenue += Number(t.amount) || 0
      }
      if (!countryMap[companyCountry]) countryMap[companyCountry] = { country: companyCountry, revenue: 0, companies: 0, transactions: 0 }
      countryMap[companyCountry].revenue += revenue
      countryMap[companyCountry].companies += 1
      countryMap[companyCountry].transactions += tx.filter(t => {
        if (t.type !== 'credit') return false
        const tMs = new Date(t.created_at).getTime()
        if (fromMs && tMs < fromMs) return false
        if (toMs && tMs > toMs) return false
        return true
      }).length
    }

    const rows = Object.values(countryMap).sort((a, b) => b.revenue - a.revenue)
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
    res.json({ rows, totalRevenue, from: from || null, to: to || null })
  } catch (e) {
    console.error('[platform:revenue-by-country] error:', e)
    res.status(500).json({ error: 'Failed to load revenue by country' })
  }
})

app.get('/api/platform/companies', requireRole(['super_admin']), (req, res) => {
  try {
    const q = String(req.query?.q || '').trim().toLowerCase()
    const companies = listCompanies().map(c => ({
      id: c.id,
      name: c.name,
      plan: c.plan || 'free',
      credits: c.credits || 0,
      updated_at: c.updated_at || c.created_at || null,
      created_at: c.created_at || null,
    }))
    const filtered = q
      ? companies.filter(c => String(c.name || '').toLowerCase().includes(q) || String(c.id || '').includes(q))
      : companies
    filtered.sort((a, b) => (b.credits || 0) - (a.credits || 0))
    res.json({ companies: filtered.slice(0, 200) })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load companies' })
  }
})

app.get('/api/platform/companies/:company_id/transactions', requireRole(['super_admin']), (req, res) => {
  try {
    const company_id = Number(req.params.company_id)
    const tx = getTransactions(company_id) || []
    res.json({ history: tx.slice(0, 200) })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load transactions' })
  }
})

app.post('/api/platform/companies/:company_id/grant-credits', requireRole(['super_admin']), async (req, res) => {
  try {
    const company_id = Number(req.params.company_id)
    const company = getCompanyById(company_id)
    if (!company) return res.status(404).json({ error: 'Company not found' })

    const raw = req.body || {}
    const credits = Math.floor(Number(raw.credits))
    const reason = String(raw.reason || '').trim()
    if (!Number.isFinite(credits) || credits <= 0) return res.status(400).json({ error: 'Credits must be a positive number' })
    if (credits > 100000) return res.status(400).json({ error: 'Credits amount too large' })

    const actorEmail = req.user?.email || 'super_admin'
    const ref = `free:${uuid()}`
    const desc = `Free credits grant by ${actorEmail}${reason ? `: ${reason}` : ''}`

    const newBalance = creditCompanyWithTransaction({
      company_id,
      amount_usd: 0,
      credits,
      description: desc,
      reference_id: ref,
    })

    try { appendAudit('company_free_credits_granted', { company_id, credits, reason, actorId: req.user?.uid || req.user?.sub, actorEmail }, company_id) } catch {}
    try { io.to(`company:${company_id}`).emit('company:credits_updated', { company_id, balance: newBalance }) } catch {}

    // Send email to company admin about free credits (async, fire-and-forget with error logging)
    const adminEmail = getCompanyAdminEmail(company_id, company)
    if (adminEmail) {
      sendPaymentSuccess({
        to: adminEmail,
        company: { name: company.name, id: company_id, logo_url: company.logo_url },
        amount_usd: 0,
        credits,
        balance: newBalance,
        description: reason || 'Free credits grant'
      }).catch(err => console.error('[platform:grant-credits] email failed:', err?.message || err))
    }

    res.json({ ok: true, company_id, balance: newBalance, reference_id: ref })
  } catch (e) {
    console.error('[platform:grant-credits] error:', e?.message || e, e?.stack)
    res.status(500).json({ error: 'Failed to grant credits', details: e?.message || String(e) })
  }
})


// ---------- BEGIN: compatibility proxy to support hardcoded :4000 frontend ----------
// If the backend starts on a different port than 4000, create a tiny proxy
// that listens on 4000 and forwards requests to the real server port.
// This helps dev setups where the frontend expects http://localhost:4000.
import http from 'http';

const ACTUAL_PORT = Number(PORT) || 4000;
const LEGACY_PORT = 4000;

// start the main server (this is already in your file):
httpServer.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`[server] API listening at ${base}`);
  console.log(`[server] Upload dir: ${uploadPath}`);

  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production' && Number(ACTUAL_PORT) !== Number(LEGACY_PORT)) {
    try {
      const proxy = http.createServer((req, res) => {
        // forward request to actual server
        const options = {
          hostname: HOST,
          port: ACTUAL_PORT,
          path: req.url,
          method: req.method,
          headers: req.headers
        };

        const proxied = http.request(options, proxRes => {
          res.writeHead(proxRes.statusCode, proxRes.headers);
          proxRes.pipe(res, { end: true });
        });

        proxied.on('error', err => {
          console.error('[proxy] Forward error:', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy forward error' }));
        });

        // pipe request body
        req.pipe(proxied, { end: true });
      });

      proxy.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`[proxy] Port ${LEGACY_PORT} already in use. Skipping compatibility proxy.`);
        } else {
          console.warn('[proxy] Error starting compatibility proxy:', err);
        }
      });

      proxy.listen(LEGACY_PORT, '127.0.0.1', () => {
        console.log(`[proxy] Compatibility proxy listening on http://127.0.0.1:${LEGACY_PORT} -> http://${HOST}:${ACTUAL_PORT}`);
      });
    } catch (e) {
      console.warn('[proxy] Failed to start compatibility proxy:', e?.message || e);
    }
  }
});
// ---------- END: compatibility proxy ----------
// Query current online employees (role-scoped)
app.get('/api/presence/online', requireRole(['manager', 'company_admin']), (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const ttlMs = Number(process.env.PRESENCE_TTL_MS || 120000);
    const now = Date.now();
    const sessions = readSessions().filter(s => s.company_id == company_id && s.isActive);
    const recent = sessions.filter(s => {
      const last = s.lastHeartbeatAt ? Date.parse(s.lastHeartbeatAt) : (s.startedAt ? Date.parse(s.startedAt) : 0);
      return last && (now - last) <= ttlMs;
    });
    let users = Array.from(new Set(recent.map(s => s.employeeId)));
    if (req.user?.role === 'manager') {
      const teamEmails = getTeamEmailsForManager(req.user?.uid || req.user?.sub, company_id);
      users = users.filter(u => teamEmails.includes(u));
    }
    res.json({ users });
  } catch (e) {
    console.error('[presence:online] error:', e);
    res.status(500).json({ error: 'Failed to read presence' });
  }
});
