import { Test, TestingModule } from '@nestjs/testing';
import { PricesController } from '../src/prices/prices.controller';
import { PricesService } from '../src/prices/prices.service';
import { PairKey } from '../src/prices/prices.service';

describe('PricesController', () => {
  let controller: PricesController;
  let service: jest.Mocked<PricesService>;

  const mockPricesService = {
    health: jest.fn(),
    listPairs: jest.fn(),
    hourlyHistory: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricesController],
      providers: [
        {
          provide: PricesService,
          useValue: mockPricesService,
        },
      ],
    }).compile();

    controller = module.get<PricesController>(PricesController);
    service = module.get(PricesService);
  });

  describe('health', () => {
    it('should return health status', async () => {
      service.health.mockResolvedValue({ ok: true });

      const result = await controller.health();

      expect(result).toEqual({ ok: true });
      expect(service.health).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status', async () => {
      service.health.mockResolvedValue({ ok: false });

      const result = await controller.health();

      expect(result).toEqual({ ok: false });
      expect(service.health).toHaveBeenCalledTimes(1);
    });
  });

  describe('pairs', () => {
    it('should return list of pairs', async () => {
      const mockPairs = [
        { pair: 'ETH/USDC', symbol: 'BINANCE:ETHUSDC' },
        { pair: 'ETH/USDT', symbol: 'BINANCE:ETHUSDT' },
        { pair: 'ETH/BTC', symbol: 'BINANCE:ETHBTC' },
      ];

      service.listPairs.mockResolvedValue(mockPairs);

      const result = await controller.pairs();

      expect(result).toEqual(mockPairs);
      expect(service.listPairs).toHaveBeenCalledTimes(1);
    });
  });

  describe('averages', () => {
    it('should return hourly averages with default hours (24)', async () => {
      const pair: PairKey = 'ETH/USDC';
      const mockHistory: Array<{ pair: PairKey; hourStart: number; avg: number; count: number }> = [
        { pair: 'ETH/USDC' as PairKey, hourStart: 1609459200000, avg: 1000.0, count: 24 },
      ];

      service.hourlyHistory.mockResolvedValue(mockHistory);

      const result = await controller.averages(pair);

      expect(result).toEqual(mockHistory);
      expect(service.hourlyHistory).toHaveBeenCalledWith(pair, 24);
    });

    it('should return hourly averages with custom hours', async () => {
      const pair: PairKey = 'ETH/USDT';
      const hours = '48';
      const mockHistory: Array<{ pair: PairKey; hourStart: number; avg: number; count: number }> = [
        { pair: 'ETH/USDT' as PairKey, hourStart: 1609459200000, avg: 1000.5, count: 24 },
      ];

      service.hourlyHistory.mockResolvedValue(mockHistory);

      const result = await controller.averages(pair, hours);

      expect(result).toEqual(mockHistory);
      expect(service.hourlyHistory).toHaveBeenCalledWith(pair, 48);
    });

    it('should clamp hours to minimum 1', async () => {
      const pair: PairKey = 'ETH/BTC';
      const hours = '0';
      const mockHistory: Array<{ pair: PairKey; hourStart: number; avg: number; count: number }> = [];

      service.hourlyHistory.mockResolvedValue(mockHistory);

      const result = await controller.averages(pair, hours);

      expect(result).toEqual(mockHistory);
      expect(service.hourlyHistory).toHaveBeenCalledWith(pair, 1);
    });

    it('should clamp hours to maximum 720', async () => {
      const pair: PairKey = 'ETH/USDC';
      const hours = '1000';
      const mockHistory: Array<{ pair: PairKey; hourStart: number; avg: number; count: number }> = [];

      service.hourlyHistory.mockResolvedValue(mockHistory);

      const result = await controller.averages(pair, hours);

      expect(result).toEqual(mockHistory);
      expect(service.hourlyHistory).toHaveBeenCalledWith(pair, 720);
    });

    it('should handle invalid hours string', async () => {
      const pair: PairKey = 'ETH/USDT';
      const hours = 'invalid';
      const mockHistory: Array<{ pair: PairKey; hourStart: number; avg: number; count: number }> = [];

      service.hourlyHistory.mockResolvedValue(mockHistory);

      const result = await controller.averages(pair, hours);

      expect(result).toEqual(mockHistory);
      expect(service.hourlyHistory).toHaveBeenCalledWith(pair, 24); // defaults to 24 when NaN
    });

    it('should handle missing hours parameter', async () => {
      const pair: PairKey = 'ETH/BTC';
      const mockHistory: Array<{ pair: PairKey; hourStart: number; avg: number; count: number }> = [];

      service.hourlyHistory.mockResolvedValue(mockHistory);

      const result = await controller.averages(pair, undefined);

      expect(result).toEqual(mockHistory);
      expect(service.hourlyHistory).toHaveBeenCalledWith(pair, 24);
    });

    it('should handle all three pairs', async () => {
      const pairs: PairKey[] = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];

      for (const pair of pairs) {
        service.hourlyHistory.mockResolvedValueOnce([]);
        await controller.averages(pair);
      }

      expect(service.hourlyHistory).toHaveBeenCalledTimes(3);
    });
  });
});

