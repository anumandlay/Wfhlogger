import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

let Database = null
let db = null

const DATA_DIR = process.env.DATA_DIR || 'data'
const dbPath = path.resolve(process.cwd(), DATA_DIR, 'time_tracker.db')
const fallbacks = {
  users: path.resolve(process.cwd(), DATA_DIR, 'users.sqlite.json'),
  orgs: path.resolve(process.cwd(), DATA_DIR, 'organizations.sqlite.json'),
  companies: path.resolve(process.cwd(), DATA_DIR, 'companies.sqlite.json'),
  transactions: path.resolve(process.cwd(), DATA_DIR, 'transactions.sqlite.json'),
  employee_billing: path.resolve(process.cwd(), DATA_DIR, 'employee_billing.sqlite.json'),
  requests: path.resolve(process.cwd(), DATA_DIR, 'time_requests.sqlite.json'),
  reset_tokens: path.resolve(process.cwd(), DATA_DIR, 'reset_tokens.sqlite.json'),
  stripe_sessions: path.resolve(process.cwd(), DATA_DIR, 'stripe_sessions.sqlite.json')
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

try {
  // Dynamically import to allow environments without native build tools to still run (fallback to JSON)
  const mod = await import('better-sqlite3')
  Database = mod.default
  db = new Database(dbPath)
  // Initialize schema
  db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    credits INTEGER DEFAULT 0,
    logo_url TEXT,
    billing_email TEXT,
    billing_address TEXT,
    admin_contact_email TEXT,
    updated_at TEXT,
    created_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    activation_token TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    country TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin','company_admin','manager','employee')),
    timezone TEXT DEFAULT 'UTC',
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    manager_id INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(manager_id) REFERENCES users(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    amount INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
    description TEXT,
    reference_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    invoice_no INTEGER NOT NULL,
    invoice_id TEXT NOT NULL,
    company_name TEXT,
    company_logo_url TEXT,
    billing_email TEXT,
    invoice_date TEXT NOT NULL,
    billing_period TEXT,
    line_items TEXT,
    subtotal_amount INTEGER,
    tax_amount INTEGER,
    total_amount INTEGER,
    currency TEXT,
    payment_provider TEXT,
    payment_reference_id TEXT,
    payment_status TEXT,
    pdf_path TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS employee_creds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_email TEXT NOT NULL,
    temp_password TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS manager_creds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    manager_email TEXT NOT NULL,
    temp_password TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS time_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    employee_id INTEGER,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    timezone TEXT,
    start_utc TEXT,
    end_utc TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    action_by INTEGER,
    action_at TEXT,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(employee_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employee_billing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL UNIQUE,
    next_charge_at TEXT NOT NULL,
    last_charge_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(company_id) REFERENCES companies(id),
    FOREIGN KEY(employee_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    company_id INTEGER,
    reference_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(provider, event_id)
  );

  CREATE TABLE IF NOT EXISTS stripe_processed_sessions (
    session_id TEXT PRIMARY KEY,
    company_id INTEGER NOT NULL,
    user_id INTEGER,
    credits INTEGER NOT NULL,
    amount_usd INTEGER NOT NULL,
    reference_id TEXT,
    processed_at TEXT NOT NULL
  );
  `)
  
  // Migration: Ensure company_id column exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all()
    if (!tableInfo.find(c => c.name === 'company_id')) {
      db.exec("ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id)")
      console.log('[sqlite] Migrated users table: added company_id')
    }
    if (!tableInfo.find(c => c.name === 'full_name')) {
      db.exec("ALTER TABLE users ADD COLUMN full_name TEXT")
      console.log('[sqlite] Migrated users table: added full_name')
    }
    if (!tableInfo.find(c => c.name === 'country')) {
      db.exec("ALTER TABLE users ADD COLUMN country TEXT")
      console.log('[sqlite] Migrated users table: added country')
    }
    if (!tableInfo.find(c => c.name === 'timezone')) {
      db.exec("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'")
      console.log('[sqlite] Migrated users table: added timezone')
    }
    // Migration: Add is_active and activation_token to companies
    const compInfo = db.prepare("PRAGMA table_info(companies)").all()
    if (!compInfo.find(c => c.name === 'is_active')) {
      db.exec("ALTER TABLE companies ADD COLUMN is_active INTEGER DEFAULT 1")
      console.log('[sqlite] Migrated companies table: added is_active')
    }
    if (!compInfo.find(c => c.name === 'activation_token')) {
      db.exec("ALTER TABLE companies ADD COLUMN activation_token TEXT")
      console.log('[sqlite] Migrated companies table: added activation_token')
    }

    const orgInfo = db.prepare("PRAGMA table_info(organizations)").all()
    if (!orgInfo.find(c => c.name === 'company_id')) {
      db.exec("ALTER TABLE organizations ADD COLUMN company_id INTEGER REFERENCES companies(id)")
      console.log('[sqlite] Migrated organizations table: added company_id')
    }
    const ensureCol = (name, sql) => { if (!compInfo.find(c => c.name === name)) { db.exec(sql); console.log('[sqlite] Migrated companies: added', name) } }
    ensureCol('logo_url', "ALTER TABLE companies ADD COLUMN logo_url TEXT")
    ensureCol('billing_email', "ALTER TABLE companies ADD COLUMN billing_email TEXT")
    ensureCol('billing_address', "ALTER TABLE companies ADD COLUMN billing_address TEXT")
    ensureCol('admin_contact_email', "ALTER TABLE companies ADD COLUMN admin_contact_email TEXT")
    ensureCol('updated_at', "ALTER TABLE companies ADD COLUMN updated_at TEXT")

    const reqInfo = db.prepare("PRAGMA table_info(time_requests)").all()
    const ensureReqCol = (name, sql) => { if (!reqInfo.find(c => c.name === name)) { db.exec(sql); console.log('[sqlite] Migrated time_requests: added', name) } }
    ensureReqCol('timezone', "ALTER TABLE time_requests ADD COLUMN timezone TEXT")
    ensureReqCol('start_utc', "ALTER TABLE time_requests ADD COLUMN start_utc TEXT")
    ensureReqCol('end_utc', "ALTER TABLE time_requests ADD COLUMN end_utc TEXT")
  } catch (e) {
    console.error('[sqlite] Migration check failed:', e)
  }

  try {
    const def = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()
    const hasCompanyAdmin = String(def?.sql || '').includes("company_admin")
    if (!hasCompanyAdmin) {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS users_mig (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            country TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('super_admin','company_admin','manager','employee')),
            timezone TEXT DEFAULT 'UTC',
            created_at TEXT NOT NULL,
            FOREIGN KEY(company_id) REFERENCES companies(id)
          );
        `)
        db.exec(`
          INSERT INTO users_mig (id, company_id, email, full_name, country, password_hash, role, timezone, created_at)
          SELECT id, company_id, email, full_name, country, password_hash,
                 CASE 
                   WHEN lower(email) = lower('admin@example.com') THEN 'super_admin'
                   WHEN role = 'super_admin' AND company_id IS NOT NULL THEN 'company_admin'
                   ELSE role
                 END,
                 timezone, created_at
          FROM users;
        `)
        db.exec("DROP TABLE users")
        db.exec("ALTER TABLE users_mig RENAME TO users")
        console.log('[sqlite] Migrated users table to include company_admin role')
      })()
    }
  } catch (e) {
    console.error('[sqlite] Role migration failed:', e)
  }

  // Migration: Default Company for existing data
  const defaultCompany = db.prepare("SELECT * FROM companies WHERE id = 1").get()
  if (!defaultCompany) {
    const now = new Date().toISOString()
    // Check if we have users to migrate
    const userCount = db.prepare("SELECT count(*) as c FROM users").get().c
    if (userCount > 0) {
      console.log('[sqlite] Creating Default Company for existing users...')
      db.prepare("INSERT INTO companies (id, name, created_at) VALUES (1, 'Default Company', ?)").run(now)
      db.prepare("UPDATE users SET company_id = 1 WHERE company_id IS NULL").run()
      db.prepare("UPDATE organizations SET company_id = 1 WHERE company_id IS NULL").run()
    }
  }

  console.log('[sqlite] Using better-sqlite3 at', dbPath)
} catch (e) {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error(`better-sqlite3 is required in production. Install it and ensure build tools are available. Details: ${String(e?.message || e)}`)
  }
  console.info('[sqlite] better-sqlite3 not available; using JSON store for dev:', e?.message || e)
  for (const p of Object.values(fallbacks)) {
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]')
  }
  try {
    let arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
    let changed = false
    arr = arr.map(u => {
      if (String(u.email).toLowerCase() === 'admin@example.com') return u
      if (u.role === 'super_admin' && u.company_id != null) {
        changed = true
        return { ...u, role: 'company_admin' }
      }
      return u
    })
    if (changed) fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
  } catch {}
}

