## Bug
- Report.jsx now displays local timestamps using `startedAt_local`/`endedAt_local`, but duration still references `st` (removed), causing `Uncaught ReferenceError: st is not defined`.

## Fix
- In sessions row mapping, compute duration using UTC fields (`s.startedAt`, `s.endedAt`) as Date objects.
- Keep display using local strings; use UTC values only for duration math.

## Changes
- In `Report.jsx`:
  - Add `startUtc = new Date(s.startedAt)` and `endUtc = new Date(s.endedAt)`
  - Compute `durMinutes` from these
  - Preserve local text rendering and timezone badge

## Verification
- Open Reports page; confirm no reference error.
- Confirm durations calculate correctly while local timestamps display as intended.