import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PairChart } from '../../components/PairChart';
import type { PairKey } from '../../types';

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

describe('PairChart', () => {
  it('should render pair name', () => {
    render(<PairChart pair="ETH/USDC" data={[]} />);
    
    expect(screen.getByText(/ETH\/USDC — Live/)).toBeInTheDocument();
  });

  it('should render loading state when data is empty', () => {
    render(<PairChart pair="ETH/USDC" data={[]} />);
    
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('should render chart when data is provided', () => {
    const data = [
      { ts: 1609459200000, price: 1000.5, hourlyAvg: 1000.0 },
      { ts: 1609462800000, price: 1001.0, hourlyAvg: 1000.5 },
    ];

    render(<PairChart pair="ETH/USDC" data={data} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('should render all chart components', () => {
    const data = [
      { ts: 1609459200000, price: 1000.5, hourlyAvg: 1000.0 },
    ];

    render(<PairChart pair="ETH/USDC" data={data} />);
    
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('should handle different pairs', () => {
    const pairs: PairKey[] = ['ETH/USDC', 'ETH/USDT', 'ETH/BTC'];
    const data = [
      { ts: 1609459200000, price: 1000.5, hourlyAvg: 1000.0 },
    ];

    pairs.forEach(pair => {
      const { unmount } = render(<PairChart pair={pair} data={data} />);
      expect(screen.getByText(new RegExp(`${pair.replace('/', '\\/')} — Live`))).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle large datasets', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({
      ts: 1609459200000 + i * 3600000,
      price: 1000 + i * 0.1,
      hourlyAvg: 1000 + i * 0.1,
    }));

    render(<PairChart pair="ETH/USDC" data={data} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should not show loading when data has items', () => {
    const data = [
      { ts: 1609459200000, price: 1000.5, hourlyAvg: 1000.0 },
    ];

    render(<PairChart pair="ETH/USDC" data={data} />);
    
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});

