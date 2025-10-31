import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { Toasts, showToast } from '../components/Toasts'

describe('Toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders toast and auto-dismisses', () => {
    render(<Toasts />)
    
    act(() => {
      showToast('error', 'Test error message')
    })
    
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    
    // Advance timers past the 4500ms auto-dismiss timeout
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    
    // Toast should be dismissed
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument()
  })
})
