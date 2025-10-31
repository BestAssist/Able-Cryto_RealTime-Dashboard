import React, { useEffect, useState } from 'react'

type ToastKind = 'info' | 'success' | 'warning' | 'error'
interface ToastItem { id: number, kind: ToastKind, message: string }

const bus = new EventTarget()
let nextId = 1

export function showToast(kind: ToastKind, message: string) {
  bus.dispatchEvent(new CustomEvent('toast', { detail: { id: nextId++, kind, message } as ToastItem }))
}

export function Toasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const onToast = (e: Event) => {
      const ev = e as CustomEvent<ToastItem>
      const t = ev.detail
      setToasts((cur) => [...cur, t])
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 4500)
    }
    bus.addEventListener('toast', onToast)
    return () => bus.removeEventListener('toast', onToast)
  }, [])

  const bg = (k: ToastKind) => (
    k === 'success' ? '#ecfdf5' : k === 'warning' ? '#fffbeb' : k === 'error' ? '#fef2f2' : '#f3f4f6'
  )
  const bd = (k: ToastKind) => (
    k === 'success' ? '#10b981' : k === 'warning' ? '#f59e0b' : k === 'error' ? '#ef4444' : '#9ca3af'
  )
  const fg = (k: ToastKind) => (
    k === 'success' ? '#065f46' : k === 'warning' ? '#92400e' : k === 'error' ? '#991b1b' : '#111827'
  )

  return (
    <div style={{ position:'fixed', bottom:16, right:16, display:'flex', flexDirection:'column', gap:8, zIndex:9999 }}>
      {toasts.map((t) => (
        <div key={t.id} className="fade-in" style={{
          minWidth:260, maxWidth:360, background:bg(t.kind), color:fg(t.kind),
          border:`1px solid ${bd(t.kind)}`, borderRadius:10, padding:'8px 12px', boxShadow:'0 6px 14px rgba(0,0,0,0.12)'
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}


