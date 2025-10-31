import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLivePrices } from '../../hooks/useLivePrices';
import type { PairKey } from '../../types';

// Mock fetch globally
global.fetch = vi.fn();

// Mock showToast
vi.mock('../../components/Toasts', () => ({
  showToast: vi.fn(),
}));

describe('useLivePrices', () => {
  let mockWs: any;
  const MockWS = (global as any).WebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWS.clear();
  });

  afterEach(() => {
    MockWS.clear();
  });

  describe('initialization', () => {
    it('should initialize with connecting state', () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      expect(result.current.conn).toBe('connecting');
      expect(result.current.error).toBeNull();
      expect(result.current.ready).toBe(false);
    });

    it('should fetch initial history for all pairs', async () => {
      const pairs: PairKey[] = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      renderHook(() => useLivePrices(pairs));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(pairs.length);
      });

      pairs.forEach(pair => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/averages?pair=${encodeURIComponent(pair)}&hours=24`),
        );
      });
    });

    it('should handle history fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load history');
      });
    });
  });

  describe('WebSocket connection', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });
    });

    it('should connect to WebSocket on mount', () => {
      renderHook(() => useLivePrices(['ETH/USDC']));

      expect(MockWS.instances.length).toBeGreaterThan(0);
      mockWs = MockWS.instances[MockWS.instances.length - 1];
      expect(mockWs.url).toContain('/ws');
    });

    it('should set connected state when WebSocket opens', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });
    });

    it('should handle WebSocket errors', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];
      
      act(() => {
        mockWs.simulateError();
      });

      await waitFor(() => {
        expect(result.current.conn).toBe('disconnected');
        expect(result.current.error).toBe('WebSocket error');
      }, { timeout: 2000 });
    });

    it('should reconnect on close with exponential backoff', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];
      
      act(() => {
        mockWs.simulateClose();
      });

      await waitFor(() => {
        expect(result.current.conn).toBe('disconnected');
      }, { timeout: 2000 });

      // Wait for reconnection attempt (backoff starts at 1000ms, plus 10ms for auto-connect)
      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2500 });
    });
  });

  describe('price updates', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });
    });

    it('should update ticks when receiving price messages', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];
      const tick = {
        pair: 'ETH/USDC' as PairKey,
        price: 1000.5,
        ts: Date.now(),
        hourlyAvg: 1000.0,
      };

      act(() => {
        mockWs.simulateMessage({ type: 'price', data: tick });
      });

      await waitFor(() => {
        expect(result.current.ticks['ETH/USDC']).toEqual(tick);
      }, { timeout: 2000 });
    });

    it('should update series for charts', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];
      const tick = {
        pair: 'ETH/USDC' as PairKey,
        price: 1000.5,
        ts: Date.now(),
        hourlyAvg: 1000.0,
      };

      act(() => {
        mockWs.simulateMessage({ type: 'price', data: tick });
      });

      await waitFor(() => {
        const series = result.current.series['ETH/USDC'];
        expect(series.length).toBeGreaterThan(0);
        expect(series[series.length - 1]).toEqual({
          ts: tick.ts,
          price: tick.price,
          hourlyAvg: tick.hourlyAvg,
        });
      }, { timeout: 2000 });
    });

    it('should handle multiple price updates', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];

      act(() => {
        for (let i = 0; i < 5; i++) {
          const tick = {
            pair: 'ETH/USDC' as PairKey,
            price: 1000.5 + i,
            ts: Date.now() + i * 1000,
            hourlyAvg: 1000.0 + i,
          };

          mockWs.simulateMessage({ type: 'price', data: tick });
        }
      });

      await waitFor(() => {
        expect(result.current.series['ETH/USDC'].length).toBe(5);
      }, { timeout: 2000 });
    });

    it('should limit series to 6000 items', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];

      act(() => {
        // Send 6100 messages
        for (let i = 0; i < 6100; i++) {
          const tick = {
            pair: 'ETH/USDC' as PairKey,
            price: 1000.5 + i,
            ts: Date.now() + i * 1000,
            hourlyAvg: 1000.0 + i,
          };

          mockWs.simulateMessage({ type: 'price', data: tick });
        }
      });

      await waitFor(() => {
        const series = result.current.series['ETH/USDC'];
        expect(series.length).toBeLessThanOrEqual(6000);
      }, { timeout: 3000 });
    });

    it('should ignore invalid messages', async () => {
      const { result } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];
      // Send invalid message
      act(() => {
        mockWs.simulateMessage({ type: 'invalid' });
      });

      // Should not crash - wait a bit to ensure state has settled
      await waitFor(() => {
        expect(result.current.ticks['ETH/USDC']).toBeNull();
      }, { timeout: 1000 });
    });
  });

  describe('multiple pairs', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });
    });

    it('should handle updates for all pairs', async () => {
      const pairs: PairKey[] = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
      const { result } = renderHook(() => useLivePrices(pairs));

      await waitFor(() => {
        expect(result.current.conn).toBe('connected');
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];

      await act(async () => {
        pairs.forEach((pair, index) => {
          const tick = {
            pair,
            price: 1000 + index,
            ts: Date.now() + index * 1000,
            hourlyAvg: 999 + index,
          };

          mockWs.simulateMessage({ type: 'price', data: tick });
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        pairs.forEach((pair, index) => {
          expect(result.current.ticks[pair]).toBeDefined();
          expect(result.current.ticks[pair]?.price).toBe(1000 + index);
        });
      }, { timeout: 2000 });
    });
  });

  describe('cleanup', () => {
    it('should close WebSocket on unmount', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { unmount } = renderHook(() => useLivePrices(['ETH/USDC']));

      await waitFor(() => {
        expect(MockWS.instances.length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      mockWs = MockWS.instances[MockWS.instances.length - 1];
      const closeSpy = vi.spyOn(mockWs, 'close');
      unmount();

      expect(closeSpy).toHaveBeenCalled();
    });
  });
});

