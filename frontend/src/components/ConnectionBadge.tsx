import React from 'react'

export function ConnectionBadge({ state }: { state: 'connecting'|'connected'|'disconnected' }) {
  const label = state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting…' : 'Disconnected'
  const cls = state === 'connected' ? 'badge ok' : state === 'connecting' ? 'badge conn' : 'badge bad'
  const dotCls = state === 'connected' ? 'dot ok' : state === 'connecting' ? 'dot conn' : 'dot bad'
  return (
    <span className={cls} title={`WebSocket ${label.toLowerCase()}`}> 
      <span className={dotCls} />
      {label}
    </span>
  )
}
