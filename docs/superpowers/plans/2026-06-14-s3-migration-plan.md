# S3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google Drive screenshot storage with AWS S3 while keeping all business logic intact.

**Architecture:** New `s3.js` module with S3 SDK operations replaces all Drive API calls. Desktop client no longer requires Drive OAuth. Frontend components rename from "Drive" to "Storage" and point to new API endpoints.

**Tech Stack:** Node.js, `@aws-sdk/client-s3`, React, Python/Tkinter

---

### Task 1: Add S3 dependency

**Files:**
- Modify: `backend/package.json`

- [ ] Add `@aws-sdk/client-s3` to dependencies

```bash
cd backend && npm install @aws-sdk/client-s3
```

---

### Task 2: Create S3 helper module

**Files:**
- Create: `backend/src/s3.js`

- [ ] Create s3.js with S3 client init, upload, getStream, getQuota, delete, list functions

Functions:
- `getS3Client()` — creates S3Client from env vars
- `uploadScreenshot(buffer, companyId, employeeEmail)` — PutObjectCommand, returns key
- `getScreenshotStream(key)` — GetObjectCommand, returns readable stream
- `getStorageQuota(companyId, employeeEmail)` — ListObjectsV2 for prefix, sums sizes
- `getCompanyStorageQuota(companyId)` — aggregates per-employee usage
- `deleteScreenshotsByEmployee(companyId, employeeEmail)` — list + delete objects
- `screenshotKey(companyId, employeeEmail)` — builds key path

---

### Task 3: Replace Drive upload route with S3

**Files:**
- Modify: `backend/src/server.js`

- [ ] Replace POST /api/uploads/drive to use s3.uploadScreenshot() instead of Drive API
- [ ] Remove OAuth token lookup, folder creation, Drive metadata write
- [ ] Write to `screenshots.s3.json` instead of `screenshots.drive.json`
- [ ] Keep the same endpoint name for desktop client compatibility

---

### Task 4: Replace Drive preview route with S3

**Files:**
- Modify: `backend/src/server.js`

- [ ] Replace GET /api/uploads/preview/:key to use s3.getScreenshotStream()
- [ ] Change param from drive_file_id to s3_key
- [ ] Remove Drive API alt=media logic
- [ ] Keep auth/scope checking (company_id, role enforcement)

---

### Task 5: Replace all Drive quota routes

**Files:**
- Modify: `backend/src/server.js`

- [ ] Replace GET /api/drive/status → /api/storage/status (always connected for S3)
- [ ] Replace GET /api/drive/quota → /api/storage/quota (use s3.getStorageQuota)
- [ ] Replace GET /api/drive/quota/list → /api/storage/quota/list (use s3.getCompanyStorageQuota)
- [ ] Replace GET /api/drive/quota/self → /api/storage/quota/self (use s3.getStorageQuota)

---

### Task 6: Remove Drive OAuth routes and helper functions

**Files:**
- Modify: `backend/src/server.js`

- [ ] Remove: GET /api/drive/oauth/start
- [ ] Remove: GET /api/drive/oauth/callback
- [ ] Remove: GET /api/auth/google/callback
- [ ] Remove functions: googleTokenFromRefresh, driveCreateOrFindFolder, driveMultipartUpload, handleGoogleDriveOAuthCallback, aeadEncrypt, aeadDecrypt, safeDriveFolderName, getManagerDisplayNameForEmployee, getEmployeeDisplayName, fetchDriveStorageQuota
- [ ] Remove: driveTokensFile, folderCacheFile, screenshotsDriveFile references
- [ ] Remove: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, DRIVE_TOKEN_KEY constants

---

### Task 7: Update email.js — Drive warning emails

**Files:**
- Modify: `backend/src/email.js`

- [ ] Update Drive storage warning email text to reference S3/cloud storage
- [ ] Search for "Google Drive" or "Drive" in email text and update

---

### Task 8: Update desktop app — remove Drive gating

**Files:**
- Modify: `desktop/app.py`

- [ ] Remove `_gate_login_on_drive_space()` method
- [ ] Remove `_drive_quota_self()` method
- [ ] Remove `_is_drive_full()` method
- [ ] Remove the "Google Drive Full" dialog window
- [ ] Remove Drive status check call in login flow
- [ ] Remove `requests.get(f'{self.backend_url}/api/drive/status', ...)` call
- [ ] Remove `requests.get(f'{self.backend_url}/api/drive/oauth/start', ...)` call
- [ ] Simplify `_finalize_login()` — no drive gating

---

### Task 9: Rename DriveQuotaBadge to StorageQuotaBadge

**Files:**
- Create: `web/src/components/ui/StorageQuotaBadge.jsx`
- Delete: `web/src/components/ui/DriveQuotaBadge.jsx`

- [ ] Create StorageQuotaBadge.jsx (copy of DriveQuotaBadge.jsx with updated labels)
- [ ] Update API endpoints from /api/drive/quota/* to /api/storage/quota/*
- [ ] Update labels from "Drive" to "Storage"

---

### Task 10: Update frontend pages

**Files:**
- Modify: `web/src/pages/TimeTracking.jsx`
- Modify: `web/src/pages/Dashboard.jsx`
- Modify: `web/src/pages/employee/Dashboard.jsx`

- [ ] TimeTracking.jsx: import StorageQuotaBadge instead of DriveQuotaBadge, change /api/drive/quota → /api/storage/quota, rename driveQuota→storageQuota, driveModalOpen→storageModalOpen
- [ ] Dashboard.jsx: change /api/drive/quota/list → /api/storage/quota/list, update labels
- [ ] employee/Dashboard.jsx: change /api/drive/quota/self → /api/storage/quota/self, update labels

---

### Task 11: Update .env

**Files:**
- Modify: `backend/.env`

- [ ] Remove: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, DRIVE_TOKEN_KEY
- [ ] Add: AWS_ACCESS_KEY_ID=, AWS_SECRET_ACCESS_KEY=, AWS_REGION=us-east-1, S3_BUCKET_NAME=
