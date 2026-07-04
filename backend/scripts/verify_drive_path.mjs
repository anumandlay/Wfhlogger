import fs from 'fs'
import crypto from 'crypto'

function loadDotEnv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim()
      if (!s || s.startsWith('#')) continue
      const idx = s.indexOf('=')
      if (idx < 0) continue
      const key = s.slice(0, idx).trim()
      const val = s.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}

loadDotEnv('.env')

const dataDir = 'data'
const shotsPath = `${dataDir}/screenshots.drive.json`
const tokensPath = `${dataDir}/drive_tokens.json`

const shots = JSON.parse(fs.readFileSync(shotsPath, 'utf8'))
if (!shots.length) {
  console.log('No drive screenshots in metadata')
  process.exit(0)
}

const last = shots[shots.length - 1]
const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'))
const rec = tokens.find(t => t.employee_id === last.employee_id && String(t.company_id) === String(last.company_id))
if (!rec) {
  console.log('No drive token record found for employee')
  process.exit(1)
}

const DRIVE_TOKEN_KEY = process.env.DRIVE_TOKEN_KEY || ''
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
if (!DRIVE_TOKEN_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.log('Missing env vars: DRIVE_TOKEN_KEY / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  process.exit(1)
}

function aeadDecrypt(b64) {
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.slice(0, 12)
  const tag = buf.slice(12, 28)
  const enc = buf.slice(28)
  const key = crypto.createHash('sha256').update(DRIVE_TOKEN_KEY).digest()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}

const refresh = aeadDecrypt(rec.enc_refresh_token)
const body = new URLSearchParams({
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET,
  refresh_token: refresh,
  grant_type: 'refresh_token',
})
const tr = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
})
const tj = await tr.json()
if (!tr.ok) {
  console.log('Token refresh failed', tr.status, tj)
  process.exit(1)
}
const access = tj.access_token

async function driveGet(id) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,parents`, {
    headers: { Authorization: `Bearer ${access}` },
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`drive_get_failed_${r.status}`)
  return j
}

let cur = await driveGet(last.drive_file_id)
console.log('File:', cur.name, cur.id)
let steps = 0
while (cur.parents && cur.parents.length && steps < 12) {
  const pid = cur.parents[0]
  const p = await driveGet(pid)
  console.log('Parent:', p.name)
  cur = p
  steps++
}