export { db }

export function getUserByEmail(email) {
  if (db) {
    const stmt = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) ORDER BY id DESC')
    return stmt.get(email)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const matches = arr.filter(u => String(u.email).toLowerCase() === String(email).toLowerCase())
  return matches.length > 0 ? matches[matches.length - 1] : undefined
}

export function listCompanies() {
  if (db) {
    return db.prepare('SELECT * FROM companies ORDER BY created_at DESC').all()
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  return arr
}

export function listUsersByCompany(company_id) {
  if (db) {
    return db.prepare('SELECT id, email, role, full_name, country, timezone, company_id FROM users WHERE company_id = ?').all(company_id)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  return arr.filter(u => u.company_id == company_id).map(u => ({ id: u.id, email: u.email, role: u.role, full_name: u.full_name, country: u.country, timezone: u.timezone, company_id: u.company_id }))
}

export function listAllUsers() {
  if (db) {
    return db.prepare('SELECT id, email, role, full_name, country, timezone, company_id FROM users').all()
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  return arr.map(u => ({ id: u.id, email: u.email, role: u.role, full_name: u.full_name, country: u.country, timezone: u.timezone, company_id: u.company_id }))
}

export function createCompany({ name }) {
  const now = new Date().toISOString()
  const activation_token = crypto.randomBytes(32).toString('hex')
  if (db) {
    const billing_email = arguments[0]?.billing_email || null
    const admin_contact_email = arguments[0]?.admin_contact_email || null
    const logo_url = arguments[0]?.logo_url || null
    const stmt = db.prepare('INSERT INTO companies (name, created_at, plan, credits, updated_at, billing_email, admin_contact_email, logo_url, is_active, activation_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
    const info = stmt.run(name, now, 'free', 0, now, billing_email, admin_contact_email, logo_url, activation_token)
    return { id: info.lastInsertRowid, name, created_at: now, plan: 'free', credits: 0, updated_at: now, billing_email, admin_contact_email, logo_url, is_active: 0, activation_token }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const billing_email = arguments[0]?.billing_email || null
  const admin_contact_email = arguments[0]?.admin_contact_email || null
  const logo_url = arguments[0]?.logo_url || null
  const record = { id, name, created_at: now, plan: 'free', credits: 0, updated_at: now, billing_email, admin_contact_email, logo_url, is_active: 0, activation_token }
  arr.push(record)
  fs.writeFileSync(fallbacks.companies, JSON.stringify(arr, null, 2))
  return record
}

export function activateCompany(token) {
  if (db) {
    const company = db.prepare('SELECT * FROM companies WHERE activation_token = ?').get(token)
    if (!company) return null
    db.prepare('UPDATE companies SET is_active = 1, activation_token = NULL WHERE id = ?').run(company.id)
    return { ...company, is_active: 1, activation_token: null }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  const idx = arr.findIndex(c => c.activation_token === token)
  if (idx < 0) return null
  arr[idx].is_active = 1
  arr[idx].activation_token = null
  fs.writeFileSync(fallbacks.companies, JSON.stringify(arr, null, 2))
  return arr[idx]
}

export function getCompanyById(id) {
  if (!id) return null
  if (db) {
    return db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  return arr.find(c => String(c.id) === String(id))
}

export function getNextInvoiceNo(company_id) {
  if (db) {
    const row = db.prepare('SELECT MAX(invoice_no) as max_no FROM invoices WHERE company_id = ?').get(company_id)
    return (row?.max_no || 0) + 1
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.transactions, 'utf-8'))
  return (arr.filter(t=>t.company_id==company_id).length || 0) + 1
}

export function createInvoice(record) {
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('INSERT INTO invoices (company_id, invoice_no, invoice_id, company_name, company_logo_url, billing_email, invoice_date, billing_period, line_items, subtotal_amount, tax_amount, total_amount, currency, payment_provider, payment_reference_id, payment_status, pdf_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const info = stmt.run(record.company_id, record.invoice_no, record.invoice_id, record.company_name || '', record.company_logo_url || '', record.billing_email || '', record.invoice_date, record.billing_period || '', JSON.stringify(record.line_items || []), record.subtotal_amount || 0, record.tax_amount || 0, record.total_amount || 0, record.currency || 'USD', record.payment_provider || '', record.payment_reference_id || '', record.payment_status || 'paid', record.pdf_path || '', now)
    return { id: info.lastInsertRowid, ...record, created_at: now }
  }
  const invFile = path.resolve(process.cwd(), DATA_DIR, 'invoices.sqlite.json')
  if (!fs.existsSync(invFile)) fs.writeFileSync(invFile, '[]')
  const arr = JSON.parse(fs.readFileSync(invFile, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const rec = { id, ...record, created_at: now }
  arr.push(rec)
  fs.writeFileSync(invFile, JSON.stringify(arr, null, 2))
  return rec
}

export function listInvoices(company_id) {
  if (db) {
    return db.prepare('SELECT invoice_id, invoice_date, total_amount, payment_status FROM invoices WHERE company_id = ? ORDER BY created_at DESC').all(company_id)
  }
  const invFile = path.resolve(process.cwd(), DATA_DIR, 'invoices.sqlite.json')
  if (!fs.existsSync(invFile)) return []
  const arr = JSON.parse(fs.readFileSync(invFile, 'utf-8'))
  return arr.filter(i => i.company_id == company_id).map(i => ({ invoice_id: i.invoice_id, invoice_date: i.invoice_date, total_amount: i.total_amount, payment_status: i.payment_status }))
}

export function getInvoiceByCompany(company_id, invoice_id) {
  if (db) {
    return db.prepare('SELECT * FROM invoices WHERE company_id = ? AND invoice_id = ? LIMIT 1').get(company_id, invoice_id)
  }
  const invFile = path.resolve(process.cwd(), DATA_DIR, 'invoices.sqlite.json')
  if (!fs.existsSync(invFile)) return null
  const arr = JSON.parse(fs.readFileSync(invFile, 'utf-8'))
  return arr.find(i => i.company_id == company_id && i.invoice_id === invoice_id) || null
}

export function recordEmployeeTempPassword(company_id, employee_email, temp_password) {
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('INSERT INTO employee_creds (company_id, employee_email, temp_password, created_at) VALUES (?, ?, ?, ?)')
    const info = stmt.run(company_id, employee_email, temp_password, now)
    return { id: info.lastInsertRowid, company_id, employee_email, temp_password, created_at: now }
  }
  const file = path.resolve(process.cwd(), DATA_DIR, 'employee_creds.sqlite.json')
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]')
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const rec = { id, company_id, employee_email, temp_password, created_at: now }
  arr.push(rec)
  fs.writeFileSync(file, JSON.stringify(arr, null, 2))
  return rec
}

export function updateEmployeeTempPassword(company_id, employee_email, new_password) {
  const now = new Date().toISOString()
  if (db) {
    // Find latest row for this employee and update password
    const latest = db.prepare('SELECT id FROM employee_creds WHERE company_id = ? AND employee_email = ? ORDER BY created_at DESC LIMIT 1').get(company_id, employee_email)
    if (latest) {
      db.prepare('UPDATE employee_creds SET temp_password = ?, created_at = ? WHERE id = ?').run(new_password, now, latest.id)
      return { id: latest.id, company_id, employee_email, temp_password: new_password, created_at: now }
    }
    // No existing row — insert new
    const stmt = db.prepare('INSERT INTO employee_creds (company_id, employee_email, temp_password, created_at) VALUES (?, ?, ?, ?)')
    const info = stmt.run(company_id, employee_email, new_password, now)
    return { id: info.lastInsertRowid, company_id, employee_email, temp_password: new_password, created_at: now }
  }
  const file = path.resolve(process.cwd(), DATA_DIR, 'employee_creds.sqlite.json')
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]')
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const existing = arr.filter(r => r.company_id == company_id && r.employee_email === employee_email)
  if (existing.length > 0) {
    // Update latest matching record
    const last = existing.sort((a, b) => a.id > b.id ? -1 : 1)[0]
    last.temp_password = new_password
    last.created_at = now
    fs.writeFileSync(file, JSON.stringify(arr, null, 2))
    return last
  }
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const rec = { id, company_id, employee_email, temp_password: new_password, created_at: now }
  arr.push(rec)
  fs.writeFileSync(file, JSON.stringify(arr, null, 2))
  return rec
}

export function listEmployeeTempPasswords(company_id) {
  if (db) {
    return db.prepare('SELECT employee_email, temp_password, created_at FROM employee_creds WHERE company_id = ? ORDER BY created_at DESC').all(company_id)
  }
  const file = path.resolve(process.cwd(), DATA_DIR, 'employee_creds.sqlite.json')
  if (!fs.existsSync(file)) return []
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8'))
  return arr.filter(r => r.company_id == company_id).map(r => ({ employee_email: r.employee_email, temp_password: r.temp_password, created_at: r.created_at }))
}

export function recordManagerTempPassword(company_id, manager_email, temp_password) {
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('INSERT INTO manager_creds (company_id, manager_email, temp_password, created_at) VALUES (?, ?, ?, ?)')
    const info = stmt.run(company_id, manager_email, temp_password, now)
    return { id: info.lastInsertRowid, company_id, manager_email, temp_password, created_at: now }
  }
  const file = path.resolve(process.cwd(), DATA_DIR, 'manager_creds.sqlite.json')
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]')
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const rec = { id, company_id, manager_email, temp_password, created_at: now }
  arr.push(rec)
  fs.writeFileSync(file, JSON.stringify(arr, null, 2))
  return rec
}

export function listManagerTempPasswords(company_id) {
  if (db) {
    return db.prepare('SELECT manager_email, temp_password, created_at FROM manager_creds WHERE company_id = ? ORDER BY created_at DESC').all(company_id)
  }
  const file = path.resolve(process.cwd(), DATA_DIR, 'manager_creds.sqlite.json')
  if (!fs.existsSync(file)) return []
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8'))
  return arr.filter(r => r.company_id == company_id).map(r => ({ manager_email: r.manager_email, temp_password: r.temp_password, created_at: r.created_at }))
}

export function deleteManagerTempPassword(managerEmail) {
  // Always delete from SQLite if available
  if (db) {
    db.prepare('DELETE FROM manager_creds WHERE manager_email = ?').run(managerEmail)
  }
  // Always delete from JSON fallback too
  const file = path.resolve(process.cwd(), DATA_DIR, 'manager_creds.sqlite.json')
  if (fs.existsSync(file)) {
    try {
      let arr = JSON.parse(fs.readFileSync(file, 'utf-8'))
      arr = arr.filter(r => r.manager_email !== managerEmail)
      fs.writeFileSync(file, JSON.stringify(arr, null, 2))
    } catch {}
  }
  return true
}

export function setInvoicePdfPath(company_id, invoice_id, pdf_path) {
  if (db) {
    const stmt = db.prepare('UPDATE invoices SET pdf_path = ? WHERE company_id = ? AND invoice_id = ?')
    stmt.run(pdf_path || '', company_id, invoice_id)
    return db.prepare('SELECT * FROM invoices WHERE company_id = ? AND invoice_id = ?').get(company_id, invoice_id)
  }
  const invFile = path.resolve(process.cwd(), DATA_DIR, 'invoices.sqlite.json')
  if (!fs.existsSync(invFile)) return null
  const arr = JSON.parse(fs.readFileSync(invFile, 'utf-8'))
  const idx = arr.findIndex(i => i.company_id == company_id && i.invoice_id === invoice_id)
  if (idx >= 0) {
    arr[idx].pdf_path = pdf_path || ''
    fs.writeFileSync(invFile, JSON.stringify(arr, null, 2))
    return arr[idx]
  }
  return null
}

export function updateCompanyProfile(company_id, { name, logo_url, billing_email, admin_contact_email }) {
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('UPDATE companies SET name = COALESCE(?, name), logo_url = COALESCE(?, logo_url), billing_email = COALESCE(?, billing_email), admin_contact_email = COALESCE(?, admin_contact_email), updated_at = ? WHERE id = ?')
    stmt.run(name || null, logo_url || null, billing_email || null, admin_contact_email || null, now, company_id)
    return db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  const idx = arr.findIndex(c => c.id == company_id)
  if (idx >= 0) {
    if (name) arr[idx].name = name
    if (logo_url) arr[idx].logo_url = logo_url
    if (billing_email) arr[idx].billing_email = billing_email
    if (admin_contact_email) arr[idx].admin_contact_email = admin_contact_email
    arr[idx].updated_at = now
    fs.writeFileSync(fallbacks.companies, JSON.stringify(arr, null, 2))
    return arr[idx]
  }
  return null
}

export function updateUserProfile(id, { full_name, email, country, timezone }) {
  if (db) {
    const stmt = db.prepare('UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), country = COALESCE(?, country), timezone = COALESCE(?, timezone) WHERE id = ?')
    stmt.run(full_name || null, email || null, country || null, timezone || null, id)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const idx = arr.findIndex(u => u.id == id)
  if (idx >= 0) {
    if (full_name) arr[idx].full_name = full_name
    if (email) arr[idx].email = email
    if (country) arr[idx].country = country
    if (timezone) arr[idx].timezone = timezone
    fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
    return arr[idx]
  }
  return null
}

export function createUser({ email, full_name, password, role, company_id, country, timezone }) {
  const hash = bcrypt.hashSync(password, 10)
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('INSERT INTO users (email, full_name, country, password_hash, role, created_at, company_id, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const info = stmt.run(email, full_name || '', country || '', hash, role, now, company_id || null, timezone || 'UTC')
    return { id: info.lastInsertRowid, email, full_name: full_name || '', country: country || '', role, created_at: now, company_id: company_id || null, timezone: timezone || 'UTC' }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const record = { id, email, full_name: full_name || '', country: country || '', password_hash: hash, role, created_at: now, company_id: company_id || null, timezone: timezone || 'UTC' }
  arr.push(record)
  fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
  return { id, email, full_name: full_name || '', country: country || '', role, created_at: now, company_id: company_id || null, timezone: timezone || 'UTC' }
}

export function verifyPassword(user, password) {
  if (!user) return false
  return bcrypt.compareSync(password, user.password_hash)
}

export function getSuperAdmin() {
  if (db) {
    const stmt = db.prepare("SELECT * FROM users WHERE role = 'super_admin' LIMIT 1")
    return stmt.get()
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  return arr.find(u => u.role === 'super_admin')
}

export function seedDefaultSuperAdmin() {
  const email = String(process.env.SUPERADMIN_EMAIL || 'admin@example.com').trim()
  const password = String(process.env.SUPERADMIN_PASSWORD || 'admin123')
  const shouldResetPassword = String(process.env.SUPERADMIN_RESET_PASSWORD || '').trim() === '1'

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    if (!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD) {
      throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in production')
    }
    if (password === 'admin123') {
      throw new Error('Refusing to use default super admin credentials in production')
    }
  }

  const normalize = (v) => String(v || '').trim().toLowerCase()
  const desiredEmailKey = normalize(email)

  const existingByEmail = getUserByEmail(email)

  if (db) {
    const tx = db.transaction(() => {
      if (existingByEmail) {
        db.prepare('UPDATE users SET role = ?, company_id = NULL WHERE lower(email) = lower(?)').run('super_admin', email)
        if (shouldResetPassword) {
          const hash = bcrypt.hashSync(password, 10)
          db.prepare('UPDATE users SET password_hash = ? WHERE lower(email) = lower(?)').run(hash, email)
        }
        return getUserByEmail(email)
      }

      const created = createUser({ email, password, role: 'super_admin', company_id: null })
      return created
    })
    return tx()
  }

  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const idx = arr.findIndex(u => normalize(u.email) === desiredEmailKey)
  if (idx >= 0) {
    const next = { ...arr[idx], role: 'super_admin', company_id: null }
    if (shouldResetPassword) {
      next.password_hash = bcrypt.hashSync(password, 10)
    }
    arr[idx] = next
    fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
    return next
  }

  return createUser({ email, password, role: 'super_admin', company_id: null })
}

export function createOrganization({ name, managerId, company_id }) {
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('INSERT INTO organizations (name, manager_id, created_at, company_id) VALUES (?, ?, ?, ?)')
    const info = stmt.run(name, managerId || null, now, company_id || null)
    return { id: info.lastInsertRowid, name, manager_id: managerId || null, created_at: now, company_id: company_id || null }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.orgs, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const record = { id, name, manager_id: managerId || null, created_at: now, company_id: company_id || null }
  arr.push(record)
  fs.writeFileSync(fallbacks.orgs, JSON.stringify(arr, null, 2))
  return record
}

export function getOrganizationByManagerId(managerId) {
  // Implicitly, managerId is unique, so this still works. 
  // We don't strictly need company_id here if manager belongs to one company.
  if (db) {
    let stmt = db.prepare('SELECT * FROM organizations WHERE manager_id = ? LIMIT 1')
    let org = stmt.get(managerId)
    if (!org && typeof managerId === 'string') {
      try {
        stmt = db.prepare('SELECT * FROM organizations WHERE manager_id = ? LIMIT 1')
        org = stmt.get(managerId)
      } catch {}
    }
    return org
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.orgs, 'utf-8'))
  return arr.find(o => o.manager_id === managerId || String(o.manager_id).toLowerCase() === String(managerId).toLowerCase())
}

export function listManagers(company_id) {
  if (db) {
    let sql = "SELECT id, email, full_name, role, created_at, company_id FROM users WHERE role = 'manager'"
    if (company_id) {
      sql += " AND company_id = ?"
      return db.prepare(sql).all(company_id)
    }
    return db.prepare(sql).all()
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  let res = arr.filter(u => u.role === 'manager')
  if (company_id) {
    res = res.filter(u => u.company_id == company_id)
  }
  return res.map(u => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, created_at: u.created_at, company_id: u.company_id }))
}

// Upsert an employee's password; creates the user if missing with role 'employee'
export function upsertEmployeePassword(email, password, company_id) {
  const hash = bcrypt.hashSync(password, 10)
  const now = new Date().toISOString()
  if (db) {
    const getStmt = db.prepare('SELECT * FROM users WHERE email = ?')
    const existing = getStmt.get(email)
    if (existing) {
      // Ensure company match if company_id is provided? 
      // Ideally yes, but email is unique. 
      // If user exists in another company, this would takeover? 
      // Multi-tenant systems usually don't allow same email in different tenants unless scoped by tenant. 
      // But 'email' is UNIQUE in schema. So user belongs to one company.
      // If existing.company_id != company_id, it's an error (user exists in another company).
      if (company_id && existing.company_id && existing.company_id != company_id) {
        throw new Error('User already exists in another company')
      }
      const upd = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?')
      upd.run(hash, email)
      return { id: existing.id, email, company_id: existing.company_id, timezone: existing.timezone || 'UTC' }
    }
    const ins = db.prepare('INSERT INTO users (email, password_hash, role, created_at, company_id, timezone) VALUES (?, ?, ?, ?, ?, ?)')
    const info = ins.run(email, hash, 'employee', now, company_id || null, 'UTC')
    return { id: info.lastInsertRowid, email, company_id: company_id || null, timezone: 'UTC' }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const idx = arr.findIndex(u => u.email === email)
  if (idx >= 0) {
    const existing = arr[idx]
    if (company_id && existing.company_id && existing.company_id != company_id) {
      throw new Error('User already exists in another company')
    }
    arr[idx].password_hash = hash
    fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
    return { id: arr[idx].id, email, company_id: existing.company_id, timezone: existing.timezone || 'UTC' }
  }
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const record = { id, email, password_hash: hash, role: 'employee', created_at: now, company_id: company_id || null, timezone: 'UTC' }
  arr.push(record)
  fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
  return { id, email, company_id: company_id || null, timezone: 'UTC' }
}

// Delete helpers
export function deleteUserById(id) {
  if (db) {
    const del = db.prepare("DELETE FROM users WHERE id = ?")
    const info = del.run(id)
    return info.changes > 0
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const next = arr.filter(u => String(u.id) !== String(id))
  const changed = next.length !== arr.length
  if (changed) fs.writeFileSync(fallbacks.users, JSON.stringify(next, null, 2))
  return changed
}

export function deleteUserByEmail(email) {
  if (db) {
    const del = db.prepare("DELETE FROM users WHERE lower(email) = lower(?)")
    const info = del.run(email)
    return info.changes > 0
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const next = arr.filter(u => String(u.email).toLowerCase() !== String(email).toLowerCase())
  const changed = next.length !== arr.length
  if (changed) fs.writeFileSync(fallbacks.users, JSON.stringify(next, null, 2))
  return changed
}

export function deleteOrganizationByManagerId(managerId) {
  if (db) {
    const del = db.prepare('DELETE FROM organizations WHERE manager_id = ?')
    const info = del.run(managerId)
    return info.changes > 0
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.orgs, 'utf-8'))
  const next = arr.filter(o => String(o.manager_id) !== String(managerId))
  const changed = next.length !== arr.length
  if (changed) fs.writeFileSync(fallbacks.orgs, JSON.stringify(next, null, 2))
  return changed
}

export function createTransaction({ company_id, amount, credits, type, description, reference_id, status }) {
  const now = new Date().toISOString()
  if (db) {
    const stmt = db.prepare('INSERT INTO transactions (company_id, amount, credits, type, description, reference_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const info = stmt.run(company_id, amount, credits, type, description || '', reference_id || '', status || 'success', now)
    return { id: info.lastInsertRowid, company_id, amount, credits, type, description, reference_id, status, created_at: now }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.transactions, 'utf-8'))
  const id = (arr[arr.length - 1]?.id || 0) + 1
  const record = { id, company_id, amount, credits, type, description, reference_id, status: status || 'success', created_at: now }
  arr.push(record)
  fs.writeFileSync(fallbacks.transactions, JSON.stringify(arr, null, 2))
  return record
}

export function getTransactions(company_id) {
  if (db) {
    return db.prepare('SELECT * FROM transactions WHERE company_id = ? ORDER BY created_at DESC').all(company_id)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.transactions, 'utf-8'))
  return arr.filter(t => t.company_id == company_id).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getTransactionByReferenceId(company_id, reference_id) {
  const cid = Number(company_id)
  const ref = String(reference_id || '')
  if (!cid || !ref) return null
  if (db) {
    return db.prepare('SELECT * FROM transactions WHERE company_id = ? AND reference_id = ? LIMIT 1').get(cid, ref) || null
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.transactions, 'utf-8'))
  return arr.find(t => t.company_id == cid && String(t.reference_id || '') === ref) || null
}

export function markWebhookEventProcessed({ provider, event_id, company_id, reference_id }) {
  const now = new Date().toISOString()
  const prov = String(provider || '').trim()
  const eid = String(event_id || '').trim()
  if (!prov || !eid) return false

  if (db) {
    const stmt = db.prepare('INSERT OR IGNORE INTO webhook_events (provider, event_id, company_id, reference_id, created_at) VALUES (?, ?, ?, ?, ?)')
    const info = stmt.run(prov, eid, company_id || null, String(reference_id || ''), now)
    return info.changes > 0
  }

  if (!globalThis.__webhookEvents) globalThis.__webhookEvents = new Set()
  const key = `${prov}:${eid}`
  if (globalThis.__webhookEvents.has(key)) return false
  globalThis.__webhookEvents.add(key)
  return true
}

export function listWebhookEvents({ provider, company_id, limit }) {
  const prov = String(provider || '').trim()
  const cid = company_id == null ? null : Number(company_id)
  const lim = Math.max(1, Math.min(50, Number(limit || 10)))
  if (!prov || !db) return []
  try {
    if (cid != null && Number.isFinite(cid)) {
      return db.prepare('SELECT provider, event_id, company_id, reference_id, created_at FROM webhook_events WHERE provider = ? AND company_id = ? ORDER BY created_at DESC LIMIT ?').all(prov, cid, lim)
    }
    return db.prepare('SELECT provider, event_id, company_id, reference_id, created_at FROM webhook_events WHERE provider = ? ORDER BY created_at DESC LIMIT ?').all(prov, lim)
  } catch {
    return []
  }
}

export function updateCompanyCredits(company_id, delta) {
  if (db) {
    const tx = db.transaction((cid, d) => {
      const cur = db.prepare('SELECT credits FROM companies WHERE id = ?').get(cid)
      const next = Math.max(0, (cur?.credits || 0) + d)
      db.prepare('UPDATE companies SET credits = ? WHERE id = ?').run(next, cid)
      return next
    })
    return tx(company_id, delta)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  const idx = arr.findIndex(c => c.id == company_id)
  if (idx >= 0) {
    const cur = arr[idx].credits || 0
    arr[idx].credits = Math.max(0, cur + delta)
    fs.writeFileSync(fallbacks.companies, JSON.stringify(arr, null, 2))
    return arr[idx].credits
  }
  return 0
}

export function creditCompanyWithTransaction({ company_id, amount_usd, credits, description, reference_id }) {
  const now = new Date().toISOString()
  if (db) {
    const tx = db.transaction(() => {
      const upd = db.prepare(`UPDATE companies SET credits = credits + ?, plan = CASE WHEN ? > 0 THEN 'pro' ELSE plan END, updated_at = ? WHERE id = ?`)
      upd.run(credits, credits, now, company_id)
      const ins = db.prepare('INSERT INTO transactions (company_id, amount, credits, type, description, reference_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      ins.run(company_id, amount_usd, credits, 'credit', description || '', reference_id || '', 'success', now)
      const row = db.prepare('SELECT credits FROM companies WHERE id = ?').get(company_id)
      return row?.credits || 0
    })
    return tx()
  }
  // JSON fallback
  const companies = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  const cidx = companies.findIndex(c => c.id == company_id)
  if (cidx >= 0) {
    companies[cidx].credits = (companies[cidx].credits || 0) + credits
    if (credits > 0) companies[cidx].plan = 'pro'
    companies[cidx].updated_at = now
    fs.writeFileSync(fallbacks.companies, JSON.stringify(companies, null, 2))
  }
  const txs = JSON.parse(fs.readFileSync(fallbacks.transactions, 'utf-8'))
  const id = (txs[txs.length - 1]?.id || 0) + 1
  const record = { id, company_id, amount: amount_usd, credits, type: 'credit', description: description || '', reference_id: reference_id || '', status: 'success', created_at: now }
  txs.push(record)
  fs.writeFileSync(fallbacks.transactions, JSON.stringify(txs, null, 2))
  return companies[cidx]?.credits || 0
}

export function applyStripeCheckoutCreditsOnce({ company_id, user_id, session_id, amount_usd, credits, reference_id }) {
  const now = new Date().toISOString()
  const cid = Number(company_id)
  const sid = String(session_id || '').trim()
  const c = Number(credits)
  const amt = Number(amount_usd)
  const ref = String(reference_id || '').trim() || `stripe:${sid}`

  if (!cid || !sid || !Number.isInteger(c) || c <= 0) {
    throw new Error('invalid_stripe_credit_payload')
  }

  if (db) {
    const tx = db.transaction(() => {
      const ins = db.prepare('INSERT OR IGNORE INTO stripe_processed_sessions (session_id, company_id, user_id, credits, amount_usd, reference_id, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      const info = ins.run(sid, cid, user_id || null, c, Number.isFinite(amt) ? amt : c, ref, now)

      if (info.changes === 0) {
        const row = db.prepare('SELECT credits FROM companies WHERE id = ?').get(cid)
        return { applied: false, credits: Number(row?.credits || 0) }
      }

      db.prepare(`UPDATE companies SET credits = credits + ?, plan = CASE WHEN ? > 0 THEN 'pro' ELSE plan END, updated_at = ? WHERE id = ?`)
        .run(c, c, now, cid)

      db.prepare('INSERT INTO transactions (company_id, amount, credits, type, description, reference_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(cid, Number.isFinite(amt) ? amt : c, c, 'credit', 'Credit purchase via Stripe (webhook)', ref, 'success', now)

      const row = db.prepare('SELECT credits FROM companies WHERE id = ?').get(cid)
      return { applied: true, credits: Number(row?.credits || 0) }
    })

    return tx()
  }

  if (!fs.existsSync(fallbacks.stripe_sessions)) fs.writeFileSync(fallbacks.stripe_sessions, '[]')
  const sessions = JSON.parse(fs.readFileSync(fallbacks.stripe_sessions, 'utf-8'))
  const key = `${cid}:${sid}`
  if (sessions.some(r => String(r.key) === key)) {
    const company = getCompanyById(cid)
    return { applied: false, credits: Number(company?.credits || 0) }
  }

  sessions.push({ key, company_id: cid, user_id: user_id || null, session_id: sid, credits: c, amount_usd: Number.isFinite(amt) ? amt : c, reference_id: ref, processed_at: now })
  fs.writeFileSync(fallbacks.stripe_sessions, JSON.stringify(sessions, null, 2))

  const newBalance = creditCompanyWithTransaction({ company_id: cid, amount_usd: Number.isFinite(amt) ? amt : c, credits: c, description: 'Credit purchase via Stripe (webhook)', reference_id: ref })
  return { applied: true, credits: Number(newBalance || 0) }
}

export function debitCompanyWithTransaction({ company_id, amount_usd, credits, description, reference_id }) {
  const now = new Date().toISOString()
  const cost = Math.abs(Number(credits || 0))
  if (cost <= 0) return getCompanyById(company_id)?.credits || 0

  if (db) {
    const tx = db.transaction(() => {
      const cur = db.prepare('SELECT credits FROM companies WHERE id = ?').get(company_id)
      const curCredits = Number(cur?.credits || 0)
      if (curCredits < cost) {
        const err = new Error('insufficient_credits')
        err.code = 'INSUFFICIENT_CREDITS'
        throw err
      }
      db.prepare('UPDATE companies SET credits = credits - ?, updated_at = ? WHERE id = ?').run(cost, now, company_id)
      db.prepare('INSERT INTO transactions (company_id, amount, credits, type, description, reference_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(company_id, Number(amount_usd || cost), -cost, 'debit', description || '', reference_id || '', 'success', now)
      return Number(db.prepare('SELECT credits FROM companies WHERE id = ?').get(company_id)?.credits || 0)
    })
    return tx()
  }

  const companies = JSON.parse(fs.readFileSync(fallbacks.companies, 'utf-8'))
  const idx = companies.findIndex(c => c.id == company_id)
  const curCredits = Number(companies[idx]?.credits || 0)
  if (idx < 0 || curCredits < cost) {
    const err = new Error('insufficient_credits')
    err.code = 'INSUFFICIENT_CREDITS'
    throw err
  }
  companies[idx].credits = curCredits - cost
  companies[idx].updated_at = now
  fs.writeFileSync(fallbacks.companies, JSON.stringify(companies, null, 2))
  createTransaction({ company_id, amount: Number(amount_usd || cost), credits: -cost, type: 'debit', description, reference_id, status: 'success' })
  return companies[idx].credits
}

function addDaysIso(iso, days) {
  const base = new Date(iso)
  return new Date(base.getTime() + Number(days || 0) * 86400000).toISOString()
}

export function ensureEmployeeBillingSchedule({ company_id, employee_id, start_at }) {
  const createdAt = start_at || new Date().toISOString()
  const next = addDaysIso(createdAt, 30)
  if (db) {
    const stmt = db.prepare('INSERT OR REPLACE INTO employee_billing (company_id, employee_id, next_charge_at, last_charge_at, created_at) VALUES (?, ?, ?, ?, ?)')
    stmt.run(company_id, employee_id, next, createdAt, createdAt)
    return { company_id, employee_id, next_charge_at: next, last_charge_at: createdAt, created_at: createdAt }
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.employee_billing, 'utf-8'))
  const idx = arr.findIndex(r => r.employee_id == employee_id)
  const record = { company_id, employee_id, next_charge_at: next, last_charge_at: createdAt, created_at: createdAt }
  if (idx >= 0) arr[idx] = record
  else arr.push(record)
  fs.writeFileSync(fallbacks.employee_billing, JSON.stringify(arr, null, 2))
  return record
}

export function ensureEmployeeBillingForCompany(company_id) {
  const now = new Date().toISOString()
  if (db) {
    const employees = db.prepare("SELECT id, created_at FROM users WHERE company_id = ? AND role = 'employee'").all(company_id)
    const existing = new Set(db.prepare('SELECT employee_id FROM employee_billing WHERE company_id = ?').all(company_id).map(r => r.employee_id))
    const ins = db.prepare('INSERT INTO employee_billing (company_id, employee_id, next_charge_at, last_charge_at, created_at) VALUES (?, ?, ?, ?, ?)')
    for (const e of employees) {
      if (existing.has(e.id)) continue
      const createdAt = e.created_at || now
      ins.run(company_id, e.id, addDaysIso(createdAt, 30), createdAt, createdAt)
    }
    return true
  }
  const employees = listUsersByCompany(company_id).filter(u => u.role === 'employee')
  const arr = JSON.parse(fs.readFileSync(fallbacks.employee_billing, 'utf-8'))
  const existing = new Set(arr.filter(r => r.company_id == company_id).map(r => r.employee_id))
  let changed = false
  for (const e of employees) {
    if (existing.has(e.id)) continue
    const createdAt = e.created_at || now
    arr.push({ company_id, employee_id: e.id, next_charge_at: addDaysIso(createdAt, 30), last_charge_at: createdAt, created_at: createdAt })
    changed = true
  }
  if (changed) fs.writeFileSync(fallbacks.employee_billing, JSON.stringify(arr, null, 2))
  return true
}

export function listDueEmployeeBillingsForCompany(company_id, as_of_iso) {
  const asOf = as_of_iso || new Date().toISOString()
  if (db) {
    return db.prepare(`
      SELECT eb.employee_id, eb.next_charge_at, u.email
      FROM employee_billing eb
      JOIN users u ON u.id = eb.employee_id
      WHERE eb.company_id = ? AND u.role = 'employee' AND eb.next_charge_at <= ?
      ORDER BY eb.next_charge_at ASC
    `).all(company_id, asOf)
  }
  const eb = JSON.parse(fs.readFileSync(fallbacks.employee_billing, 'utf-8'))
  const employees = listUsersByCompany(company_id).filter(u => u.role === 'employee')
  const byId = new Map(employees.map(e => [e.id, e]))
  return eb
    .filter(r => r.company_id == company_id && byId.has(r.employee_id) && String(r.next_charge_at) <= String(asOf))
    .map(r => ({ employee_id: r.employee_id, next_charge_at: r.next_charge_at, email: byId.get(r.employee_id)?.email }))
    .sort((a, b) => String(a.next_charge_at).localeCompare(String(b.next_charge_at)))
}

export function setEmployeeBillingNextCharge(employee_id, next_charge_at, last_charge_at) {
  const next = next_charge_at || new Date().toISOString()
  const last = last_charge_at || new Date().toISOString()
  if (db) {
    db.prepare('UPDATE employee_billing SET next_charge_at = ?, last_charge_at = ? WHERE employee_id = ?').run(next, last, employee_id)
    return true
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.employee_billing, 'utf-8'))
  const idx = arr.findIndex(r => r.employee_id == employee_id)
  if (idx >= 0) {
    arr[idx].next_charge_at = next
    arr[idx].last_charge_at = last
    fs.writeFileSync(fallbacks.employee_billing, JSON.stringify(arr, null, 2))
    return true
  }
  return false
}

// ---- Time Requests ----

export function createTimeRequest(data) {
  const now = new Date().toISOString();
  if (db) {
    const { company_id, employee_id, date, start_time, end_time, timezone = null, start_utc = null, end_utc = null, reason } = data;
    const stmt = db.prepare('INSERT INTO time_requests (company_id, employee_id, date, start_time, end_time, timezone, start_utc, end_utc, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(company_id, employee_id, date, start_time, end_time, timezone, start_utc, end_utc, reason, now);
    return { id: info.lastInsertRowid, ...data, status: 'pending', created_at: now };
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.requests, 'utf-8'));
  const id = (arr[arr.length - 1]?.id || 0) + 1;
  const record = { id, ...data, status: 'pending', created_at: now };
  arr.push(record);
  fs.writeFileSync(fallbacks.requests, JSON.stringify(arr, null, 2));
  return record;
}

export function getTimeRequests(company_id, employee_id = null) {
  if (db) {
    let sql = 'SELECT * FROM time_requests WHERE company_id = ?';
    const params = [company_id];
    if (employee_id) {
      sql += ' AND employee_id = ?';
      params.push(employee_id);
    }
    sql += ' ORDER BY created_at DESC';
    return db.prepare(sql).all(...params);
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.requests, 'utf-8'));
  return arr.filter(r => r.company_id == company_id && (!employee_id || r.employee_id == employee_id))
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function updateUserTimezone(email, timezone) {
  if (db) {
    const stmt = db.prepare('UPDATE users SET timezone = ? WHERE email = ?')
    stmt.run(timezone, email)
    return db.prepare('SELECT id, email, role, company_id, timezone, created_at FROM users WHERE email = ?').get(email)
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
  const idx = arr.findIndex(u => String(u.email).toLowerCase() === String(email).toLowerCase())
  if (idx >= 0) {
    arr[idx].timezone = timezone
    fs.writeFileSync(fallbacks.users, JSON.stringify(arr, null, 2))
    const u = arr[idx]
    return { id: u.id, email: u.email, role: u.role, company_id: u.company_id, timezone: u.timezone, created_at: u.created_at }
  }
  return null
}

export function updateTimeRequestStatus(id, status, action_by) {
  const now = new Date().toISOString();
  if (db) {
    const stmt = db.prepare('UPDATE time_requests SET status = ?, action_by = ?, action_at = ? WHERE id = ?');
    stmt.run(status, action_by, now, id);
    return db.prepare('SELECT * FROM time_requests WHERE id = ?').get(id);
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.requests, 'utf-8'));
  const idx = arr.findIndex(r => r.id == id);
  if (idx >= 0) {
    arr[idx].status = status;
    arr[idx].action_by = action_by;
    arr[idx].action_at = now;
    fs.writeFileSync(fallbacks.requests, JSON.stringify(arr, null, 2));
    return arr[idx];
  }
  return null;
}

export function getTimeRequestById(id) {
  if (db) {
    return db.prepare('SELECT * FROM time_requests WHERE id = ?').get(id);
  }
  const arr = JSON.parse(fs.readFileSync(fallbacks.requests, 'utf-8'));
  return arr.find(r => r.id == id);
}

// Helper to get work sessions (currently reads from JSON directly in server.js but good to have here)
// For now, we return null as the server.js logic for work sessions is file-based and complex
export function getWorkSessions(userId, date) {
  // Placeholder implementation to satisfy export
  return [];
}

export function createPasswordResetToken(email) {
  const token = crypto.randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString() // 1 hour
  const createdAt = now.toISOString()

  if (db) {
    // Invalidate old tokens
    db.prepare('DELETE FROM password_reset_tokens WHERE email = ?').run(email)
    const stmt = db.prepare('INSERT INTO password_reset_tokens (email, token, expires_at, created_at) VALUES (?, ?, ?, ?)')
    stmt.run(email, token, expiresAt, createdAt)
  } else {
    if (!fs.existsSync(fallbacks.reset_tokens)) fs.writeFileSync(fallbacks.reset_tokens, '[]')
    let arr = JSON.parse(fs.readFileSync(fallbacks.reset_tokens, 'utf-8'))
    // Remove old tokens
    arr = arr.filter(t => t.email !== email)
    arr.push({ email, token, expires_at: expiresAt, created_at: createdAt })
    fs.writeFileSync(fallbacks.reset_tokens, JSON.stringify(arr, null, 2))
  }
  return token
}

export function verifyResetToken(token) {
  if (!token) return null
  const now = new Date().toISOString()
  
  if (db) {
    const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > ?').get(token, now)
    return row ? row.email : null
  }
  
  if (!fs.existsSync(fallbacks.reset_tokens)) return null
  const arr = JSON.parse(fs.readFileSync(fallbacks.reset_tokens, 'utf-8'))
  const row = arr.find(t => t.token === token && t.expires_at > now)
  return row ? row.email : null
}

export function resetPassword(token, newPassword) {
  const email = verifyResetToken(token)
  if (!email) return false
  
  const hash = bcrypt.hashSync(newPassword, 10)
  
  // Update user password
  if (db) {
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email)
      db.prepare('DELETE FROM password_reset_tokens WHERE email = ?').run(email)
    })()
  } else {
    // JSON fallback
    const users = JSON.parse(fs.readFileSync(fallbacks.users, 'utf-8'))
    const uIdx = users.findIndex(u => u.email === email)
    if (uIdx >= 0) {
      users[uIdx].password_hash = hash
      fs.writeFileSync(fallbacks.users, JSON.stringify(users, null, 2))
    }
    
    // Remove token
    if (fs.existsSync(fallbacks.reset_tokens)) {
      let tokens = JSON.parse(fs.readFileSync(fallbacks.reset_tokens, 'utf-8'))
      tokens = tokens.filter(t => t.email !== email)
      fs.writeFileSync(fallbacks.reset_tokens, JSON.stringify(tokens, null, 2))
    }
  }
  return true
}
