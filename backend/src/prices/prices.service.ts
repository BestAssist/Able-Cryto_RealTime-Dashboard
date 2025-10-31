import pino from 'pino';
import { Injectable } from '@nestjs/common';
import pg from 'pg';

export type PairKey = 'ETH/USDC' | 'ETH/USDT' | 'ETH/BTC';

export const PAIRS: Record<PairKey, string> = {
  'ETH/USDC': 'BINANCE:ETHUSDC',
  'ETH/USDT': 'BINANCE:ETHUSDT',
  'ETH/BTC': 'BINANCE:ETHBTC',
};

export interface NormalizedTick {
  pair: PairKey;
  price: number;
  ts: number; // ms epoch
  hourlyAvg: number;
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } });

@Injectable()
export class PricesService {
  private pool: pg.Pool;

  constructor() {
    const conn = process.env.DATABASE_URL || 'postgres://able:able@localhost:5432/able';
    this.pool = new pg.Pool({ connectionString: conn });
    this.bootstrap();
  }

  private async bootstrap() {
    try {
      const client = await this.pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS hourly_averages (
            pair TEXT NOT NULL,
            hour_start BIGINT NOT NULL,
            sum DOUBLE PRECISION NOT NULL DEFAULT 0,
            count BIGINT NOT NULL DEFAULT 0,
            PRIMARY KEY (pair, hour_start)
          );
        `);
      } catch (err) {
        // Only log errors in non-test environments to reduce test noise
        if (process.env.NODE_ENV !== 'test') {
          logger.error({ err: err }, 'DB create table failed');
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      // Only log connection errors in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        logger.error({ err: err }, 'DB connection failed during bootstrap');
      }
      // Don't throw - allow service to start even if DB is unavailable
      // The health endpoint will report the status
    }
  }

  private hourBucket(tsMs: number): number {
    return Math.floor(tsMs / 3600000) * 3600000;
  }

  /**
   * Upsert the hourly bucket with this tick and return the new avg.
   */
  async upsertHourlyAverage(pair: PairKey, tsMs: number, price: number): Promise<number> {
    const hour = this.hourBucket(tsMs);
    const q = `
      INSERT INTO hourly_averages (pair, hour_start, sum, count)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (pair, hour_start)
      DO UPDATE SET sum = hourly_averages.sum + EXCLUDED.sum,
                    count = hourly_averages.count + 1
      RETURNING sum, count;
    `;
    const res = await this.pool.query(q, [pair, hour, price]);
    const row = res.rows[0];
    const avg = row.sum / Number(row.count || 1);
    return avg;
  }

  async listPairs() {
    return Object.entries(PAIRS).map(([pair, symbol]) => ({ pair, symbol }));
  }

  async hourlyHistory(pair: PairKey, hours: number) {
    const now = Date.now();
    const from = this.hourBucket(now - hours * 3600000);
    const q = `
      SELECT pair, hour_start, sum, count
      FROM hourly_averages
      WHERE pair = $1 AND hour_start >= $2
      ORDER BY hour_start ASC;
    `;
    const res = await this.pool.query(q, [pair, from]);
    return res.rows.map((r) => ({
      pair: r.pair as PairKey,
      hourStart: Number(r.hour_start),
      avg: Number(r.sum) / Math.max(1, Number(r.count)),
      count: Number(r.count),
    }));
  }

  async health() {
    try {
      await this.pool.query('SELECT 1');
      return { ok: true };
    } catch (e) {
      // Only log errors in non-test environments to reduce test noise
      if (process.env.NODE_ENV !== 'test') {
        logger.error({ err: e }, 'DB health check failed');
      }
      return { ok: false };
    }
  }
}
