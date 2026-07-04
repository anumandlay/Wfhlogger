import axios from 'axios'
import { getApiBase } from './config.js'

let cachedBase = getApiBase()

export async function resolveApiBase() {
  return cachedBase
}

export function getApiBaseSync() {
  return cachedBase
}

const candidates = [cachedBase, 'http://127.0.0.1:4000', 'http://localhost:4000']
// Filter candidates to avoid mixed content errors (HTTPS site cannot call HTTP)
const validCandidates = candidates.filter(url => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    return false;
  }
  return true;
});

const checks = validCandidates.map((base) =>
  axios.get(`${base}/health`, { timeout: 2000 })
    .then((r) => {
      const ok = r.status === 200 && String(r.headers['content-type'] || '').includes('application/json') && r.data && r.data.ok === true
      if (!ok) return Promise.reject(base)
      return base
    })
    .catch(() => Promise.reject(base))
)
Promise.any(checks).then((base) => {
  cachedBase = base
}).catch(() => {})

export async function apiPost(path, data, config = {}) {
  const base = getApiBaseSync()
  return axios.post(`${base}${path}`, data, config)
}

export async function apiGet(path, config = {}) {
  const base = getApiBaseSync()
  return axios.get(`${base}${path}`, config)
}

axios.interceptors.request.use((config) => {
  const base = getApiBaseSync()
  if (typeof config.url === 'string') {
    if (config.url.startsWith('/')) {
      config.url = base + config.url
    } else if (typeof window !== 'undefined' && (config.url.startsWith('http://localhost:5173') || config.url.startsWith(window.location.origin))) {
      config.url = config.url.replace(/^https?:\/\/localhost:5173|^https?:\/\/127\.0\.0\.1:5173|^https?:\/\/[^/]+/, base)
    }
  }
  return config
})
