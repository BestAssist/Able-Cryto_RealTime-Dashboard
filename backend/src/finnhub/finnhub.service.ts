import WebSocket from 'ws';
import pino from 'pino';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PricesService, NormalizedTick, PairKey, PAIRS } from '../prices/prices.service';
import { WsGateway } from '../ws/ws.gateway';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } });

@Injectable()
export class FinnhubService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private shuttingDown = false;
  private backoffMs = 1000;
  private readonly maxBackoff = 15000;

  constructor(private prices: PricesService, private gateway: WsGateway) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.ws) {
      this.ws.close();
    }
  }

  private connect() {
    const token = process.env.FINNHUB_API_KEY;
    if (!token || token === 'your_finnhub_api_key_here') {
      logger.error('FINNHUB_API_KEY is not set or invalid. Please set it in your .env file or environment variables.');
      logger.error('Get your API key at: https://finnhub.io');
      // Don't retry if API key is missing - wait for user to fix it
      return;
    }
    const url = `wss://ws.finnhub.io?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('Connected to Finnhub WS');
      this.backoffMs = 1000;
      // Subscribe to all mapped symbols
      Object.values(PAIRS).forEach((sym) => {
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
            const pairEntry = Object.entries(PAIRS).find(([k, v]) => v === symbol);
            if (!pairEntry) continue;
            const pair = pairEntry[0] as PairKey;

            const hourlyAvg = await this.prices.upsertHourlyAverage(pair, ts, price);
            const normalized: NormalizedTick = { pair, price, ts, hourlyAvg };
            // broadcast to clients
            this.gateway.broadcastPrice(normalized);
          }
        } else if (msg.type === 'ping') {
          // ignore
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
    this.ws.on('error', (err: Error) => {
      // Check if it's an authentication error (401)
      if (err.message.includes('401')) {
        logger.error('Finnhub WebSocket authentication failed. Please check your FINNHUB_API_KEY is valid.');
        logger.error('Get your API key at: https://finnhub.io');
        // Don't retry on 401 - the API key is wrong
        this.shuttingDown = true;
        return;
      }
      logger.error({ err }, 'Finnhub WS error');
      this.ws?.close();
    });
  }
}
