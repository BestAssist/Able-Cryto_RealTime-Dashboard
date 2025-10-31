import { Test, TestingModule } from '@nestjs/testing';
import { PricesService, PairKey } from '../src/prices/prices.service';
import * as pg from 'pg';

// Mock pg module
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('PricesService', () => {
  let service: PricesService;
  let mockPool: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mockPoolInstance = new pg.Pool() as any;
    mockPool = mockPoolInstance;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PricesService],
    }).compile();

    service = module.get<PricesService>(PricesService);
    
    // Replace the pool with our mock
    (service as any).pool = mockPool;
  });

  describe('hourBucket', () => {
    it('should calculate hour bucket correctly', () => {
      const hourBucket = (service as any).hourBucket;
      
      const ts1 = 1609459200000; // 2021-01-01 00:00:00 UTC
      expect(hourBucket(ts1)).toBe(1609459200000);
      
      const ts2 = 1609459200000 + 30 * 60 * 1000; // 30 minutes later
      expect(hourBucket(ts2)).toBe(1609459200000);
      
      const ts3 = 1609459200000 + 90 * 60 * 1000; // 90 minutes later
      expect(hourBucket(ts3)).toBe(1609462800000);
    });
  });

  describe('upsertHourlyAverage', () => {
    it('should insert new hourly average', async () => {
      const pair: PairKey = 'ETH/USDC';
      const ts = 1609459200000;
      const price = 1000.5;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ sum: 1000.5, count: 1 }],
      } as any);

      const avg = await service.upsertHourlyAverage(pair, ts, price);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hourly_averages'),
        [pair, 1609459200000, price],
      );
      expect(avg).toBe(1000.5);
    });

    it('should update existing hourly average', async () => {
      const pair: PairKey = 'ETH/USDC';
      const ts = 1609459200000;
      const price1 = 1000.5;
      const price2 = 1001.0;

      // First insert
      mockPool.query.mockResolvedValueOnce({
        rows: [{ sum: 1000.5, count: 1 }],
      } as any);
      await service.upsertHourlyAverage(pair, ts, price1);

      // Second insert (same hour) - should update
      mockPool.query.mockResolvedValueOnce({
        rows: [{ sum: 2001.5, count: 2 }],
      } as any);
      const avg = await service.upsertHourlyAverage(pair, ts, price2);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(avg).toBe(1000.75); // (2001.5 / 2)
    });

    it('should handle division by zero gracefully', async () => {
      const pair: PairKey = 'ETH/USDT';
      const ts = 1609459200000;
      const price = 1000.5;

      mockPool.query.mockResolvedValueOnce({
        rows: [{ sum: 1000.5, count: 0 }],
      } as any);

      const avg = await service.upsertHourlyAverage(pair, ts, price);

      expect(avg).toBe(1000.5); // sum / max(1, 0) = sum / 1
    });
  });

  describe('listPairs', () => {
    it('should return all pairs with their symbols', async () => {
      const pairs = await service.listPairs();

      expect(pairs).toHaveLength(3);
      expect(pairs).toContainEqual({ pair: 'ETH/USDC', symbol: 'BINANCE:ETHUSDC' });
      expect(pairs).toContainEqual({ pair: 'ETH/USDT', symbol: 'BINANCE:ETHUSDT' });
      expect(pairs).toContainEqual({ pair: 'ETH/BTC', symbol: 'BINANCE:ETHBTC' });
    });
  });

  describe('hourlyHistory', () => {
    it('should return hourly history for a pair', async () => {
      const pair: PairKey = 'ETH/USDC';
      const hours = 24;

      const mockRows = [
        {
          pair: 'ETH/USDC',
          hour_start: '1609459200000',
          sum: 24000.0,
          count: '24',
        },
        {
          pair: 'ETH/USDC',
          hour_start: '1609462800000',
          sum: 24024.0,
          count: '24',
        },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockRows,
      } as any);

      const history = await service.hourlyHistory(pair, hours);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT pair, hour_start, sum, count'),
        [pair, expect.any(Number)],
      );
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        pair: 'ETH/USDC',
        hourStart: 1609459200000,
        avg: 1000.0,
        count: 24,
      });
    });

    it('should handle empty history', async () => {
      const pair: PairKey = 'ETH/BTC';
      const hours = 24;

      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      const history = await service.hourlyHistory(pair, hours);

      expect(history).toEqual([]);
    });
  });

  describe('health', () => {
    it('should return ok: true when database is healthy', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ '?column?': 1 }],
      } as any);

      const health = await service.health();

      expect(health).toEqual({ ok: true });
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return ok: false when database query fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const health = await service.health();

      expect(health).toEqual({ ok: false });
    });

    it('should handle database connection errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const health = await service.health();

      expect(health).toEqual({ ok: false });
    });
  });

  describe('bootstrap', () => {
    it('should create table on initialization', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      // Create new service instance to trigger bootstrap
      const newService = new PricesService();

      // Wait a bit for async bootstrap
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS hourly_averages'),
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle bootstrap errors gracefully', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));

      // Should not throw
      const newService = new PricesService();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPool.connect).toHaveBeenCalled();
    });
  });
});

