# Employee Reporting: Local Timezones Everywhere

## Scope
- Display employee timezone and local timestamps across all employee-related reports.
- Remove implicit reliance on viewer machine timezone.

## Backend Adjustments
- Add `timezone` and `created_at_local` to the response of `/api/employee/generate-report` (already present in listing; mirror in POST response for immediate UI update).
- Validate existing endpoints provide local timestamps:
  - `/api/employee/reports` returns `timezone` and `created_at_local` ✔
  - `/api/work/sessions/range` returns `startedAt_local`, `endedAt_local`, `timezone` ✔
  - `/api/uploads/query` returns `ts_local`, `timezone` ✔

## Frontend Updates
- Manager Reports page (`web/src/pages/Report.jsx`):
  - Use `startedAt_local` and `endedAt_local` for session rows instead of `toLocaleString()`
  - Show `timezone` (badge or subtext) per row or above the table when a single employee is selected
  - Use `ts_local` for screenshots and display an employee timezone indicator
- Employee Reports page (`web/src/pages/employee/Reports.jsx`):
  - Show `timezone` in the report list (e.g., subtext: “Timezone: X”)
  - Prefer `created_at_local` wherever a timestamp is displayed

## UI Details
- Add a small badge: “Timezone: {TZ}” where relevant (header/subtext)
- Keep dark/light styles aligned with existing design
- Avoid clutter: if only one employee selected, show timezone once above the sessions table; otherwise show per row

## Verification
- Generate an employee report and confirm the list shows local timestamp and timezone
- On manager Reports, select an employee and confirm:
  - Session times and screenshot times reflect employee local time
  - Timezone is clearly displayed
- Confirm multiple employees listing shows per-row timezone

## Deliverables
- Backend: augmented POST response with local timestamp + timezone
- Web: updated Report.jsx and EmployeeReports.jsx to consume local fields consistently