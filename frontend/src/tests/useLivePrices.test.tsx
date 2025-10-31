import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLivePrices } from '../hooks/useLivePrices'

class WS {
  static instances: WS[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { WS.instances.push(this) }
  close() { this.onclose && this.onclose() }
}
// @ts-ignore
global.WebSocket = WS

describe('useLivePrices', () => {
  it('sets connected on ws open and updates ticks on message', () => {
    const { result } = renderHook(() => useLivePrices(['ETH/USDT','ETH/USDC','ETH/BTC']))
    act(() => { WS.instances[0].onopen && WS.instances[0].onopen() })
    expect(result.current.conn).toBe('connected')
    const tick = { type: 'price', data: { pair: 'ETH/USDT', price: 1, ts: 1, hourlyAvg: 1 } }
    act(() => { WS.instances[0].onmessage && WS.instances[0].onmessage(new MessageEvent('message', { data: JSON.stringify(tick) })) })
    expect(result.current.ticks['ETH/USDT']?.price).toBe(1)
  })
})


