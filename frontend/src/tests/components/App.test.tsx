import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';

// Mock useLivePrices hook
const mockUseLivePrices = vi.fn();

vi.mock('../../hooks/useLivePrices', () => ({
  useLivePrices: (pairs: any) => mockUseLivePrices(pairs),
}));

// Mock showToast
vi.mock('../../components/Toasts', () => ({
  showToast: vi.fn(),
  Toasts: () => <div data-testid="toasts">Toasts</div>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connecting',
      error: null,
      ticks: {
        'ETH/USDC': null,
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: false,
    });

    render(<App />);
    
    // Text is split across elements, use a more flexible matcher
    expect(screen.getByText('Able')).toBeInTheDocument();
    expect(screen.getByText(/Crypto Dashboard/)).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('should render dashboard when ready', async () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connected',
      error: null,
      ticks: {
        'ETH/USDC': {
          pair: 'ETH/USDC',
          price: 1000.5,
          ts: Date.now(),
          hourlyAvg: 1000.0,
        },
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [{ ts: Date.now(), price: 1000.5, hourlyAvg: 1000.0 }],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: true,
    });

    render(<App />);
    
    await waitFor(() => {
      // Use getAllByText since "Able" appears multiple times (header and footer)
      const ableElements = screen.getAllByText('Able');
      expect(ableElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Crypto Dashboard/)).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should render all three ticker cards', async () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connected',
      error: null,
      ticks: {
        'ETH/USDC': null,
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: true,
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('ETH/USDC')).toBeInTheDocument();
      expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
      expect(screen.getByText('ETH/BTC')).toBeInTheDocument();
    });
  });

  it('should render connection badge', async () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connected',
      error: null,
      ticks: {
        'ETH/USDC': null,
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: true,
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should display connecting state', async () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connecting',
      error: null,
      ticks: {
        'ETH/USDC': null,
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: true,
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Connecting…')).toBeInTheDocument();
    });
  });

  it('should display disconnected state', async () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'disconnected',
      error: 'Connection lost',
      ticks: {
        'ETH/USDC': null,
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: true,
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('should render Toasts component', () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connected',
      error: null,
      ticks: {
        'ETH/USDC': null,
        'ETH/USDT': null,
        'ETH/BTC': null,
      },
      series: {
        'ETH/USDC': [],
        'ETH/USDT': [],
        'ETH/BTC': [],
      },
      ready: true,
    });

    render(<App />);
    
    expect(screen.getByTestId('toasts')).toBeInTheDocument();
  });

  it('should call useLivePrices with correct pairs', () => {
    mockUseLivePrices.mockReturnValue({
      conn: 'connecting',
      error: null,
      ticks: {},
      series: {},
      ready: false,
    });

    render(<App />);
    
    expect(mockUseLivePrices).toHaveBeenCalledWith(['ETH/USDC', 'ETH/USDT', 'ETH/BTC']);
  });
});

