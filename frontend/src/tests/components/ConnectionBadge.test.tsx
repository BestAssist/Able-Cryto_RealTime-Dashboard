import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionBadge } from '../../components/ConnectionBadge';

describe('ConnectionBadge', () => {
  it('should render connected state', () => {
    render(<ConnectionBadge state="connected" />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByTitle('WebSocket connected')).toBeInTheDocument();
  });

  it('should render connecting state', () => {
    render(<ConnectionBadge state="connecting" />);
    
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(screen.getByTitle('WebSocket connecting…')).toBeInTheDocument();
  });

  it('should render disconnected state', () => {
    render(<ConnectionBadge state="disconnected" />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByTitle('WebSocket disconnected')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for connected state', () => {
    const { container } = render(<ConnectionBadge state="connected" />);
    
    const badge = container.querySelector('.badge.ok');
    const dot = container.querySelector('.dot.ok');
    
    expect(badge).toBeInTheDocument();
    expect(dot).toBeInTheDocument();
  });

  it('should apply correct CSS classes for connecting state', () => {
    const { container } = render(<ConnectionBadge state="connecting" />);
    
    const badge = container.querySelector('.badge.conn');
    const dot = container.querySelector('.dot.conn');
    
    expect(badge).toBeInTheDocument();
    expect(dot).toBeInTheDocument();
  });

  it('should apply correct CSS classes for disconnected state', () => {
    const { container } = render(<ConnectionBadge state="disconnected" />);
    
    const badge = container.querySelector('.badge.bad');
    const dot = container.querySelector('.dot.bad');
    
    expect(badge).toBeInTheDocument();
    expect(dot).toBeInTheDocument();
  });
});

