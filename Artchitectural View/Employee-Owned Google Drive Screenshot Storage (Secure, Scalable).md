# Architecture Overview
- Desktop captures & compresses screenshots (JPG 65–75%), posts directly to Backend (memory-only, no disk write).
- Backend uploads the incoming stream to employee’s Google Drive using the employee’s OAuth2 refresh token; immediately discards the buffer.
- Backend stores only screenshot metadata in DB (no image bytes) and serves preview streams to authorized roles via short-lived tokenized endpoints.
- Strict role-based access enforced via company_id/manager_id/employee_id on metadata queries and preview endpoints.

## Desktop (Windows/macOS/Linux)
### Drive Connect (OAuth 2.0)
- On first login, require Google Drive connect (drive.file, offline access). Use OAuth PKCE flow; open system browser.
- Desktop receives authorization code, posts to Backend `/api/drive/oauth/exchange` with employee identity.
- Tracking cannot start until Drive is connected; UI shows a reconnect prompt when revoked.

### Capture & Compression
- Capture via mss; convert to JPG using Pillow.
- Quality: 65–75%; auto-resize if needed (e.g. max width 1920; preserve aspect).
- Upload payload: multipart/form-data, memory only; no local saving.
- Retry on transient failures (exponential backoff) with in-memory buffer; drop and notify on sustained failure.

## Backend (Node/Express)
### Token Security
- Endpoint: `POST /api/drive/oauth/exchange` → stores `{employee_id, company_id, encrypted_refresh_token, token_scope}`.
- Encryption: AES‑GCM with a strong KMS key or `DRIVE_TOKEN_KEY` env (rotatable); salt+nonce per token.
- Refresh access token on demand; never store access tokens.

### Folder Structure & Caching
- On first upload, create or find folders:
  TimeTracker/{CompanyID}/{EmployeeID}/{YYYY}/{MM}/{YYYY-MM-DD}
- Cache folder IDs per employee in a small table (employee_folder_cache) to avoid repeated Drive scans.
- Idempotent creation using search by name within parent folder; store found IDs.

### Upload Pipeline
- Endpoint: `POST /api/uploads/drive` (employee only)
  - Validate tracking state & Drive connection.
  - Resolve folder path (using cache) and create if missing.
  - Stream the incoming JPG to Drive (googleapis `drive.files.create` with `uploadType: multipart/resumable`).
  - Immediately discard server buffer once streaming completes.
  - Write metadata row with: `company_id, manager_id, employee_id, drive_file_id, mime='image/jpeg', captured_at (UTC)`. No public links.

### Metadata & Preview APIs
- `GET /api/uploads/list` (existing) extended to return Drive metadata for authorized viewers (manager/company admin, employee self). Super admin receives counts only.
- `GET /api/uploads/preview/:fileId` → verifies authorization against metadata (company_id & employee scope), fetches bytes from Drive with employee’s access token, streams `Content-Type: image/jpeg; Content-Disposition: inline` (no download header). No persistent cache; optional small memory cache with short TTL.
- Filtering params: employeeId, from/to (dates), pagination.

### Role-Based Access Control
- Employee: only own metadata
- Manager: only team employees (existing team mapping)
- Company Admin: all employees in company
- Super Admin: no preview access; can fetch analytics counts only

### Failure & Recovery
- Drive revoked: uploads fail with 401; mark employee drive status as disconnected; emit socket event to employee+manager; pause tracking until reconnect.
- Quota full: detect error code; notify employee & manager; pause uploads.
- Metadata remains intact; preview fails gracefully with guidance.

## Web Dashboard
### UX
- Employee/Manager/Company Admin views use embedded preview `<img src="/api/uploads/preview/:fileId">` (no direct Drive link).
- Filters by employee and date; no delete/download buttons.
- Super Admin pages omit screenshot previews entirely (show analytics only).
- Multi-tenant: previews & lists respect current tenant slug and role guards (already in place).

## DB Schema Updates (SQLite/JSON fallback)
- `drive_tokens` (employee_id, company_id, enc_refresh_token, scope, created_at, updated_at, status)
- `employee_folder_cache` (employee_id, company_id, yyyy, mm, dd, parent_ids)
- `screenshots` (id, company_id, manager_id, employee_id, drive_file_id, captured_at, size_bytes, mime)

## Security & Compliance
- Encrypt tokens at rest with AES‑GCM; key in secure env/KMS.
- Use least-privilege scope `drive.file`.
- TLS enforced; CORS restricted.
- No public Drive links; server acts as controlled proxy with auth checks.
- Logs scrubbed; no PII in request bodies beyond necessary identifiers.
- GDPR friendly: employee owns data; company only views via strict RBAC.

## Performance & Scalability
- Async/streaming uploads; no disk IO on server.
- Folder ID caching drastically reduces Drive API calls.
- Metadata queries paginated; preview streaming on-demand.
- Backpressure handling for bursts; resumable uploads for large files.

## Implementation Steps
1. Backend: add Google OAuth controller, token encryption utils, Drive client wrapper.
2. Backend: implement folder resolution + caching, upload endpoint, preview endpoint, RBAC checks.
3. Desktop: add OAuth PKCE flow & gating; implement JPG compression; upload to `/api/uploads/drive` with retries; pause/reconnect logic.
4. Web: swap screenshot `<img>` sources to preview endpoint; update filters; hide previews for super_admin.
5. DB migrations: create new tables/files.
6. Observability: structured logs; error categories for revoked/quota/retry.
7. Tests: unit tests for token crypto, RBAC, folder builder; integration tests for upload + preview.
8. Rollout: feature flag per company; data migration to stop local storage.

## Acceptance Criteria Mapping
- 0 screenshots stored on server; only metadata.
- Drive connection required to track.
- JPG compression before upload.
- Managers/Admins view seamlessly, read-only.
- RBAC enforced; super_admin no preview.
- Scales without server storage growth.
