import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { ConnectionBadge } from '../components/ConnectionBadge'

describe('ConnectionBadge', () => {
  it('renders connected state', () => {
    const { getByText } = render(<ConnectionBadge state="connected" />)
    expect(getByText('Connected')).toBeInTheDocument()
  })
})
