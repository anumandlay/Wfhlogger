# S3 Storage Migration — Design Doc

## Overview

Replace Google Drive as the screenshot storage backend with AWS S3. All business logic (upload, preview, quota display, storage warnings) remains intact — only the storage layer changes.

## Goals

- Screenshots uploaded by the desktop client go to S3 instead of Google Drive
- Screenshots are viewable from the web UI (preview) through S3
- Storage quota is calculated from S3 bucket usage
- Desktop client no longer requires Drive OAuth to start tracking
- All Drive-related env vars, routes, and UI references are removed

## Non-Goals

- No migration of existing Google Drive screenshots — old screenshots remain in Drive
- No changes to screenshot capture logic in the desktop app
- No changes to the audit log, billing, or employee management flows

## Architecture

```
Desktop App                     Backend (Node.js)                    AWS S3
─────────────                   ────────────────                    ───────
capture → POST /api/uploads     uploadScreenshot() → PutObjectCommand → Bucket
              drive (unchanged)                                  │
                                                                  ↓
Web UI ← GET /api/uploads/      getScreenshotStream() ← GetObjectCommand
              preview/:key
```

### S3 Key Structure

```
screenshots/{company_id}/{employee_email}/{YYYY}/{MM}/{DD}/{timestamp}_{filename}.jpg
```

Example: `screenshots/42/brad@palantir.com/2026/06/14/2026-06-14T10-30-00Z_screenshot.jpg`

## Files to Create

### 1. `backend/src/s3.js` — S3 helper module

Exports:
- `uploadScreenshot(buffer, companyId, employeeEmail)` → `{ key, etag }`
- `getScreenshotStream(key)` → `ReadableStream`
- `getStorageQuota(companyId, employeeEmail)` → `{ usedBytes, totalFiles }`
- `getCompanyStorageQuota(companyId)` → array of per-employee usage
- `deleteScreenshotsByEmployee(companyId, employeeEmail)` → `{ deleted }`
- `listScreenshots(companyId, employeeEmail, options?)` → `[{ key, lastModified, size }]`

Uses `@aws-sdk/client-s3` with credentials from env vars.

## Files to Modify

### 2. `backend/package.json`
- Add `"@aws-sdk/client-s3": "^3.600.0"`

### 3. `backend/.env`
- Remove: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `DRIVE_TOKEN_KEY`
- Add: `AWS_ACCESS_KEY_ID=`, `AWS_SECRET_ACCESS_KEY=`, `AWS_REGION=us-east-1`, `S3_BUCKET_NAME=`

### 4. `backend/src/server.js`

**Replace routes:**
- `POST /api/uploads/drive` — Upload: use `uploadScreenshot()` instead of Drive API. Remove OAuth token fetching, folder creation logic, Drive metadata writing. Write to `screenshots.s3.json` instead.
- `GET /api/uploads/preview/:fileId` — Preview: use `getScreenshotStream()` instead of Drive API `alt=media`. Change param from `fileId` to `key` (URL-encoded S3 key).
- Remove: `GET /api/drive/status`, `GET /api/drive/oauth/start`, `GET /api/drive/oauth/callback`, `GET /api/auth/google/callback`
- Replace: `GET /api/drive/quota` → use `getStorageQuota()`, `GET /api/drive/quota/list` → use `getCompanyStorageQuota()`, `GET /api/drive/quota/self` → use `getStorageQuota()`

**Remove functions:**
- `googleTokenFromRefresh()`, `driveCreateOrFindFolder()`, `driveMultipartUpload()`, `handleGoogleDriveOAuthCallback()`, `aeadEncrypt()`, `aeadDecrypt()`, `safeDriveFolderName()`, `getManagerDisplayNameForEmployee()`, `getEmployeeDisplayName()`, `fetchDriveStorageQuota()`
- Drive data files: `driveTokensFile`, `folderCacheFile`, `screenshotsDriveFile`

**Keep:**
- `screenshots.s3.json` replaces `screenshots.drive.json` for the metadata index
- The `/api/uploads/drive` endpoint name stays the same (desktop client compatibility)
- The `/api/uploads/preview/:key` endpoint stays for serving images

### 5. `desktop/app.py`
- Remove `_gate_login_on_drive_space()`, `_drive_quota_self()`, `_is_drive_full()`, `_open_drive_quota()`
- Remove the "Google Drive Full" dialog
- Remove the Drive status check before starting tracking
- Remove the Drive OAuth initiation on login
- Remove the `last_upload_var`/upload status display (simplify)
- Remove `requests.get(f'{self.backend_url}/api/drive/status', ...)` calls
- Keep the screenshot capture and upload logic (POST to `/api/uploads/drive`)

### 6. `web/src/components/ui/DriveQuotaBadge.jsx` → Rename to `StorageQuotaBadge.jsx`
- Update internal labels from "Drive" to "Storage"
- Update API endpoints from `/api/drive/quota/*` to `/api/storage/quota/*`
- Keep the same visual component structure

### 7. Frontend pages (update endpoint calls)
- `web/src/pages/TimeTracking.jsx` — Change `/api/drive/quota` → `/api/storage/quota`, rename `DriveQuotaBadge` import, change label text
- `web/src/pages/Dashboard.jsx` — Change `/api/drive/quota/list` → `/api/storage/quota/list`, update labels
- `web/src/pages/employee/Dashboard.jsx` — Change `/api/drive/quota/self` → `/api/storage/quota/self`
- All: Rename `driveQuota` state → `storageQuota`, `setDriveQuota` → `setStorageQuota`, `driveModalOpen` → etc. (keep UI behavior identical)

### 8. `backend/src/email.js`
- Update Drive storage warning emails to reference S3/cloud storage instead of Google Drive

## Data Files

### New metadata file: `data/screenshots.s3.json`

Replaces `screenshots.drive.json`. Structure per entry:
```json
{
  "company_id": 42,
  "manager_id": 5,
  "employee_id": "brad@palantir.com",
  "s3_key": "screenshots/42/brad@palantir.com/2026/06/14/2026-06-14T10-30-00Z_screenshot.jpg",
  "captured_at": "2026-06-14T10:30:00.000Z"
}
```

Old `screenshots.drive.json` is left untouched — existing Drive screenshots remain accessible via their current Drive links until deprecated.

## Rollout Sequence

1. Add `@aws-sdk/client-s3` dependency
2. Create `backend/src/s3.js` with all S3 operations
3. Update `backend/src/server.js` — replace Drive routes with S3 routes
4. Update `.env` — add S3 vars, remove Drive vars
5. Update `desktop/app.py` — remove Drive gating
6. Rename `DriveQuotaBadge` → `StorageQuotaBadge` and update API paths
7. Update frontend pages to use new component and endpoints
- Remove Drive data files (`drive_tokens.json`, `drive_folder_cache.json`) after confirming S3 works

## Risks

- **S3 costs**: Upload/download costs apply per request. Screenshots are small (~100-500KB). Monitor `s3:ListOperations` costs if listing for quota.
- **Preview auth**: S3 keys are URL-encoded in preview URLs. Need to ensure path traversal isn't possible. The preview endpoint validates company_id and role before serving.
