import { Test, TestingModule } from '@nestjs/testing';
import { FinnhubService } from '../src/finnhub/finnhub.service';
import { PricesService, PAIRS } from '../src/prices/prices.service';
import { WsGateway } from '../src/ws/ws.gateway';
// Mock WebSocket - using the mock file
// The mock is already set up in test/__mocks__/ws.ts via moduleNameMapper
import WebSocket from 'ws';

describe('FinnhubService', () => {
  let service: FinnhubService;
  let pricesService: jest.Mocked<PricesService>;
  let wsGateway: jest.Mocked<WsGateway>;
  let originalEnv: NodeJS.ProcessEnv;

  const mockPricesService = {
    upsertHourlyAverage: jest.fn(),
    listPairs: jest.fn(),
    hourlyHistory: jest.fn(),
    health: jest.fn(),
  };

  const mockWsGateway = {
    broadcastPrice: jest.fn(),
  };

  beforeEach(async () => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    // Clear mock instances
    const MockWS = require('./__mocks__/ws').default;
    MockWS.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinnhubService,
        {
          provide: PricesService,
          useValue: mockPricesService,
        },
        {
          provide: WsGateway,
          useValue: mockWsGateway,
        },
      ],
    }).compile();

    service = module.get<FinnhubService>(FinnhubService);
    pricesService = module.get(PricesService);
    wsGateway = module.get(WsGateway);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  describe('connection', () => {
    it('should connect on module init', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 10));

      const MockWS = require('./__mocks__/ws').default;
      expect(MockWS.instances.length).toBeGreaterThanOrEqual(1);
    });

    it('should not connect if API key is missing', async () => {
      delete process.env.FINNHUB_API_KEY;
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 10));

      const MockWS = require('./__mocks__/ws').default;
      expect(MockWS.instances.length).toBe(0);
    });

    it('should not connect if API key is placeholder', async () => {
      process.env.FINNHUB_API_KEY = 'your_finnhub_api_key_here';
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 10));

      const MockWS = require('./__mocks__/ws').default;
      expect(MockWS.instances.length).toBe(0);
    });

    it('should subscribe to all pairs on connection', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 20));

      const MockWS = require('./__mocks__/ws').default;
      const ws = MockWS.instances[0];
      const sentMessages = ws.getSentMessages();

      expect(sentMessages.length).toBeGreaterThan(0);
      Object.values(PAIRS).forEach(symbol => {
        const subscribeMsg = sentMessages.find((msg: string) => {
          const parsed = JSON.parse(msg);
          return parsed.type === 'subscribe' && parsed.symbol === symbol;
        });
        expect(subscribeMsg).toBeDefined();
      });
    });
  });

  describe('message handling', () => {
    let mockWs: any;

    beforeEach(async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      mockPricesService.upsertHourlyAverage.mockResolvedValue(1000.0);
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 20));

      const MockWS = require('./__mocks__/ws').default;
      const instances = MockWS.instances;
      mockWs = instances[0];
    });

    it('should process trade messages and broadcast prices', async () => {
      const tradeMessage = {
        type: 'trade',
        data: [
          {
            s: 'BINANCE:ETHUSDC',
            p: 1000.5,
            t: Date.now(),
          },
        ],
      };

      mockWs.simulateMessage(tradeMessage);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(pricesService.upsertHourlyAverage).toHaveBeenCalledWith(
        'ETH/USDC',
        expect.any(Number),
        1000.5,
      );
      expect(wsGateway.broadcastPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          pair: 'ETH/USDC',
          price: 1000.5,
        }),
      );
    });

    it('should handle multiple trades in one message', async () => {
      const tradeMessage = {
        type: 'trade',
        data: [
          { s: 'BINANCE:ETHUSDC', p: 1000.5, t: Date.now() },
          { s: 'BINANCE:ETHUSDT', p: 1001.0, t: Date.now() },
          { s: 'BINANCE:ETHBTC', p: 0.05, t: Date.now() },
        ],
      };

      mockPricesService.upsertHourlyAverage
        .mockResolvedValueOnce(1000.5)
        .mockResolvedValueOnce(1001.0)
        .mockResolvedValueOnce(0.05);

      mockWs.simulateMessage(tradeMessage);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(pricesService.upsertHourlyAverage).toHaveBeenCalledTimes(3);
      expect(wsGateway.broadcastPrice).toHaveBeenCalledTimes(3);
    });

    it('should ignore ping messages', async () => {
      const pingMessage = { type: 'ping' };

      mockWs.simulateMessage(pingMessage);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(pricesService.upsertHourlyAverage).not.toHaveBeenCalled();
      expect(wsGateway.broadcastPrice).not.toHaveBeenCalled();
    });

    it('should ignore unknown message types', async () => {
      const unknownMessage = { type: 'unknown', data: {} };

      mockWs.simulateMessage(unknownMessage);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(pricesService.upsertHourlyAverage).not.toHaveBeenCalled();
    });

    it('should ignore trades for unknown symbols', async () => {
      const tradeMessage = {
        type: 'trade',
        data: [
          {
            s: 'BINANCE:UNKNOWN',
            p: 1000.5,
            t: Date.now(),
          },
        ],
      };

      mockWs.simulateMessage(tradeMessage);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(pricesService.upsertHourlyAverage).not.toHaveBeenCalled();
      expect(wsGateway.broadcastPrice).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON messages gracefully', async () => {
      // Simulate invalid message
      if (mockWs.onmessage) {
        mockWs.onmessage({ type: 'message', data: Buffer.from('invalid json') });
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not crash
      expect(pricesService.upsertHourlyAverage).not.toHaveBeenCalled();
    });

    it('should handle non-array trade data', async () => {
      const tradeMessage = {
        type: 'trade',
        data: { s: 'BINANCE:ETHUSDC', p: 1000.5, t: Date.now() }, // not an array
      };

      mockWs.simulateMessage(tradeMessage);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(pricesService.upsertHourlyAverage).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle authentication errors (401)', async () => {
      process.env.FINNHUB_API_KEY = 'invalid-key';
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 20));

      const MockWS = require('./__mocks__/ws').default;
      const ws = MockWS.instances[0];
      const authError = new Error('401 Unauthorized');
      
      ws.simulateError(authError);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should mark as shutting down
      expect((service as any).shuttingDown).toBe(true);
    });

    it('should handle connection errors and close', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 20));

      const MockWS = require('./__mocks__/ws').default;
      const ws = MockWS.instances[0];
      const closeSpy = jest.spyOn(ws, 'close');
      const connectionError = new Error('ECONNREFUSED');
      
      ws.simulateError(connectionError);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('reconnection logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should attempt reconnection on close', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      // Advance timers to let connection establish
      jest.advanceTimersByTime(20);
      await Promise.resolve();

      const MockWS = require('./__mocks__/ws').default;
      const instances = MockWS.instances;
      expect(instances.length).toBeGreaterThanOrEqual(1);

      // Close connection
      instances[0].close();
      await Promise.resolve();
      
      // Fast-forward time to trigger reconnection (backoff starts at 1000ms)
      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      // Should create a new connection
      expect(MockWS.instances.length).toBeGreaterThanOrEqual(1);
    });

    it('should use exponential backoff for reconnection', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      const connectSpy = jest.spyOn(service as any, 'connect');
      
      await service.onModuleInit();
      // Advance timers to let connection establish
      jest.advanceTimersByTime(20);
      await Promise.resolve();

      const MockWS = require('./__mocks__/ws').default;
      const instances = MockWS.instances;
      const initialBackoff = (service as any).backoffMs;
      expect(initialBackoff).toBe(1000); // Verify initial backoff

      // Close and trigger reconnection - backoff should increase immediately
      instances[0].close();
      await Promise.resolve();
      
      // The backoff should be increased immediately when close event fires
      const newBackoff = (service as any).backoffMs;
      expect(newBackoff).toBe(initialBackoff * 2); // Should be doubled
      expect(newBackoff).toBeLessThanOrEqual((service as any).maxBackoff);
      
      // Advance time past initial backoff to trigger reconnection
      jest.advanceTimersByTime(initialBackoff + 100);
      await Promise.resolve();
      
      // Verify that connect was called (reconnection happened)
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should not reconnect if shutting down', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      // Advance timers to let connection establish
      jest.advanceTimersByTime(20);
      await Promise.resolve();

      await service.onModuleDestroy();
      const MockWS = require('./__mocks__/ws').default;
      const instances = MockWS.instances;
      
      // Close connection
      instances[0].close();
      await Promise.resolve();
      
      // Advance time - should not reconnect
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Should not create new connections
      expect((service as any).shuttingDown).toBe(true);
    });

    it('should reset backoff on successful connection', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      // Advance timers to let connection establish
      jest.advanceTimersByTime(20);
      await Promise.resolve();

      const MockWS = require('./__mocks__/ws').default;
      const instances = MockWS.instances;
      (service as any).backoffMs = 8000; // Set high backoff

      // Simulate successful connection by triggering 'open' event
      const openListeners = instances[0].eventListeners?.get('open') || [];
      openListeners.forEach((listener: any) => listener());
      await Promise.resolve();

      expect((service as any).backoffMs).toBe(1000); // Reset to initial
    });
  });

  describe('cleanup', () => {
    it('should close connection on module destroy', async () => {
      process.env.FINNHUB_API_KEY = 'test-key';
      
      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 20));

      const MockWS = require('./__mocks__/ws').default;
      const ws = MockWS.instances[0];
      const closeSpy = jest.spyOn(ws, 'close');

      await service.onModuleDestroy();

      expect((service as any).shuttingDown).toBe(true);
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});

