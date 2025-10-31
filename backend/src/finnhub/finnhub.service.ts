import WebSocket from 'ws';
import pino from 'pino';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PricesService, NormalizedTick, PairKey, PAIRS } from '../prices/prices.service.js';
import { WsGateway } from '../ws/ws.gateway.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } });

@Injectable()
export class FinnhubService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private shuttingDown = false;
  private backoffMs = 1000;
  private readonly maxBackoff = 15000;
  private lastTickMs: Record<PairKey, number> = {
    'ETH/USDC': 0,
    'ETH/USDT': 0,
    'ETH/BTC': 0,
  };
  private lastPrice: Partial<Record<PairKey, number>> = {};
  private backfillTimer: NodeJS.Timer | null = null;

  constructor(private prices: PricesService, private gateway: WsGateway) {}

  onModuleInit() {
    this.connect();
    this.startBackfill();
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.ws) {
      this.ws.close();
    }
    if (this.backfillTimer) {
      clearInterval(this.backfillTimer as any);
      this.backfillTimer = null;
    }
  }

  private connect() {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) {
      logger.error('FINNHUB_API_KEY is not set');
      return;
    }
    const url = `wss://ws.finnhub.io?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('Connected to Finnhub WS');
      this.backoffMs = 1000;
      // Subscribe to all mapped symbols for each pair
      const symbols = Object.values(PAIRS).flat();
      logger.info({ symbols }, 'Subscribing to crypto symbols');
      symbols.forEach((sym) => {
        const msg = JSON.stringify({ type: 'subscribe', symbol: sym });
        this.ws?.send(msg);
      });
    });

    this.ws.on('message', async (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          for (const t of msg.data) {
            const symbol: string = t.s;
            const price: number = t.p;
            const ts: number = t.t; // ms epoch
            const pairEntry = Object.entries(PAIRS).find(([k, symbols]) => (symbols as string[]).includes(symbol));
            if (!pairEntry) continue;
            const pair = pairEntry[0] as PairKey;

            const hourlyAvg = await this.prices.upsertHourlyAverage(pair, ts, price);
            const normalized: NormalizedTick = { pair, price, ts, hourlyAvg };
            // broadcast to clients
            this.gateway.broadcastPrice(normalized);
            this.lastTickMs[pair] = ts;
            this.lastPrice[pair] = price;
          }
        } else if (msg.type === 'ping') {
          // re-affirm subscriptions periodically (defensive against drops)
          Object.values(PAIRS).flat().forEach((sym) => {
            const sub = JSON.stringify({ type: 'subscribe', symbol: sym });
            this.ws?.send(sub);
          });
        }
      } catch (e) {
        logger.warn({ err: e }, 'Failed to parse Finnhub message');
      }
    });

    const scheduleReconnect = () => {
      if (this.shuttingDown) return;
      const delay = this.backoffMs;
      logger.warn(`Finnhub WS closed. Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoff);
    };

    this.ws.on('close', scheduleReconnect);
    this.ws.on('error', (err) => {
      logger.error({ err }, 'Finnhub WS error');
      this.ws?.close();
    });
  }

  private startBackfill() {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) return;
    const primarySymbol: Record<PairKey, string> = {
      'ETH/USDC': (PAIRS['ETH/USDC'][0] as string),
      'ETH/USDT': (PAIRS['ETH/USDT'][0] as string),
      'ETH/BTC': (PAIRS['ETH/BTC'][0] as string),
    };
    const intervalMs = 15000; // if no tick for 15s, fetch latest candle
    this.backfillTimer = setInterval(async () => {
      const now = Date.now();
      for (const pair of Object.keys(this.lastTickMs) as PairKey[]) {
        const last = this.lastTickMs[pair] || 0;
        if (now - last < intervalMs) continue;
        try {
          const sym = primarySymbol[pair];
          const from = Math.floor((now - 120000) / 1000);
          const to = Math.floor(now / 1000);
          const url = `https://finnhub.io/api/v1/crypto/candle?symbol=${encodeURIComponent(sym)}&resolution=1&from=${from}&to=${to}&token=${token}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data: any = await res.json();
          if (data && data.t && data.c && data.t.length && data.c.length) {
            const ts = Number(data.t[data.t.length - 1]) * 1000;
            const price = Number(data.c[data.c.length - 1]);
            if (!Number.isFinite(price) || !Number.isFinite(ts)) continue;
            const avg = await this.prices.upsertHourlyAverage(pair, ts, price);
            const normalized: NormalizedTick = { pair, price, ts, hourlyAvg: avg };
            this.gateway.broadcastPrice(normalized);
            this.lastTickMs[pair] = ts;
            this.lastPrice[pair] = price;
          }
        } catch (err) {
          logger.warn({ err, pair }, 'Backfill fetch failed');
        }
      }

      // Synthetic fallback for ETH/USDC: use ETH/USDT price if USDC is stale (USDC ~ USD)
      const usdcLast = this.lastTickMs['ETH/USDC'] || 0;
      const usdtLast = this.lastTickMs['ETH/USDT'] || 0;
      if (now - usdcLast >= intervalMs && now - usdtLast < intervalMs * 2 && this.lastPrice['ETH/USDT']) {
        const price = this.lastPrice['ETH/USDT'] as number;
        const ts = now;
        try {
          const avg = await this.prices.upsertHourlyAverage('ETH/USDC', ts, price);
          const normalized: NormalizedTick = { pair: 'ETH/USDC', price, ts, hourlyAvg: avg };
          this.gateway.broadcastPrice(normalized);
          this.lastTickMs['ETH/USDC'] = ts;
          this.lastPrice['ETH/USDC'] = price;
        } catch (err) {
          logger.warn({ err }, 'Synthetic ETH/USDC emit failed');
        }
      }
    }, intervalMs);
  }
}
