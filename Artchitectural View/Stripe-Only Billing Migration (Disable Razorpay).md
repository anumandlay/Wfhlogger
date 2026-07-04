## Objectives
- Migrate billing to Stripe Checkout (USD) as the sole provider
- Temporarily disable Razorpay without deleting code (imports, routes, UI references commented/deactivated)
- Keep credits updated via Stripe webhook only; no frontend-side credit mutations
- Maintain strict company_id scoping and admin-only access; preserve monthly deduction cron and existing credit rules

## Environment & Secrets
- Backend-only environment vars (never exposed to frontend):
  - STRIPE_SECRET_KEY
  - STRIPE_PUBLISHABLE_KEY (not used by Checkout flow, kept server-side)
  - STRIPE_WEBHOOK_SECRET (new, required for signature verification)
- Add to backend .env and load via dotenv; ensure keys are consumed only in backend modules
- Optional: PAYMENT_PROVIDER=stripe (feature flag), STRIPE_MODE=test|live for future toggling

## Backend Changes
### 1) Deactivate Razorpay (non-destructive)
- Comment out Razorpay imports (server.js, payment.js)
- Comment or guard Razorpay routes/controllers behind PAYMENT_PROVIDER flag
- Comment UI references returned by backend (if any) to avoid surfacing Razorpay client code

### 2) Stripe Service Module
- Create modular stripe service (e.g., backend/src/payments/stripe.js):
  - initStripe(): instantiate Stripe with STRIPE_SECRET_KEY
  - createCheckoutSession({ company_id, admin_user_id, credit_amount_usd }):
    - mode: 'payment', currency: 'usd'
    - line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Company Credits' }, unit_amount: credit_amount_usd*100 }, quantity: 1 }]
    - success_url / cancel_url: from env or infer request origin
    - metadata: { company_id, admin_user_id, credit_amount_usd }
    - return session.url

### 3) Admin API Endpoint
- POST /api/billing/stripe/checkout-session (requireRole(['super_admin']))
  - Input: { amount_usd: number }
  - Validate company context: req.user.company_id
  - Call createCheckoutSession and return { url }
  - Do not update credits on this endpoint

### 4) Webhook Endpoint
- POST /api/webhooks/stripe (raw body parser for signature verification)
  - Verify signature using STRIPE_WEBHOOK_SECRET
  - On event type 'checkout.session.completed':
    - Extract metadata: company_id, admin_user_id, credit_amount_usd
    - Compute credits purchased (1 USD == 1 credit, or configurable mapping)
    - Update company credits via updateCompanyCredits(company_id, +credits)
    - Persist transaction: amount, currency, Stripe session ID, payment_intent, company_id, status=success
    - Append billing log (audit) with company_id scoping
    - Trigger payment confirmation email using existing SMTP flow
  - Idempotency: store session.id processed set; skip duplicates

### 5) Access Control & Isolation
- All billing endpoints require admin (super_admin) and are strictly scoped by req.user.company_id
- Preserve existing manager/employee logic; no changes to RBAC for non-admin

### 6) Data Model & Cron
- Reuse existing transactions table and company credits functions
- Keep monthly subscription cron (`node-cron`) unchanged; Stripe adds credits, cron deducts $1/employee/month as before

## Frontend Changes
- Reuse existing “Add Credits” modal (Billing page)
- On submit:
  - Call POST /api/billing/stripe/checkout-session with amount_usd
  - Redirect to returned Stripe session URL (window.location.href)
- Remove Razorpay client init calls; comment out Razorpay-specific UI code without changing layout/design
- No Stripe publishable key exposure; Checkout URL from backend is sufficient

## Modularity & Future-Ready
- Introduce PAYMENT_PROVIDER env usage so switching providers is a config change
- Detect test/live by STRIPE_SECRET_KEY prefix (sk_test vs sk_live) or STRIPE_MODE
- Encapsulate provider-specific logic in payments/stripe.js; preserve payment.js for legacy Razorpay

## Security
- Never send STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY to the browser
- Validate webhook signature and restrict routes by role
- Keep CORS origins restricted
- Log auditable entries with company_id for all billing operations

## Migration Steps
1. Add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET to backend .env
2. Comment/guard Razorpay imports, routes, and server-side UI references
3. Add payments/stripe.js, admin Checkout endpoint, and webhook endpoint
4. Update Billing modal to call the new endpoint, then redirect to session URL
5. Test with Stripe test keys and Stripe CLI for webhook events
6. Switch to live keys when ready

## Testing
- Unit: session creation validates amount conversion and metadata
- Integration: Stripe CLI to send checkout.session.completed to webhook; verify company credits, transactions, and email
- Access: ensure only admin can generate sessions; employee/manager forbidden
- Regression: monthly cron still deducts credits; billing history endpoint shows Stripe transactions

## Rollback Plan
- Set PAYMENT_PROVIDER=razorpay to re-enable legacy (uncomment when needed)
- Keep Stripe module isolated; no DB schema changes

## Files to Touch (Indicative)
- backend/src/server.js (routes, guards)
- backend/src/payments/stripe.js (new)
- backend/src/payment.js (Razorpay code commented/flagged)
- web/src/pages/Billing.jsx (modal submit handler)
- backend/.env (new vars)