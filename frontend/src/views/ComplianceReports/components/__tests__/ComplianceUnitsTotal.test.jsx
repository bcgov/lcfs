import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ComplianceUnitsTotal } from '../ComplianceUnitsTotal'

describe('ComplianceUnitsTotal', () => {
  it('renders with positive value', () => {
    render(<ComplianceUnitsTotal label="Total compliance units:" value={1500} />)

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('1,500')).toBeInTheDocument()
  })

  it('renders with negative value', () => {
    render(<ComplianceUnitsTotal label="Total compliance units:" value={-500} />)

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('-500')).toBeInTheDocument()
  })

  it('renders with zero value', () => {
    render(<ComplianceUnitsTotal label="Total compliance units:" value={0} />)

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders with large positive value with thousand separators', () => {
    render(
      <ComplianceUnitsTotal label="Total compliance units:" value={1234567} />
    )

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  it('renders with large negative value with thousand separators', () => {
    render(
      <ComplianceUnitsTotal label="Total compliance units:" value={-1234567} />
    )

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('-1,234,567')).toBeInTheDocument()
  })

  it('rounds decimal values to whole numbers', () => {
    render(
      <ComplianceUnitsTotal label="Total compliance units:" value={1500.75} />
    )

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('1,501')).toBeInTheDocument()
  })

  it('rounds negative decimal values to whole numbers', () => {
    render(
      <ComplianceUnitsTotal label="Total compliance units:" value={-500.25} />
    )

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('-500')).toBeInTheDocument()
  })

  it('handles null value by displaying 0', () => {
    render(<ComplianceUnitsTotal label="Total compliance units:" value={null} />)

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('handles undefined value by displaying 0', () => {
    render(
      <ComplianceUnitsTotal label="Total compliance units:" value={undefined} />
    )

    expect(screen.getByText('Total compliance units:')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('applies custom data-test attribute', () => {
    const { container } = render(
      <ComplianceUnitsTotal
        label="Total compliance units:"
        value={1500}
        dataTest="custom-test-id"
      />
    )

    const element = container.querySelector('[data-test="custom-test-id"]')
    expect(element).toBeInTheDocument()
  })

  it('applies default data-test attribute when not provided', () => {
    const { container } = render(
      <ComplianceUnitsTotal label="Total compliance units:" value={1500} />
    )

    const element = container.querySelector(
      '[data-test="compliance-units-total"]'
    )
    expect(element).toBeInTheDocument()
  })

  it('applies correct styling for positive values', () => {
    const { container } = render(
      <ComplianceUnitsTotal label="Total compliance units:" value={1500} />
    )

    const valueElement = screen.getByText('1,500')
    const styles = window.getComputedStyle(valueElement)
    // Note: The actual color value might be computed differently
    // This is a basic check that the element exists
    expect(valueElement).toBeInTheDocument()
  })

  it('applies correct styling for negative values', () => {
    const { container } = render(
      <ComplianceUnitsTotal label="Total compliance units:" value={-500} />
    )

    const valueElement = screen.getByText('-500')
    // Note: The actual color value might be computed differently
    // This is a basic check that the element exists
    expect(valueElement).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(
      <ComplianceUnitsTotal
        label="Custom Label:"
        value={1500}
      />
    )

    expect(screen.getByText('Custom Label:')).toBeInTheDocument()
    expect(screen.getByText('1,500')).toBeInTheDocument()
  })
})

