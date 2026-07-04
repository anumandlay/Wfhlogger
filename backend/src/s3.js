import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION || 'us-east-1'
const BUCKET = process.env.S3_BUCKET_NAME || ''
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || ''
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || ''

let _client = null

function getS3Client() {
  if (!_client) {
    if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
      throw new Error('S3 not configured: Set S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env')
    }
    _client = new S3Client({
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
    })
  }
  return _client
}

/**
 * Build an S3 object key for a screenshot.
 * Format: screenshots/{companyId}/{employeeEmail}/{YYYY}/{MM}/{DD}/{timestamp}_{filename}.jpg
 */
export function screenshotKey(companyId, employeeEmail, timestamp = new Date()) {
  const d = new Date(timestamp)
  const yyyy = String(d.getUTCFullYear())
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mn = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  const ts = `${yyyy}-${mm}-${dd}T${hh}-${mn}-${ss}Z`
  return `screenshots/${companyId}/${employeeEmail}/${yyyy}/${mm}/${dd}/${ts}_screenshot.jpg`
}

/**
 * Upload a screenshot buffer to S3.
 * @param {Buffer} buffer - Image data
 * @param {number|string} companyId
 * @param {string} employeeEmail
 * @param {Date} [timestamp]
 * @returns {Promise<{key: string, etag: string}>}
 */
export async function uploadScreenshot(buffer, companyId, employeeEmail, timestamp) {
  const key = screenshotKey(companyId, employeeEmail, timestamp)
  const client = getS3Client()
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  })
  const result = await client.send(cmd)
  return { key, etag: result.ETag }
}

/**
 * Get a readable stream for a screenshot from S3.
 * @param {string} key - S3 object key
 * @returns {Promise<{stream: ReadableStream, contentType: string}>}
 */
export async function getScreenshotStream(key) {
  const client = getS3Client()
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  const result = await client.send(cmd)
  return {
    stream: result.Body,
    contentType: result.ContentType || 'image/jpeg',
  }
}

/**
 * Get storage usage for a specific employee within a company.
 * @param {number|string} companyId
 * @param {string} employeeEmail
 * @returns {Promise<{connected: boolean, employee_id: string, used_bytes: number, total_files: number}>}
 */
export async function getStorageQuota(companyId, employeeEmail) {
  const prefix = `screenshots/${companyId}/${employeeEmail}/`
  const client = getS3Client()
  let totalSize = 0
  let totalFiles = 0
  let continuationToken = undefined

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })
    const result = await client.send(cmd)
    if (result.Contents) {
      for (const obj of result.Contents) {
        totalSize += obj.Size || 0
        totalFiles += 1
      }
    }
    continuationToken = result.NextContinuationToken
  } while (continuationToken)

  return { connected: true, employee_id: employeeEmail, used_bytes: totalSize, total_files: totalFiles }
}

/**
 * Get storage usage for all employees in a company.
 * @param {number|string} companyId
 * @returns {Promise<Array<{employee_id: string, used_bytes: number, total_files: number}>>}
 */
export async function getCompanyStorageQuota(companyId) {
  const prefix = `screenshots/${companyId}/`
  const client = getS3Client()

  // List common prefixes (employee emails) under the company prefix
  const cmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
    Delimiter: '/',
  })
  const result = await client.send(cmd)
  const prefixes = result.CommonPrefixes?.map(p => p.Prefix) || []

  const results = []
  for (const p of prefixes) {
    const email = p.replace(prefix, '').replace(/\/$/, '')
    const quota = await getStorageQuota(companyId, email)
    results.push(quota)
  }
  return results
}

/**
 * Delete all screenshots for a specific employee.
 * @param {number|string} companyId
 * @param {string} employeeEmail
 * @returns {Promise<{deleted: number}>}
 */
export async function deleteScreenshotsByEmployee(companyId, employeeEmail) {
  const prefix = `screenshots/${companyId}/${employeeEmail}/`
  const client = getS3Client()
  let deleted = 0

  // List all objects with this prefix
  const listed = await client.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  }))

  const keys = (listed.Contents || []).map(obj => ({ Key: obj.Key }))
  if (keys.length === 0) return { deleted: 0 }

  // Delete in batches of 1000 (S3 max)
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    await client.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: batch },
    }))
    deleted += batch.length
  }
  return { deleted }
}
