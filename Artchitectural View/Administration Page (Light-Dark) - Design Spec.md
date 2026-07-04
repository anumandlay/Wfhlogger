# Administration Page (Desktop-first) — Design Specification

## Global Styles
- **Theme**: Tailwind `dark` class on `<html>`; all components must define both light and dark tokens.
- **Colors**:
  - Background: `bg-slate-50` / `dark:bg-slate-900`
  - Surface/Card: `bg-white` / `dark:bg-slate-800`
  - Border: `border-slate-200` / `dark:border-slate-700`
  - Primary: `blue-600` (links, focus rings, active states)
  - Danger: `red-600` (destructive actions)
- **Typography**:
  - Page title: `text-3xl font-bold tracking-tight`
  - Section titles: `text-xl font-bold`
  - Table headers: `text-xs font-semibold uppercase tracking-wider`
- **Interaction**:
  - Buttons: rounded-lg, `transition-colors`, clear hover states in both themes
  - Focus: visible ring (blue) on inputs and actionable controls

## Meta Information
- Title: `Administration | TimeTracker`
- Description: `Manage managers, employees, and audit logs for your company.`
- Open Graph: match title/description; no image required.

## Layout
- Uses the existing app shell (sidebar + main content).
- **Primary layout system**: CSS Flex for shell; CSS Grid inside content.
- **Spacing**: 24–32px vertical rhythm between major sections; 12–16px within cards.
- **Responsive behavior**:
  - Desktop (≥1024px): two-column grid for “Create Manager” + (optional) supporting panel.
  - Tablet/Mobile: single column; tables become horizontally scrollable; filters wrap.

## Page Structure
1. Page header (title + short subtitle)
2. Tabbed content area (Managers / Employees / Audit Logs) to reduce scroll and improve focus

## Sections & Components

### A) Page Header
- **Left**: “Admin Console” title; subtitle explaining scope (“Company administration and audit trail”).
- **Right (optional)**: compact breadcrumb or tenant label (company name) if available.

### B) Tabs (Managers / Employees / Audit Logs)
- Horizontal tab bar with clear active indicator.
- Keyboard accessible: `tabindex`, focus ring, Enter/Space to activate.

### C) Managers Tab
**1. Create Manager Card**
- Fields: Full Name, Country, Timezone, Email, Password, Team Name.
- Inline validation and compact error panel.
- Primary CTA: “Create Account”.

**2. Managers Table Card**
- Columns: Name, Email, Team, Employees, Actions.
- Row hover state; “Remove” as danger action.
- Empty state: “No managers found.”

**3. Manager Initial Credentials Card**
- Table: Email, Initial Password, Created.
- Helper text: remind password change on first login.

### D) Employees Tab
**Employees Table Card**
- Columns: Email, Name, Manager ID, Actions.
- Empty state: “No employees found.”

### E) Audit Logs Tab
**1. Filter Bar**
- Inputs (wrap on small screens):
  - Actor filter (id/email)
  - Employee filter (email/id)
  - Event type dropdown (optional if available)
  - Date range (from/to) (optional if available)
- Secondary CTA: “Refresh”.

**2. Audit Logs Table**
- Columns (company-scoped readability):
  - Time (localized)
  - Event (type + short badge)
  - Actor (name/email)
  - Target (employee name/email)
  - Company (name) (can be hidden if redundant but available in details)
  - Summary (short human-readable)
- Row click opens **Detail Drawer**.

**3. Audit Log Detail Drawer (right side)**
- Header: Event type + timestamp + timezone.
- Sections:
  - Company: id/name/slug
  - Actor: id/name/email/role
  - Target employee: email/name/managerId
  - Raw details: formatted JSON block with copy-to-clipboard

## Explicit Removal
- The “Storage Cleanup” section must not appear anywhere on this page for company admins.
