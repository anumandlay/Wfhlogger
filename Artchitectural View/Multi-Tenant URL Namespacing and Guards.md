# Multi-Tenant URL Namespacing and Guards

## Goals
- Isolate company workspaces by URL: http://localhost:5173/{company-slug}/...
- Keep /login shared for all roles
- Super Admin routes remain global (e.g., /platform/...)
- Enforce strict access: users cannot view other companies or unauthorized role pages

## URL Model
- Add a tenant slug segment: `/{company-slug}/{route}` for company_admin, manager, employee
- Example: `/apple-inc/dashboard`, `/apple-inc/live`, `/apple-inc/report`, `/apple-inc/setup`
- Super Admin operates outside tenant scope: `/platform/*`

## Slug Generation & Persistence
- Derive slug from company name via slugify(name): lowercase, hyphen-separated, strip invalids
- Ensure uniqueness: if collision, suffix with company_id (e.g., `apple-inc-42`)
- Persist slug with company record (SQLite JSON fallback already used):
  - On workspace creation, compute and store `slug`
  - On company rename, recompute slug only if not previously set or if admin chooses to update

## Backend Support (Token-Scoped, Slug-Aware)
- New endpoint: `GET /api/company/slug` → { slug } based on `req.user.company_id`
- Include `slug` in existing `GET /api/org` or `GET /api/company/profile` responses for convenience
- Optional: `GET /api/company/by-slug/:slug` to validate existence and resolve to `company_id` for client-side sanity checks
- APIs remain token-scoped (company_id) — no changes to business logic; presence/events already company-scoped

## Frontend Router
- Introduce a TenantRouter wrapper with param `:companySlug`
- Routes under `/:companySlug/*` for tenant pages:
  - `/:companySlug/dashboard`
  - `/:companySlug/report`
  - `/:companySlug/live`
  - `/:companySlug/admin` (company admin console)
  - `/:companySlug/setup`
- Keep `/login` and any public routes at root
- Super Admin routes remain `/platform/*`

## Guards & Redirects
- Decode JWT → get role + company_id
- Fetch `slug` via `/api/company/slug` (cached in memory)
- If current path `companySlug` !== user’s slug:
  - Employees/Managers/Company Admin → redirect to their correct `/:slug/...`
- Role guards:
  - Employee cannot access `/admin` or manager-only pages → redirect to `/:slug/dashboard`
  - Manager cannot access company_admin-only pages → redirect to `/:slug/dashboard`
  - Company Admin can access all tenant pages
  - Super Admin accessing tenant pages → redirect to `/platform/dashboard`
- Backward compatibility:
  - Non-namespaced routes (`/dashboard`, `/report`, `/live`, etc.) perform immediate redirect to `/:slug/...` based on token

## Navigation Updates
- After successful login:
  - If role is super_admin → `/platform/dashboard`
  - Else → fetch slug → navigate to `/:slug/dashboard`
- Update sidebar/nav links to prefix with `/:slug` for tenant roles

## UX & Error Handling
- 404 or mismatch slug:
  - If user authenticated but slug invalid, refetch slug and redirect
  - If unauthenticated, send to `/login`
- Show a small breadcrumb or badge with company name on tenant pages

## Testing & Verification
- Create workspace “Apple Inc” → slug `apple-inc`
- Login as company admin, manager, employee → verify redirects to `/:slug/dashboard`
- Attempt cross-tenant access by manually changing URL → observe redirect to correct slug
- Role-restricted pages: validate redirects for employee/manager
- Ensure super_admin unaffected on `/platform/*`
- Confirm all tenant links and deep routes function: report, live, admin, setup

## Migration Strategy
- For existing tenants without slug:
  - Compute slug on first login and persist
- Maintain old non-namespaced routes temporarily with redirect shim

## Deliverables
- Backend: slug endpoints and persistence on workspace creation
- Frontend: router rework, guards, login redirect, nav updates, legacy route redirects
- Documentation: short note in README on tenant URLs and slug rules