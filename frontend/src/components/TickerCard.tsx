import React from 'react'
import type { Tick, PairKey } from '../types'

export function TickerCard({ pair, tick }: { pair: PairKey, tick: Tick | null }) {
  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <h3 className="title">{pair}</h3>
        <div className="subtitle">{tick ? new Date(tick.ts).toLocaleTimeString() : '—'}</div>
      </div>
      <div className="price">{tick ? tick.price.toFixed(4) : '…'}</div>
      <div className="subtitle">Hourly Avg: {tick ? tick.hourlyAvg.toFixed(4) : '…'}</div>
    </div>
  )
}
