import { io } from 'socket.io-client'
import { resolveApiBase, getApiBaseSync } from './api.js'
import { getWebSocketBase } from './config.js'
let socket = null
const listeners = new Set()

export function onSocketChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function parseToken(token) {
  try {
    const p = JSON.parse(atob((token || '').split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
    return {
      userId: p?.email || p?.userId || '',
      uid: p?.uid || ''
    }
  } catch {
    return { userId: '', uid: '' }
  }
}

export function getSocket() {
  const token = localStorage.getItem('token')
  
  // If no token, do not connect. Return null or a dummy object if strictly needed, 
  // but usually we only need socket when authenticated.
  if (!token) {
    if (socket) {
      socket.disconnect()
      socket = null
    }
    return null
  }

  const { userId, uid } = parseToken(token)

  if (!socket) {
    const initialBase = getWebSocketBase()
    socket = io(initialBase, {
      auth: { token },
      query: { userId, uid },
      autoConnect: true,
      reconnection: true,
      transports: ['websocket'],
      path: '/socket.io',
    })
    // Re-resolve base and reconnect if needed
    resolveApiBase().then((base) => {
      try {
        if (base && socket?.io?.uri && socket.io.uri !== base) {
          socket.disconnect()
          socket = io(getWebSocketBase(), {
            auth: { token },
            query: { userId, uid },
            autoConnect: true,
            reconnection: true,
            transports: ['websocket'],
            path: '/socket.io',
          })
          listeners.forEach(cb => cb(socket))
        }
      } catch {}
    })
  } else {
    // update auth on the existing socket in case token changed
    socket.auth = { token }
  }

  return socket
}

export function disconnectSocket() {
  if (socket) socket.disconnect()
}