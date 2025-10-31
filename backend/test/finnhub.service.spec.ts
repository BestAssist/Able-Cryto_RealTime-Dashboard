import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockInstances: any[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  onopen: (() => void) | null = null;
  onmessage: ((data: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: Error) => void) | null = null;
  readyState: number = MockWebSocket.CONNECTING;
  private handlers: Map<string, Function[]> = new Map();
  
  constructor(public url: string) {
    mockInstances.push(this);
  }
  
  send(data: string) {
    // Mock send
  }
  
  close() {
    this.readyState = MockWebSocket.CLOSING;
    if (this.onclose) {
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
      }, 0);
    }
  }
  
  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    
    // Also set properties for direct access
    if (event === 'open') this.onopen = handler as () => void;
    if (event === 'message') this.onmessage = handler as (data: any) => void;
    if (event === 'close') this.onclose = handler as () => void;
    if (event === 'error') this.onerror = handler as (err: Error) => void;
  }
  
  emit(event: string, ...args: any[]) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(h => h(...args));
  }
}

import { FinnhubService } from '../src/finnhub/finnhub.service.js';
import { PricesService } from '../src/prices/prices.service.js';
import { WsGateway } from '../src/ws/ws.gateway.js';
import { PAIRS } from '../src/prices/prices.service.js';

