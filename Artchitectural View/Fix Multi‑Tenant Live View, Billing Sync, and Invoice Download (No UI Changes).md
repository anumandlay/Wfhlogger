## Scope and Guarantees
- No UI theme or pricing changes; preserve Manager behavior
- Strict company_id scoping across sockets, APIs, and data access
- Focus on four issues: Live View (Admin), Credit Sync, Billing API freshness, Invoice Download reliability

## Live View (Admin)
1. Server sockets:
- Ensure every authenticated socket joins `company:<company_id>` and that presence/frames broadcast to this room only
- Allow both `manager` and `super_admin` to initiate `live_view:start`/`stop` for employees in the same company
- On connect, emit company-scoped `presence:list` to both Admin and Manager
2. Client LiveView:
- Parse role from JWT; treat `super_admin` same as Manager for start permissions
- Subscribe to `presence:list`, `presence:online`, `presence:offline`, and `live_view:frame` without role-dependent filtering that hides admin
- Keep the existing modern UI; only fix event subscriptions/role checks to prevent perpetual "connecting…"

## Credit Sync (200 → 199)
1. Atomic debit on employee creation:
- Use DB transaction to `UPDATE companies SET credits = credits - 1` then fetch fresh balance
- Persist debit transaction `{ amount: 1, credits: -1, type: 'debit', description: 'Employee creation initial month' }`
2. Real-time propagation:
- Emit `company:credits_updated { company_id, balance }` from server after debit (and already after Stripe credit)
- Global CreditsContext subscribes to `company:credits_updated` and updates shared credits state
- Admin/Manager pages render CreditsContext value to reflect changes instantly

## Billing API Freshness
1. Summary endpoint:
- `GET /api/billing/summary` returns fresh DB values (no caching) and company-scoped transactions
- Avoid role-specific filtering for credits; rely solely on `company_id`
2. Client:
- Billing page uses summary endpoint; no computed or stale client-side caches for balance

## Invoice Download Reliability
1. PDF generator:
- Use lazy import of PDFKit to avoid startup time errors and ensure runtime availability
- Persist invoices under `data/invoices/<company_id>/<invoice_id>.pdf`
2. Download endpoint:
- `GET /api/billing/invoices/:invoice_id/download` verifies `company_id`, sets `Content-Type: application/pdf` and `Content-Disposition: attachment` and streams file
- If PDF missing, regenerate from stored invoice data
3. Frontend download:
- Use authenticated `axios` with `responseType: 'blob'`, createObjectURL, anchor-click, and revoke to complete downloads

## Multi‑Tenant Isolation & Audit
- All operations scoped by `company_id` from JWT, enforced on server routes and socket rooms
- Append audit logs for invoice generation and downloads

## Validation Plan
1. Live View:
- Log in as Admin and Manager; verify presence list shows company employees; start view from Admin and receive frames
2. Credit Sync:
- Start at 200 credits; create an employee; observe immediate debit to 199 on Admin and Manager pages via socket event; verify transaction entry
3. Billing API:
- Inspect summary responses; confirm fresh DB credits and correct history
4. Invoice Download:
- Complete Stripe test payment; ensure invoice appears; click Download; file saves and opens as PDF

## Rollout & Safety
- Changes behind existing endpoints/rooms; no UI layout or pricing rule changes
- Strict scoping preserved; tests performed on dev endpoints and test card flows