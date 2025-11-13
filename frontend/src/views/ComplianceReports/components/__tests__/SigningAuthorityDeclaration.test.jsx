import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, expect, vi } from 'vitest'
import { useState } from 'react'
import SigningAuthorityDeclaration from '../SigningAuthorityDeclaration'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const ControlledSigningAuthority = ({
  onChange,
  initialChecked = false,
  ...props
}) => {
  const [checked, setChecked] = useState(initialChecked)

  return (
    <SigningAuthorityDeclaration
      {...props}
      checked={checked}
      onChange={(value) => {
        setChecked(value)
        onChange?.(value)
      }}
    />
  )
}

describe('SigningAuthorityDeclaration Component', () => {
  let onChangeMock

  beforeEach(() => {
    onChangeMock = vi.fn()
  })

  const baseProps = {
    hasAuthority: true,
    hasRecords: true,
    hasValidAddress: true
  }

  const renderComponent = (props) => {
    return render(
      <SigningAuthorityDeclaration
        {...baseProps}
        checked={false}
        onChange={onChangeMock}
        {...props}
      />,
      { wrapper }
    )
  }

  it('renders component structure with title', () => {
    renderComponent()

    expect(screen.getByText('report:signingAuthorityDeclaration')).toBeInTheDocument()
    expect(screen.getByText('report:declarationText')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('renders the component with all alerts when no props are true', () => {
    renderComponent({
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
    renderComponent()

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeEnabled()
  })

  it('renders only noRecords alert when hasRecords is false', () => {
    renderComponent({
      hasRecords: false,
      checked: false
    })

    expect(screen.getByText('report:noRecords')).toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
  })

  it('renders only noSigningAuthorityTooltip alert when hasAuthority is false', () => {
    renderComponent({
      hasAuthority: false,
      checked: false
    })

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.getByText('report:noSigningAuthorityTooltip')
    ).toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
  })

  it('renders only invalidAddress alert when hasValidAddress is false', () => {
    renderComponent({
      hasValidAddress: false
    })

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.getByText('report:invalidAddress')).toBeInTheDocument()
  })

  it('disables checkbox when hasRecords is false', () => {
    renderComponent({
      hasRecords: false,
      checked: false
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('disables checkbox when hasAuthority is false', () => {
    renderComponent({
      hasAuthority: false,
      checked: false
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('disables checkbox when hasValidAddress is false', () => {
    renderComponent({
      hasValidAddress: false
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('calls onChange with correct value when checkbox is clicked', () => {
    render(
      <ControlledSigningAuthority
        {...baseProps}
        onChange={onChangeMock}
      />,
      { wrapper }
    )

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(onChangeMock).toHaveBeenLastCalledWith(true)
    fireEvent.click(checkbox)
    expect(onChangeMock).toHaveBeenLastCalledWith(false)
  })

  it('checkbox starts unchecked by default', () => {
    renderComponent()

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('checkbox maintains state between clicks when controlled externally', () => {
    render(
      <ControlledSigningAuthority
        {...baseProps}
        onChange={onChangeMock}
      />,
      { wrapper }
    )

    const checkbox = screen.getByRole('checkbox')

    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })


  it('alert boxes have correct test attributes', () => {
    renderComponent({
      onChange: onChangeMock,
      hasAuthority: false,
      hasRecords: false,
      hasValidAddress: false
    })

    const alertBoxes = screen.getAllByTestId('alert-box')
    expect(alertBoxes).toHaveLength(3)
  })
})