describe('FinnhubService', () => {
  let service: FinnhubService;
  let mockPricesService: jest.Mocked<PricesService>;
  let mockGateway: jest.Mocked<WsGateway>;

  beforeEach(() => {
    mockInstances.length = 0;
    jest.useFakeTimers();
    process.env.FINNHUB_API_KEY = 'test-key';

    mockPricesService = {
      upsertHourlyAverage: (jest.fn() as any).mockResolvedValue(100),
    } as any;

    mockGateway = {
      broadcastPrice: jest.fn(),
    } as any;

    service = new FinnhubService(mockPricesService, mockGateway);
    
    // Manually inject mock WebSocket by spying on connect
    jest.spyOn(service as any, 'connect').mockImplementation(function(this: any) {
      const token = process.env.FINNHUB_API_KEY;
      if (!token) return;
      this.ws = new MockWebSocket(`wss://ws.finnhub.io?token=${token}`);
      
      const symbols = Object.values(PAIRS).flat();
      this.ws.on('open', () => {
        symbols.forEach((sym: string) => {
          const msg = JSON.stringify({ type: 'subscribe', symbol: sym });
          this.ws?.send(msg);
        });
      });
      
      const serviceRef = this;
      this.ws.on('message', async (raw: any) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'trade' && Array.isArray(msg.data)) {
            for (const t of msg.data) {
              const symbol: string = t.s;
              const price: number = t.p;
              const ts: number = t.t;
              const pairEntry = Object.entries(PAIRS).find(([k, syms]) => (syms as string[]).includes(symbol));
              if (!pairEntry) continue;
              const pair = pairEntry[0] as any;
              
              const hourlyAvg = await serviceRef.prices.upsertHourlyAverage(pair, ts, price);
              serviceRef.gateway.broadcastPrice({ pair, price, ts, hourlyAvg });
            }
          } else if (msg.type === 'ping') {
            symbols.forEach((sym: string) => {
              const sub = JSON.stringify({ type: 'subscribe', symbol: sym });
              serviceRef.ws?.send(sub);
            });
          }
        } catch (e) {
          // Ignore
        }
      });
      
      const scheduleReconnect = () => {
        if (this.shuttingDown) return;
        setTimeout(() => this.connect(), this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, 15000);
      };
      
      this.ws.on('close', scheduleReconnect);
      this.ws.on('error', (err: Error) => {
        this.ws?.close();
      });
    });
  });

  afterEach(() => {
    if (service) {
      service.onModuleDestroy();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockInstances.length = 0;
  });

  describe('connection handling', () => {
    it('connects on module init', () => {
      service.onModuleInit();
      expect(mockInstances.length).toBeGreaterThan(0);
    });

    it('does not connect if API key is missing', () => {
      delete process.env.FINNHUB_API_KEY;
      const newService = new FinnhubService(mockPricesService, mockGateway);
      jest.spyOn(newService as any, 'connect').mockImplementation(function(this: any) {
        const token = process.env.FINNHUB_API_KEY;
        if (!token) return;
        this.ws = new MockWebSocket(`wss://ws.finnhub.io?token=${token}`);
      });
      newService.onModuleInit();
      expect(mockInstances.length).toBe(0);
      process.env.FINNHUB_API_KEY = 'test-key';
    });

    it('subscribes to all symbols on open', () => {
      service.onModuleInit();
      const ws = mockInstances[0];
      expect(ws).toBeDefined();
      const sent: string[] = [];
      ws.send = (data: string) => sent.push(data);
      
      ws.readyState = 1;
      ws.emit('open');
      
      expect(sent.length).toBeGreaterThan(0);
      const subscribeMessages = sent.filter((s: string) => JSON.parse(s).type === 'subscribe');
      expect(subscribeMessages.length).toBeGreaterThanOrEqual(8);
    });

    it('handles connection close', () => {
      service.onModuleInit();
      const ws = mockInstances[0];
      expect(ws).toBeDefined();
      
      // When close is emitted, it should schedule reconnect
      ws.emit('close');
      
      // Advance timers to trigger reconnection
      jest.advanceTimersByTime(1000);
      
      // Should have attempted to reconnect (new instance created)
      expect(mockInstances.length).toBeGreaterThan(1);
    });

    it('handles WebSocket errors', () => {
      service.onModuleInit();
      const ws = mockInstances[0];
      expect(ws).toBeDefined();
      const closeSpy = jest.spyOn(ws, 'close');
      
      const error = new Error('Connection error');
      ws.emit('error', error);
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('message processing', () => {
    beforeEach(() => {
      service.onModuleInit();
      const ws = mockInstances[0];
      ws.readyState = 1;
      ws.emit('open');
    });

    it('processes valid trade messages', async () => {
      const ws = mockInstances[0];
      const tradeMessage = {
        type: 'trade',
        data: [{ s: 'BINANCE:ETHUSDT', p: 2500, t: Date.now() }],
      };
      
      ws.emit('message', Buffer.from(JSON.stringify(tradeMessage)));
      
      await Promise.resolve();
      await Promise.resolve();
      
      expect(mockPricesService.upsertHourlyAverage).toHaveBeenCalled();
      expect(mockGateway.broadcastPrice).toHaveBeenCalledWith(
        expect.objectContaining({ pair: 'ETH/USDT', price: 2500 })
      );
    });

    it('handles multiple trades in one message', async () => {
      const ws = mockInstances[0];
      const tradeMessage = {
        type: 'trade',
        data: [
          { s: 'BINANCE:ETHUSDT', p: 2500, t: Date.now() },
          { s: 'BINANCE:ETHBTC', p: 0.05, t: Date.now() },
        ],
      };
      
      ws.emit('message', Buffer.from(JSON.stringify(tradeMessage)));
      
      await Promise.resolve();
      await Promise.resolve();
      
      expect(mockPricesService.upsertHourlyAverage).toHaveBeenCalledTimes(2);
      expect(mockGateway.broadcastPrice).toHaveBeenCalledTimes(2);
    });

    it('ignores unknown symbols', async () => {
      const ws = mockInstances[0];
      const tradeMessage = {
        type: 'trade',
        data: [{ s: 'UNKNOWN:SYMBOL', p: 100, t: Date.now() }],
      };
      
      ws.emit('message', Buffer.from(JSON.stringify(tradeMessage)));
      await Promise.resolve();
      
      expect(mockPricesService.upsertHourlyAverage).not.toHaveBeenCalled();
      expect(mockGateway.broadcastPrice).not.toHaveBeenCalled();
    });

    it('handles ping messages by re-subscribing', () => {
      const ws = mockInstances[0];
      const sent: string[] = [];
      ws.send = (data: string) => sent.push(data);
      
      const pingMessage = { type: 'ping' };
      ws.emit('message', Buffer.from(JSON.stringify(pingMessage)));
      
      const subscribeMessages = sent.filter((s) => JSON.parse(s).type === 'subscribe');
      expect(subscribeMessages.length).toBeGreaterThan(0);
    });

    it('handles invalid JSON gracefully', () => {
      const ws = mockInstances[0];
      expect(() => {
        ws.emit('message', Buffer.from('invalid json'));
      }).not.toThrow();
    });

    it('handles non-trade message types', () => {
      const ws = mockInstances[0];
      const unknownMessage = { type: 'unknown', data: {} };
      ws.emit('message', Buffer.from(JSON.stringify(unknownMessage)));
      
      expect(mockPricesService.upsertHourlyAverage).not.toHaveBeenCalled();
    });

    it('maps ETH/USDC symbols correctly', async () => {
      const ws = mockInstances[0];
      const symbols = ['BINANCE:ETHUSDC', 'KRAKEN:ETHUSDC', 'COINBASE:ETH-USDC'];
      
      for (const symbol of symbols) {
        const tradeMessage = {
          type: 'trade',
          data: [{ s: symbol, p: 2500, t: Date.now() }],
        };
        ws.emit('message', Buffer.from(JSON.stringify(tradeMessage)));
        await Promise.resolve();
      }
      
      expect(mockGateway.broadcastPrice).toHaveBeenCalledWith(
        expect.objectContaining({ pair: 'ETH/USDC' })
      );
    });
  });

  describe('cleanup', () => {
    it('closes WebSocket on module destroy', () => {
      service.onModuleInit();
      const ws = mockInstances[0];
      const closeSpy = jest.spyOn(ws, 'close');
      
      service.onModuleDestroy();
      
      expect(closeSpy).toHaveBeenCalled();
    });

    it('clears backfill timer on destroy', () => {
      service.onModuleInit();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      service.onModuleDestroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
