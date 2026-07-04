// API configuration utility for dynamic environment detection
export function getApiBase() {
  const explicit = String(import.meta?.env?.VITE_API_URL || '').trim()
  if (explicit) return explicit.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1'
    if (isProduction) {
      if (hostname === 'tracker.vughy.com') return 'https://backend-tracker.vughy.com'
      if (hostname === 'wfhlogger.com' || hostname === 'www.wfhlogger.com') return 'https://backend.wfhlogger.com'
      return origin.replace(/\/$/, '')
    }
  }

  return 'http://127.0.0.1:4000'
}

export function getWebSocketBase() {
  const apiBase = getApiBase();
  
  // Convert HTTP to WS protocol for WebSocket connections
  if (apiBase.startsWith('https://')) {
    return apiBase.replace('https://', 'wss://');
  } else if (apiBase.startsWith('http://')) {
    return apiBase.replace('http://', 'ws://');
  }
  
  return apiBase;
}
