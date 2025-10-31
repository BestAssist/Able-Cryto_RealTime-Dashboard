import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tick, PairKey, HourlyAvg } from '../types'
import { WS_URL, API_ORIGIN } from '../api'
import { showToast } from '../components/Toasts'

type ConnState = 'connecting' | 'connected' | 'disconnected'

export function useLivePrices(pairs: PairKey[]) {
  const [conn, setConn] = useState<ConnState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState<boolean>(false)
  const [historyLoaded, setHistoryLoaded] = useState<boolean>(false)
  const [ticks, setTicks] = useState<Record<PairKey, Tick | null>>({
    'ETH/USDC': null,
    'ETH/USDT': null,
    'ETH/BTC': null,
  })

  // history per pair for charts
  const [series, setSeries] = useState<Record<PairKey, { ts: number, price: number, hourlyAvg: number }[]>>({
    'ETH/USDC': [],
    'ETH/USDT': [],
    'ETH/BTC': [],
  })

  // fetch initial hourly history
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        for (const pair of pairs) {
          const res = await fetch(`${API_ORIGIN}/api/averages?pair=${encodeURIComponent(pair)}&hours=24`)
          const data: HourlyAvg[] = await res.json()
          if (cancelled) return
          setSeries((s) => ({
            ...s,
            [pair]: data.map(d => ({ ts: d.hourStart, price: d.avg, hourlyAvg: d.avg }))
          }))
        }
      } catch (e: any) {
        setError('Failed to load history')
        showToast('error', 'Failed to load initial history from backend')
      } finally {
        if (!cancelled) setHistoryLoaded(true)
      }
    }
    init()
    return () => { cancelled = true }
  }, [pairs])

  // Dashboard is ready when: WebSocket connected (or history loaded as fallback)
  // Show dashboard immediately when connected for better UX
  useEffect(() => {
    if (conn === 'connected') {
      // Show dashboard once connected, even if history is still loading
      setReady(true)
    } else if (historyLoaded && conn === 'connecting') {
      // If history loaded but not connected yet, show after a short delay
      const timer = setTimeout(() => setReady(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [conn, historyLoaded])

  // websocket
  useEffect(() => {
    let ws: WebSocket | null = null
    let retryTimer: any = null
    let backoff = 1000

    const open = () => {
      setConn('connecting')
      setError(null)
      ws = new WebSocket(`${WS_URL}/ws`)
      ws.onopen = () => {
        setConn('connected')
        backoff = 1000
        showToast('success', 'Connected to realtime feed')
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'price') {
            const t: Tick = msg.data
            setTicks((prev) => ({ ...prev, [t.pair]: t }))
            setSeries((prev) => ({
              ...prev,
              [t.pair]: [...prev[t.pair], { ts: t.ts, price: t.price, hourlyAvg: t.hourlyAvg }].slice(-6000)
            }))
          }
        } catch {}
      }
      ws.onclose = () => {
        setConn('disconnected')
        showToast('warning', 'Disconnected. Reconnecting…')
        retry()
      }
      ws.onerror = () => {
        setConn('disconnected')
        setError('WebSocket error')
        showToast('error', 'WebSocket error')
        ws?.close()
      }
    }

    const retry = () => {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(open, backoff)
      backoff = Math.min(backoff * 2, 15000)
    }

    open()
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      ws?.close()
    }
  }, [])

  return { conn, error, ticks, series, ready }
}
