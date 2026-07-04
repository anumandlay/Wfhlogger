import Stripe from 'stripe'

let stripe = null

export function initStripe() {
  if (stripe) return stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY missing')
  
  // Configure Stripe with proper timeouts for production
  stripe = new Stripe(key, {
    timeout: 30000, // 30 second timeout
    maxNetworkRetries: 3, // Retry failed requests 3 times
    apiVersion: '2023-10-16' // Use stable API version
  })
  
  // Log key type for debugging (test vs live)
  if (key.startsWith('sk_test_')) {
    console.log('[stripe] Using TEST key - this is for development/testing only')
  } else if (key.startsWith('sk_live_')) {
    console.log('[stripe] Using LIVE key - production mode')
  }
  
  return stripe
}

function normalizeReturnPath(return_path) {
  const raw = String(return_path || '').trim()
  if (!raw) return '/billing'
  if (raw.startsWith('http://') || raw.startsWith('https://')) return '/billing'
  if (!raw.startsWith('/')) return '/billing'
  return raw
}

function buildReturnUrl({ baseOrigin, return_path, status }) {
  const base = (baseOrigin || '').startsWith('http')
    ? baseOrigin
    : (process.env.SUCCESS_URL || process.env.CANCEL_URL || 'http://localhost:5173')

  const safePath = normalizeReturnPath(return_path)
  const idx = safePath.indexOf('?')
  const pathname = idx >= 0 ? safePath.slice(0, idx) : safePath
  const search = idx >= 0 ? safePath.slice(idx) : ''

  const u = new URL(base)
  u.pathname = pathname || '/billing'
  u.search = search || ''
  u.searchParams.set('status', status)
  return u.toString()
}

export async function createStripeCheckoutSession({ company_id, user_id, creditAmount, origin, return_path }) {
  const s = initStripe()
  const success = (() => {
    // Build URL manually — URLSearchParams encodes { } which Stripe won't recognize
    const base = buildReturnUrl({ baseOrigin: origin, return_path, status: 'success' })
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}session_id={CHECKOUT_SESSION_ID}`
  })()
  const cancel = buildReturnUrl({ baseOrigin: origin, return_path, status: 'cancel' })
  const qty = Number(creditAmount)
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid creditAmount')
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Company Credits' },
        unit_amount: qty * 100,
      },
      quantity: 1,
    }],
    success_url: success,
    cancel_url: cancel,
    client_reference_id: String(user_id || company_id || ''),
    metadata: {
      companyId: String(company_id || ''),
      userId: String(user_id || ''),
      creditAmount: String(qty),
      credits: String(qty),
    }
  })
  return session.url
}

export function verifyStripeWebhookAndExtract(rawBody, signature) {
  const s = initStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing')
  if (!signature) throw new Error('stripe-signature missing')
  return s.webhooks.constructEvent(rawBody, signature, secret)
}

export async function retrieveCheckoutSession(sessionId) {
  const s = initStripe()
  return s.checkout.sessions.retrieve(sessionId)
}

export async function listRecentCheckoutSessions({ company_id, limit = 10 }) {
  const s = initStripe()
  // Search for sessions with matching companyId metadata, created in last 2 hours
  const twoHoursAgo = Math.floor((Date.now() - 2 * 3600 * 1000) / 1000)
  const sessions = await s.checkout.sessions.list({
    limit,
    created: { gte: twoHoursAgo },
    expand: ['data.payment_intent'],
  })
  // Filter to sessions matching this company
  return sessions.data.filter(session => {
    const meta = session.metadata || {}
    return String(meta.companyId || meta.company_id || '') === String(company_id)
  })
}
