import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NotFound } from '@/components/NotFound'

describe('Not Found Component', () => {
  it('Should render the not found message', () => {
    render(<NotFound />)
    const alert = screen.getByTestId('not-found')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass('alert alert-danger error-alert')
    expect(alert).toHaveTextContent('The requested page could not be found.')
    expect(alert).toHaveTextContent(
      'To trade this page for a valid one click here or learn more about the Renewable and Low Carbon Fuel Requirements Regulation here'
    )
  })
  it('should go to the home page', async () => {
    render(<NotFound />)
    const link = screen.getByTestId('link-home')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
    fireEvent.click(link)
    expect(window.location.pathname).toBe('/')
  })
  it('should go to the learn more page', async () => {
    render(<NotFound />)
    const link = screen.getByTestId('link-learn-more')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'http://www.gov.bc.ca/lowcarbonfuels/')
    fireEvent.click(link)
    expect(window.location.pathname).toBe('/')
  })
})
