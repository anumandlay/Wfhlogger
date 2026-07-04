import React, { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { resolveApiBase } from './api.js'
import { getSocket } from './socket.js'

const CreditsContext = createContext({ credits: 0, refreshCredits: () => {} })

export function CreditsProvider({ children }) {
  const [credits, setCredits] = useState(0)
  const [creditsError, setCreditsError] = useState('')

  const refreshCredits = async () => {
    try {
      const base = await resolveApiBase()
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
      const { data } = await axios.get(`${base}/api/billing/balance?t=${Date.now()}`, { headers: { ...headers, 'Cache-Control': 'no-cache' } })
      const next = Number(data?.credits)
      if (!Number.isFinite(next)) throw new Error('Invalid credits response')
      setCredits(next)
      setCreditsError('')
    } catch (e) {
      setCreditsError('Failed to load credit balance.')
    }
  }

  useEffect(() => {
    // Only fetch if authenticated
    const token = localStorage.getItem('token')
    if (!token) return

    refreshCredits()
    const s = getSocket()
    if (!s) return // Guard against null socket

    let companyId = null
    try {
      const p = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      companyId = p?.company_id || null
    } catch {}
    
    const handler = (p) => {
      if (p?.company_id && companyId && Number(p.company_id) === Number(companyId)) {
        setCredits(p.balance || 0)
      }
    }
    
    // Only attach listener if socket exists
    s.on('company:credits_updated', handler)
    return () => { try { s.off('company:credits_updated', handler) } catch {} }
  }, [])

  return (
    <CreditsContext.Provider value={{ credits, refreshCredits, creditsError }}>
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits() {
  return useContext(CreditsContext)
}
