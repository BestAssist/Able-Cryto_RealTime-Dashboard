import { WsGateway } from '../src/ws/ws.gateway.js'
import { NormalizedTick } from '../src/prices/prices.service.js'
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('WsGateway', () => {
  let gateway: WsGateway;

  beforeEach(() => {
    gateway = new WsGateway();
  });

  describe('broadcastPrice', () => {
    it('sends message to ready clients only', () => {
      const sent: string[] = [];
      const clientOpen = { readyState: 1, send: (msg: string) => sent.push(msg) };
      const clientConnecting = { readyState: 0, send: () => { throw new Error('should not send') } };
      const clientClosing = { readyState: 2, send: () => { throw new Error('should not send') } };
      const clientClosed = { readyState: 3, send: () => { throw new Error('should not send') } };
      
      (gateway as any).server = { clients: [clientOpen, clientConnecting, clientClosing, clientClosed] };
      
      const tick: NormalizedTick = { pair: 'ETH/USDT', price: 100, ts: Date.now(), hourlyAvg: 99 };
      gateway.broadcastPrice(tick);
      
      expect(sent).toHaveLength(1);
      const parsed = JSON.parse(sent[0]);
      expect(parsed.type).toBe('price');
      expect(parsed.data.pair).toBe('ETH/USDT');
      expect(parsed.data.price).toBe(100);
    });

    it('handles no clients connected', () => {
      (gateway as any).server = { clients: [] };
      const tick: NormalizedTick = { pair: 'ETH/USDC', price: 200, ts: Date.now(), hourlyAvg: 199 };
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();
    });

    it('handles server being null', () => {
      (gateway as any).server = null;
      const tick: NormalizedTick = { pair: 'ETH/BTC', price: 0.05, ts: Date.now(), hourlyAvg: 0.049 };
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();
    });

    it('handles server being undefined', () => {
      (gateway as any).server = undefined;
      const tick: NormalizedTick = { pair: 'ETH/USDT', price: 150, ts: Date.now(), hourlyAvg: 149 };
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();
    });

    it('continues broadcasting even if one client send fails', () => {
      const sent: string[] = [];
      const clientOk1 = { readyState: 1, send: (msg: string) => sent.push(msg) };
      const clientFails = { readyState: 1, send: () => { throw new Error('send failed') } };
      const clientOk2 = { readyState: 1, send: (msg: string) => sent.push(msg) };
      
      (gateway as any).server = { clients: [clientOk1, clientFails, clientOk2] };
      
      const tick: NormalizedTick = { pair: 'ETH/USDT', price: 100, ts: Date.now(), hourlyAvg: 99 };
      expect(() => gateway.broadcastPrice(tick)).not.toThrow();
      expect(sent).toHaveLength(2); // Two successful sends
    });

    it('broadcasts to all pairs correctly', () => {
      const sent: string[] = [];
      const client = { readyState: 1, send: (msg: string) => sent.push(msg) };
      (gateway as any).server = { clients: [client] };
      
      const pairs: Array<'ETH/USDC' | 'ETH/USDT' | 'ETH/BTC'> = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
      pairs.forEach((pair, idx) => {
        const tick: NormalizedTick = { pair, price: 100 + idx, ts: Date.now(), hourlyAvg: 99 + idx };
        gateway.broadcastPrice(tick);
      });
      
      expect(sent).toHaveLength(3);
      expect(JSON.parse(sent[0]).data.pair).toBe('ETH/USDC');
      expect(JSON.parse(sent[1]).data.pair).toBe('ETH/USDT');
      expect(JSON.parse(sent[2]).data.pair).toBe('ETH/BTC');
    });

    it('uses forEach correctly with Set-like clients', () => {
      const sent: string[] = [];
      const client1 = { readyState: 1, send: (msg: string) => sent.push(`1:${msg}`) };
      const client2 = { readyState: 1, send: (msg: string) => sent.push(`2:${msg}`) };
      
      // Simulate Set-like behavior (WebSocket.Server.clients is a Set)
      const clientsArray = [client1, client2];
      (gateway as any).server = { clients: clientsArray };
      
      const tick: NormalizedTick = { pair: 'ETH/USDT', price: 100, ts: Date.now(), hourlyAvg: 99 };
      gateway.broadcastPrice(tick);
      
      expect(sent).toHaveLength(2);
      expect(sent[0]).toContain('"pair":"ETH/USDT"');
      expect(sent[1]).toContain('"pair":"ETH/USDT"');
    });
  });
});


