import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, expect, vi } from 'vitest'
import SigningAuthorityDeclaration from '../SigningAuthorityDeclaration'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('SigningAuthorityDeclaration Component', () => {
  let onChangeMock

  beforeEach(() => {
    onChangeMock = vi.fn()
  })

  const renderComponent = (props) => {
    return render(<SigningAuthorityDeclaration {...props} />, { wrapper })
  }

  it('renders the component with all alerts when no props are true', () => {
    renderComponent({
      onChange: onChangeMock,
      hasAuthority: false,
      hasRecords: false,
      hasValidAddress: false
    })

    expect(screen.getByText('report:noRecords')).toBeInTheDocument()
    expect(
      screen.getByText('report:noSigningAuthorityTooltip')
    ).toBeInTheDocument()
    expect(screen.getByText('report:invalidAddress')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('renders without alerts and enables checkbox when all props are true', () => {
    renderComponent({
      onChange: onChangeMock,
      hasAuthority: true,
      hasRecords: true,
      hasValidAddress: true
    })

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeEnabled()
  })

  it('calls onChange with correct value when checkbox is clicked', () => {
    renderComponent({
      onChange: onChangeMock,
      hasAuthority: true,
      hasRecords: true,
      hasValidAddress: true
    })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(onChangeMock).toHaveBeenCalledWith(true)
    fireEvent.click(checkbox)
    expect(onChangeMock).toHaveBeenCalledWith(false)
  })

  it('disables checkbox if any prop is false', () => {
    renderComponent({
      onChange: onChangeMock,
      hasAuthority: true,
      hasRecords: false,
      hasValidAddress: true
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
