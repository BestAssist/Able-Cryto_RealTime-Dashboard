import React, { useEffect, useState } from 'react'
import './styles.css'
import { useLivePrices } from './hooks/useLivePrices'
import type { PairKey } from './types'
import { ConnectionBadge } from './components/ConnectionBadge'
import { TickerCard } from './components/TickerCard'
import { PairChart } from './components/PairChart'
import { Toasts } from './components/Toasts'

const PAIRS: PairKey[] = ['ETH/USDC','ETH/USDT','ETH/BTC']

export default function App() {
  const { conn, error, ticks, series, ready } = useLivePrices(PAIRS)
  const [progress, setProgress] = useState(5)

  // Simulated progress until first ticks arrive; completes when ready
  useEffect(() => {
    if (ready) { setProgress(100); return }
    const id = setInterval(() => {
      setProgress((p) => Math.min(90, p + Math.max(1, 8 - Math.floor(p/20))))
    }, 300)
    return () => clearInterval(id)
  }, [ready])

  // errors are handled inside the hook via toasts

  if (!ready) {
    return (
      <div className="app fade-in" style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>
        <Toasts />
        <div style={{textAlign:'center'}}>
          <h1 className="title" style={{marginBottom:8}}><span className="brand">Able</span> — Crypto Dashboard</h1>
          <div style={{display:'flex', alignItems:'center', flexDirection:'column', gap:8}}>
            <span className="ring" />
            <div className="subtitle">Loading…</div>
          </div>
          <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
          {/* errors are surfaced via toasts */}
        </div>
      </div>
    )
  }

  return (
    <div className="app fade-in">
      <Toasts />
      <div className="header">
        <div>
          <h1 className="title" style={{marginBottom:4}}><span className="brand">Able</span> — Crypto Dashboard</h1>
          <div className="subtitle">Real‑time rates with hourly averages</div>
        </div>
        <div>
          <ConnectionBadge state={conn} />
        </div>
      </div>

      {/* errors are surfaced via toasts */}

      <div className="grid">
        {PAIRS.map((p) => (<TickerCard key={p} pair={p} tick={ticks[p]} />))}
      </div>

      <div className="grid" style={{marginTop:16}}>
        {PAIRS.map((p) => (<PairChart key={p} pair={p} data={series[p]} />))}
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-brand-name">Able</span>
            <span className="footer-tagline">Real-time cryptocurrency insights</span>
          </div>
          <div className="footer-info">
            <div className="footer-item">
              <span className="footer-label">Powered by</span>
              <span className="footer-value">Finnhub API</span>
            </div>
            <div className="footer-divider">•</div>
            <div className="footer-item">
              <span className="footer-label">Data updates</span>
              <span className="footer-value">Real-time</span>
            </div>
          </div>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} Able. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
