import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { PairKey } from '../types'

export function PairChart({ pair, data }: { pair: PairKey, data: { ts:number, price:number, hourlyAvg:number }[] }) {
  const fmt = (ts:number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="title">{pair} — Live</h3>
        <div style={{width:'100%', height:300, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div className="subtitle">Loading…</div>
        </div>
      </div>
    )
  }
  return (
    <div className="card">
      <h3 className="title">{pair} — Live</h3>
      <div style={{width:'100%', height:300}}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ts" tickFormatter={fmt} minTickGap={32} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleString()} />
            <Line type="monotone" dataKey="price" dot={false} strokeWidth={1.8} />
            <Line type="monotone" dataKey="hourlyAvg" dot={false} strokeWidth={1.2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
