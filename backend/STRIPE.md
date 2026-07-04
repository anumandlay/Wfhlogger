# Stripe (Production-Safe Credits)

This backend applies credits **only** from the Stripe webhook. The frontend success page should only refresh `/api/billing/balance`.

## Localhost (Test Keys + Stripe CLI)

1) Create your local env file:

- Copy `backend/.env.development.example` → `backend/.env.development`
- Set:
  - `STRIPE_SECRET_KEY` (test secret key)
  - `STRIPE_WEBHOOK_SECRET` (from Stripe CLI)

2) Run backend:

```bash
cd backend
npm run dev
```

3) Login to Stripe CLI and forward webhooks (use your backend port):

```bash
stripe login
stripe listen --forward-to http://localhost:4000/api/webhooks/stripe
```

The CLI prints a webhook signing secret like:

`whsec_...`

Put that value into `backend/.env.development` as `STRIPE_WEBHOOK_SECRET`.

4) Trigger a test checkout:

- In your app, start a checkout via `/api/billing/stripe/checkout-session`
- Pay using a Stripe test card (e.g. `4242 4242 4242 4242`)

5) Verify credits changed:

- App UI should refresh balance.
- Backend logs should show:
  - `[stripe:webhook] received ... checkout.session.completed`
  - `[stripe:webhook] credits added ...`

To verify the DB directly (SQLite):

- `data/time_tracker.db`
  - `companies.credits` should increase
  - `transactions` should have a `Credit purchase via Stripe (webhook)` row
  - `stripe_processed_sessions` should contain the `session_id`

## Why `/confirm-session` Is Unnecessary

`/confirm-session` is a common anti-pattern for credits/subscription fulfillment:

- The browser redirect can be blocked, retried, or skipped.
- The customer can close the tab.
- Any frontend-driven fulfillment can be spoofed.

Stripe webhooks are the server-to-server source of truth. The checkout success page should only display “processing” and poll `/api/billing/balance`.

## Production Checklist

### 1) Prepare Live Mode in Stripe

- Stripe Dashboard → Developers → API keys
  - Copy `sk_live_...` (server)
  - Keep `pk_live_...` (only needed if you ever embed Stripe.js; hosted Checkout redirect does not require it)

### 2) Deploy Backend (Node)

You can deploy on any host (VPS, Render, Fly, Railway, etc.). The important part is:

- Backend must be reachable at `https://YOUR_BACKEND_DOMAIN/api/webhooks/stripe`
- HTTPS is strongly required (Stripe won’t deliver live webhooks to plain HTTP)

On a VPS (Ubuntu example):

1) Install prerequisites

```bash
sudo apt update
sudo apt install -y curl nginx
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

2) Upload the backend folder (or git clone) and install deps

```bash
cd /var/www/time-tracker/backend
npm ci --omit=dev
```

Important: production requires SQLite driver support. Ensure `better-sqlite3` installs successfully.

3) Create production env

- Copy `backend/.env.production.example` → `backend/.env.production`
- Set:
  - `ALLOWED_ORIGINS=https://your-frontend-domain.com`
  - `JWT_SECRET=...` (32+ chars)
  - `STRIPE_SECRET_KEY=sk_live_...`
  - leave `STRIPE_WEBHOOK_SECRET` blank for the moment (you’ll fill it after you create the webhook endpoint)

4) Run the backend

Use a process manager (recommended) such as `pm2`:

```bash
sudo npm i -g pm2
cd /var/www/time-tracker/backend
NODE_ENV=production pm2 start npm --name time-tracker-backend -- start
pm2 save
```

### 3) Put Backend Behind HTTPS (Nginx)

Example Nginx site (adjust domains/ports):

```nginx
server {
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then obtain TLS:

```bash
sudo snap install --classic certbot
sudo certbot --nginx -d api.yourdomain.com
```

### 4) Create Stripe Webhook Endpoint (Live)

Stripe Dashboard → Developers → Webhooks → “Add endpoint”

- Endpoint URL: `https://api.yourdomain.com/api/webhooks/stripe`
- Events to send:
  - `checkout.session.completed`

After creation, Stripe shows a signing secret `whsec_...`.

Put it into `backend/.env.production`:

- `STRIPE_WEBHOOK_SECRET=whsec_...`

Restart backend process (so it reads the new env):

```bash
pm2 restart time-tracker-backend
```

### 5) Deploy Frontend

- Ensure your frontend calls the backend base URL you deployed.
- Ensure successful checkout redirects back to your frontend `/billing?status=success&session_id=...`.
- The success page should only refresh/poll balance.

### 6) Validate Production End-to-End

1) Make a small live payment
2) Stripe Dashboard → Webhooks → click the delivery
   - It should show `200` for `checkout.session.completed`
3) Backend logs should show:
   - `[stripe:webhook] received ...`
   - `[stripe:webhook] credits added ...`
4) Confirm company credits:
   - `/api/billing/balance` returns updated value
   - DB has one matching session in `stripe_processed_sessions`

### 7) Operational Hardening

- Backups: snapshot `data/time_tracker.db` regularly.
- Monitoring: alert on non-`200` webhook responses.
- Key rotation: rotate Stripe keys and update `.env.production`.
- Access control: keep `ALLOW_MANUAL_CREDITS` unset in production.

---

## Production Checklist (Quick)

1) Backend env

- Create `backend/.env.production` from `backend/.env.production.example`
- Set:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...` (from Stripe Dashboard Webhook Endpoint)
  - `ALLOWED_ORIGINS=https://your-frontend-domain.com`
  - `JWT_SECRET` strong (32+ chars)

2) Stripe Dashboard Webhook Endpoint

- Endpoint URL: `https://backend.wfhlogger.com/api/webhooks/stripe`
- Events: `checkout.session.completed`

3) Verify live mode

- Run a live payment.
- Confirm:
  - Webhook receives the event (Stripe Dashboard logs)
  - Credits increase
  - `stripe_processed_sessions` prevents duplicates
