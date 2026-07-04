## Overview
Implement strict RBAC with four roles: super_admin (Platform Owner), company_admin, manager, employee. Enforce single global login with server-side role validation, tenant scoping by company_id from JWT, and a read-only Super Admin analytics dashboard. Preserve existing SaaS UI and business logic; introduce no operational access for super_admin.

## Backend RBAC
- Add exact-role middleware: requireRoleStrict([...]) and forbid super_admin on company-level endpoints.
- Enforce company_id scoping at middleware: attach req.user.company_id from JWT; ignore any route/body company_id.
- Extend unauthorized handling: return 403 with structured error, append audit log (type: rbac_forbidden, details: { path, role, company_id }).

## Auth: Single Login + Role Validation
- Frontend: one /login route with role selector (super_admin | company_admin | manager | employee).
- Backend [/api/auth/login]: enforce exact role match; block mismatch with 403 and message.
- Remove permissive logic that allowed role downgrades (e.g., super_admin logging as manager) in existing login code.
- Token payload: { uid, email, role, company_id, full_name, country, timezone } remains; role now strictly represents authenticated role.

## Role Migration & Schema
- Introduce company_admin role in SQLite CHECK constraint via automatic migration:
  1) Create users_new with updated CHECK ('super_admin','company_admin','manager','employee').
  2) Copy rows from users, mapping legacy company-bound super_admin → company_admin (except admin@example.com).
  3) Drop users, rename users_new to users.
- JSON fallback: on startup, transform records similarly.
- Seed: keep admin@example.com/admin123 as platform super_admin with no company_id.

## Endpoint Permissions Refactor
- Change company-admin endpoints to require company_admin (previously super_admin):
  - /api/admin/managers (create/delete/list)
  - /api/billing/* (balance, history, summary, invoices, stripe checkout)
  - /api/company/* (profile/brand)
  - /api/capture-interval(s)
  - /api/employees* (list/create/delete/password)
- Disallow super_admin on these routes entirely.

## Super Admin Analytics API (Read-Only)
- New endpoints:
  - GET /api/platform/metrics → aggregate:
    - total_companies
    - per-company counts: admins, managers, employees
    - total_revenue, revenue_per_company (sum transactions.amount where type='credit')
    - available_credits, plan per company
    - geography: country distribution (users), timezone distribution
    - growth: monthly/yearly revenue series (by transactions.created_at)
- Implement helpers:
  - listCompanies(), listUsersByCompany(company_id), aggregateTransactions(company_id)
  - groupByMonth(transactions) to build trend series
- Strictly return aggregates; no per-user/session details.

## Frontend Changes
- Login.jsx: add role selector; send role to backend; show clear error banners on mismatch.
- Route guards:
  - super_admin: only /platform routes; hide company/admin/manager pages.
  - company_admin: existing Admin pages (managers, billing, audit, reports) scoped by their company.
  - manager: existing Manager pages for assigned team.
  - employee: existing Employee pages.
- Super Admin UI:
  - New layout: PlatformSidebar.jsx (read-only navigation), SADashboard.jsx (cards, charts).
  - Charts: revenue trend, company distribution; tables: per-company summary (name, plan, credits, revenue, counts).

## WebSocket Scoping
- Maintain company rooms (company:${company_id}).
- Block super_admin from presence/live/screenshot streams entirely.
- Ensure manager/company_admin socket events validate company_id and team membership; audit forbidden events.

## Audit & Alerts
- Append audit on forbidden API and socket actions with actor role, path, and company_id.
- Standardize 401/403 responses with machine-readable codes (e.g., RBAC_ROLE_MISMATCH, RBAC_TENANT_FORBIDDEN).
- Frontend: show modal/toast alerts for unauthorized attempts; never auto-escalate.

## Zero-Regression Strategy
- Keep existing business logic; only shift role requirements from super_admin→company_admin for company endpoints.
- Maintain existing token fields and UI components where possible.
- Backwards compatibility: legacy company super_admins become company_admin automatically; require re-login to refresh tokens.

## Verification
- Unit/integration tests:
  - Login: role mismatch blocked for all roles.
  - Endpoint access matrix: super_admin denied on company endpoints; company_admin confined to own company; manager to team; employee to self.
  - Analytics: aggregates match data fixtures; no per-user/session leakage.
- Manual flows for all four roles; confirm socket events blocked for super_admin and cross-tenant attempts.

## Files To Update/Add
- backend/src/sqlite.js: role migration, listCompanies, helpers.
- backend/src/server.js: strict login validation, middleware, endpoint role swaps, new /api/platform/metrics.
- web/src/pages/Login.jsx: role selector & error handling.
- web/src/pages/platform/SADashboard.jsx, web/src/components/PlatformSidebar.jsx: new Super Admin UI.
- web/src/ThemeContext.jsx / components: reuse existing SaaS styling.

If this plan looks good, I will implement the migration, backend RBAC changes, analytics API, and the frontend UI in one pass and verify with tests and a local preview.