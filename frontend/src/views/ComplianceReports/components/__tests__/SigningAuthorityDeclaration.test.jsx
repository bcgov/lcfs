import { screen, fireEvent } from '@testing-library/react'
import { describe, beforeEach, expect, vi } from 'vitest'
import { useState } from 'react'
import SigningAuthorityDeclaration from '../SigningAuthorityDeclaration'
import { test } from '@/tests/utils/fixtures'

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

  const renderComponent = (render, providers, props) => {
    return render(
      <SigningAuthorityDeclaration
        {...baseProps}
        checked={false}
        onChange={onChangeMock}
        {...props}
      />,
      providers
    )
  }

  test('renders component structure with title', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router])

    expect(
      screen.getByText('report:signingAuthorityDeclaration')
    ).toBeInTheDocument()
    expect(screen.getByText('report:declarationText')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  test('renders the component with all alerts when no props are true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
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

  test('renders without alerts and enables checkbox when all props are true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router])

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeEnabled()
  })

  test('renders only noRecords alert when hasRecords is false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      hasRecords: false,
      checked: false
    })

    expect(screen.getByText('report:noRecords')).toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
  })

  test('renders only noSigningAuthorityTooltip alert when hasAuthority is false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      hasAuthority: false,
      checked: false
    })

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.getByText('report:noSigningAuthorityTooltip')
    ).toBeInTheDocument()
    expect(screen.queryByText('report:invalidAddress')).not.toBeInTheDocument()
  })

  test('renders only invalidAddress alert when hasValidAddress is false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      hasValidAddress: false
    })

    expect(screen.queryByText('report:noRecords')).not.toBeInTheDocument()
    expect(
      screen.queryByText('report:noSigningAuthorityTooltip')
    ).not.toBeInTheDocument()
    expect(screen.getByText('report:invalidAddress')).toBeInTheDocument()
  })

  test('disables checkbox when hasRecords is false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      hasRecords: false,
      checked: false
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  test('disables checkbox when hasAuthority is false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      hasAuthority: false,
      checked: false
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  test('disables checkbox when hasValidAddress is false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      hasValidAddress: false
    })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  test('calls onChange with correct value when checkbox is clicked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ControlledSigningAuthority {...baseProps} onChange={onChangeMock} />,
      [query, theme, localization, router]
    )

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(onChangeMock).toHaveBeenLastCalledWith(true)
    fireEvent.click(checkbox)
    expect(onChangeMock).toHaveBeenLastCalledWith(false)
  })

  test('checkbox starts unchecked by default', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router])

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  test('checkbox maintains state between clicks when controlled externally', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ControlledSigningAuthority {...baseProps} onChange={onChangeMock} />,
      [query, theme, localization, router]
    )

    const checkbox = screen.getByRole('checkbox')

    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  test('alert boxes have correct test attributes', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    renderComponent(render, [query, theme, localization, router], {
      onChange: onChangeMock,
      hasAuthority: false,
      hasRecords: false,
      hasValidAddress: false
    })

    const alertBoxes = screen.getAllByTestId('alert-box')
    expect(alertBoxes).toHaveLength(3)
  })
})
