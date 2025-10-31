import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TickerCard } from '../../components/TickerCard';
import type { Tick, PairKey } from '../../types';

describe('TickerCard', () => {
  const mockTick: Tick = {
    pair: 'ETH/USDC',
    price: 1234.5678,
    ts: 1609459200000, // 2021-01-01 00:00:00 UTC
    hourlyAvg: 1234.0,
  };

  it('should render pair name', () => {
    render(<TickerCard pair="ETH/USDC" tick={null} />);
    
    expect(screen.getByText('ETH/USDC')).toBeInTheDocument();
  });

  it('should render loading state when tick is null', () => {
    render(<TickerCard pair="ETH/USDC" tick={null} />);
    
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByText(/Hourly Avg: …/)).toBeInTheDocument();
  });

  it('should render price when tick is provided', () => {
    render(<TickerCard pair="ETH/USDC" tick={mockTick} />);
    
    expect(screen.getByText('1234.5678')).toBeInTheDocument();
  });

  it('should render hourly average when tick is provided', () => {
    render(<TickerCard pair="ETH/USDC" tick={mockTick} />);
    
    expect(screen.getByText(/Hourly Avg: 1234.0000/)).toBeInTheDocument();
  });

  it('should format timestamp correctly', () => {
    const { container } = render(<TickerCard pair="ETH/USDC" tick={mockTick} />);
    
    // Check that timestamp is rendered (format may vary by locale)
    const timestampElement = container.querySelector('.subtitle');
    expect(timestampElement).toBeInTheDocument();
    expect(timestampElement?.textContent).not.toBe('—');
  });

  it('should display dash for timestamp when tick is null', () => {
    const { container } = render(<TickerCard pair="ETH/USDC" tick={null} />);
    
    const timestampElement = container.querySelector('.subtitle');
    expect(timestampElement?.textContent).toContain('—');
  });

  it('should handle different pairs', () => {
    const pairs: PairKey[] = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
    
    pairs.forEach(pair => {
      const { unmount } = render(<TickerCard pair={pair} tick={null} />);
      expect(screen.getByText(pair)).toBeInTheDocument();
      unmount();
    });
  });

  it('should format price to 4 decimal places', () => {
    const tick: Tick = {
      pair: 'ETH/USDC',
      price: 1234.5,
      ts: Date.now(),
      hourlyAvg: 1234.0,
    };

    render(<TickerCard pair="ETH/USDC" tick={tick} />);
    
    expect(screen.getByText('1234.5000')).toBeInTheDocument();
  });

  it('should format hourly average to 4 decimal places', () => {
    const tick: Tick = {
      pair: 'ETH/USDC',
      price: 1234.5678,
      ts: Date.now(),
      hourlyAvg: 1234.1234,
    };

    render(<TickerCard pair="ETH/USDC" tick={tick} />);
    
    expect(screen.getByText(/Hourly Avg: 1234.1234/)).toBeInTheDocument();
  });
});

