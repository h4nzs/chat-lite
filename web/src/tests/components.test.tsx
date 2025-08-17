import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import OnlineDot from '../components/OnlineDot'

describe('OnlineDot', () => {
  it('renders', () => {
    render(<OnlineDot online />)
    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })
})