import { PricesService } from '../src/prices/prices.service.js';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('PricesService', () => {
  let service: PricesService;
  let mockPool: any;

  beforeEach(() => {
    service = new PricesService();
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    };
    // @ts-ignore - access private pool for testing
    service['pool'] = mockPool;
  });

  describe('hourBucket', () => {
    it('computes hourly bucket correctly at start of hour', () => {
      const now = new Date('2024-01-01T12:00:00.000Z').getTime();
      // @ts-ignore - private method access for test
      const hour = service['hourBucket'](now);
      expect(new Date(hour).toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });

    it('computes hourly bucket correctly mid-hour', () => {
      const now = new Date('2024-01-01T12:34:56.789Z').getTime();
      // @ts-ignore - private method access for test
      const hour = service['hourBucket'](now);
      expect(new Date(hour).toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });

    it('computes hourly bucket correctly at end of hour', () => {
      const now = new Date('2024-01-01T12:59:59.999Z').getTime();
      // @ts-ignore - private method access for test
      const hour = service['hourBucket'](now);
      expect(new Date(hour).toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('upsertHourlyAverage', () => {
    it('inserts new hourly bucket correctly', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ sum: 100, count: 1 }] });
      const ts = Date.UTC(2024, 0, 1, 12, 34, 56);
      const avg = await service.upsertHourlyAverage('ETH/USDT', ts, 100);
      expect(avg).toBe(100);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hourly_averages'),
        ['ETH/USDT', Math.floor(ts / 3600000) * 3600000, 100]
      );
    });

    it('updates existing hourly bucket and calculates average', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ sum: 200, count: 4 }] });
      const ts = Date.UTC(2024, 0, 1, 12, 34, 56);
      const avg = await service.upsertHourlyAverage('ETH/USDT', ts, 50);
      expect(avg).toBe(50); // 200 / 4 = 50
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['ETH/USDT', Math.floor(ts / 3600000) * 3600000, 50]
      );
    });

    it('handles count = 0 gracefully', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ sum: 0, count: 0 }] });
      const ts = Date.UTC(2024, 0, 1, 12, 34, 56);
      const avg = await service.upsertHourlyAverage('ETH/USDC', ts, 100);
      expect(Number.isFinite(avg)).toBe(true);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('handles database errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'));
      const ts = Date.UTC(2024, 0, 1, 12, 34, 56);
      await expect(
        service.upsertHourlyAverage('ETH/USDT', ts, 100)
      ).rejects.toThrow('DB connection failed');
    });

    it('works with all pair types', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ sum: 100, count: 1 }] });
      const pairs: Array<'ETH/USDC' | 'ETH/USDT' | 'ETH/BTC'> = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
      for (const pair of pairs) {
        await service.upsertHourlyAverage(pair, Date.now(), 100);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([pair])
        );
      }
    });
  });

  describe('hourlyHistory', () => {
    it('maps rows to typed output correctly', async () => {
      const now = Date.now();
      mockPool.query.mockResolvedValueOnce({
        rows: [{ pair: 'ETH/USDT', hour_start: now, sum: 1000, count: 4 }],
      });
      const rows = await service.hourlyHistory('ETH/USDT', 1);
      expect(rows).toHaveLength(1);
      expect(rows[0].pair).toBe('ETH/USDT');
      expect(rows[0].hourStart).toBe(now);
      expect(rows[0].avg).toBeCloseTo(250);
      expect(rows[0].count).toBe(4);
    });

    it('returns empty array when no history exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const rows = await service.hourlyHistory('ETH/USDC', 1);
      expect(rows).toHaveLength(0);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['ETH/USDC', expect.any(Number)]
      );
    });

    it('handles multiple hours correctly', async () => {
      const now = Date.now();
      const hour1 = Math.floor(now / 3600000) * 3600000;
      const hour2 = hour1 - 3600000;
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { pair: 'ETH/USDT', hour_start: hour2, sum: 500, count: 2 },
          { pair: 'ETH/USDT', hour_start: hour1, sum: 1000, count: 4 },
        ],
      });
      const rows = await service.hourlyHistory('ETH/USDT', 2);
      expect(rows).toHaveLength(2);
      expect(rows[0].hourStart).toBe(hour2);
      expect(rows[0].avg).toBeCloseTo(250);
      expect(rows[1].hourStart).toBe(hour1);
      expect(rows[1].avg).toBeCloseTo(250);
    });

    it('handles database errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));
      await expect(service.hourlyHistory('ETH/USDT', 1)).rejects.toThrow('Query failed');
    });

    it('calculates correct average when count is 0', async () => {
      const now = Date.now();
      mockPool.query.mockResolvedValueOnce({
        rows: [{ pair: 'ETH/USDT', hour_start: now, sum: 0, count: 0 }],
      });
      const rows = await service.hourlyHistory('ETH/USDT', 1);
      expect(rows[0].avg).toBe(0); // Math.max(1, 0) prevents division by zero
    });
  });

  describe('listPairs', () => {
    it('returns all pairs with their symbols', async () => {
      const pairs = await service.listPairs();
      expect(pairs).toHaveLength(3);
      expect(pairs.find((p) => p.pair === 'ETH/USDC')).toBeDefined();
      expect(pairs.find((p) => p.pair === 'ETH/USDT')).toBeDefined();
      expect(pairs.find((p) => p.pair === 'ETH/BTC')).toBeDefined();
      expect(pairs.find((p) => p.pair === 'ETH/USDC')?.symbols).toHaveLength(6);
      expect(pairs.find((p) => p.pair === 'ETH/USDT')?.symbols).toHaveLength(1);
    });
  });

  describe('health', () => {
    it('returns ok: true when database is healthy', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const health = await service.health();
      expect(health).toEqual({ ok: true });
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns ok: false when database query fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));
      const health = await service.health();
      expect(health).toEqual({ ok: false });
    });

    it('handles connection timeout', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.name = 'TimeoutError';
      mockPool.query.mockRejectedValueOnce(timeoutError);
      const health = await service.health();
      expect(health).toEqual({ ok: false });
    });
  });
});
