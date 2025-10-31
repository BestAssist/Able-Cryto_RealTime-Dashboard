import { Test, TestingModule } from '@nestjs/testing';
import { WsGateway } from '../src/ws/ws.gateway';
import { NormalizedTick } from '../src/prices/prices.service';

describe('WsGateway', () => {
  let gateway: WsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WsGateway],
    }).compile();

    gateway = module.get<WsGateway>(WsGateway);
  });

  describe('broadcastPrice', () => {
    it('should broadcast price to all connected clients', () => {
      const mockClients = [
        { readyState: 1, send: jest.fn() }, // OPEN
        { readyState: 1, send: jest.fn() }, // OPEN
        { readyState: 2, send: jest.fn() }, // CLOSING - should be skipped
        { readyState: 0, send: jest.fn() }, // CONNECTING - should be skipped
      ];

      gateway.server = {
        clients: new Set(mockClients),
      } as any;

      const tick: NormalizedTick = {
        pair: 'ETH/USDC',
        price: 1000.5,
        ts: Date.now(),
        hourlyAvg: 1000.0,
      };

      gateway.broadcastPrice(tick);

      const expectedMessage = JSON.stringify({ type: 'price', data: tick });

      expect(mockClients[0].send).toHaveBeenCalledWith(expectedMessage);
      expect(mockClients[1].send).toHaveBeenCalledWith(expectedMessage);
      expect(mockClients[2].send).not.toHaveBeenCalled();
      expect(mockClients[3].send).not.toHaveBeenCalled();
    });

    it('should handle client send errors gracefully', () => {
      const mockClients = [
        { readyState: 1, send: jest.fn().mockImplementation(() => { throw new Error('Send failed'); }) },
        { readyState: 1, send: jest.fn() },
      ];

      gateway.server = {
        clients: new Set(mockClients),
      } as any;

      const tick: NormalizedTick = {
        pair: 'ETH/USDT',
        price: 1001.0,
        ts: Date.now(),
        hourlyAvg: 1000.5,
      };

      // Should not throw
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();

      // Should still try to send to the second client
      expect(mockClients[1].send).toHaveBeenCalled();
    });

    it('should handle empty clients set', () => {
      gateway.server = {
        clients: new Set(),
      } as any;

      const tick: NormalizedTick = {
        pair: 'ETH/BTC',
        price: 0.05,
        ts: Date.now(),
        hourlyAvg: 0.049,
      };

      // Should not throw
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();
    });

    it('should handle undefined server', () => {
      gateway.server = undefined as any;

      const tick: NormalizedTick = {
        pair: 'ETH/USDC',
        price: 1000.5,
        ts: Date.now(),
        hourlyAvg: 1000.0,
      };

      // Should not throw
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();
    });

    it('should handle all three pairs', () => {
      const mockClient = { readyState: 1, send: jest.fn() };
      gateway.server = {
        clients: new Set([mockClient]),
      } as any;

      const pairs: Array<NormalizedTick['pair']> = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
      
      pairs.forEach((pair, index) => {
        const tick: NormalizedTick = {
          pair,
          price: 1000 + index,
          ts: Date.now() + index,
          hourlyAvg: 999 + index,
        };
        
        gateway.broadcastPrice(tick);
      });

      expect(mockClient.send).toHaveBeenCalledTimes(3);
    });

    it('should correctly format message structure', () => {
      const mockClient = { readyState: 1, send: jest.fn() };
      gateway.server = {
        clients: new Set([mockClient]),
      } as any;

      const tick: NormalizedTick = {
        pair: 'ETH/USDC',
        price: 1234.5678,
        ts: 1609459200000,
        hourlyAvg: 1234.0,
      };

      gateway.broadcastPrice(tick);

      const sentMessage = mockClient.send.mock.calls[0][0];
      const parsed = JSON.parse(sentMessage);

      expect(parsed).toEqual({
        type: 'price',
        data: tick,
      });
    });
  });
});

