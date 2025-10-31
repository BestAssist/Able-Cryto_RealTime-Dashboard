export type PairKey = 'ETH/USDC' | 'ETH/USDT' | 'ETH/BTC'

export interface Tick {
  pair: PairKey
  price: number
  ts: number
  hourlyAvg: number
}

export interface HourlyAvg {
  pair: PairKey
  hourStart: number
  avg: number
  count: number
}
