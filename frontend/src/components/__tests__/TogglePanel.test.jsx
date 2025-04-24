import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TogglePanel } from '../TogglePanel'

describe('TogglePanel', () => {
  const label = 'Compare Mode'
  const OffComponent = () => <div data-test="off-comp">OFF</div>
  const OnComponent = () => <div data-test="on-comp">ON</div>

  it('renders with defaultState=false and shows offComponent', () => {
    render(
      <TogglePanel
        label={label}
        offComponent={<OffComponent />}
        onComponent={<OnComponent />}
      />
    )
    expect(screen.getByTestId('off-comp')).toBeInTheDocument()
    expect(screen.queryByTestId('on-comp')).not.toBeInTheDocument()
    expect(screen.getByText(`${label} off`)).toBeInTheDocument()
  })

  it('renders with defaultState=true and shows onComponent', () => {
    render(
      <TogglePanel
        label={label}
        offComponent={<OffComponent />}
        onComponent={<OnComponent />}
        defaultState={true}
      />
    )
    expect(screen.getByTestId('on-comp')).toBeInTheDocument()
    expect(screen.queryByTestId('off-comp')).not.toBeInTheDocument()
    expect(screen.getByText(`${label} on`)).toBeInTheDocument()
  })

  it('toggles between onComponent and offComponent when switch is clicked', () => {
    render(
      <TogglePanel
        label={label}
        offComponent={<OffComponent />}
        onComponent={<OnComponent />}
      />
    )
    const switchInput = screen.getByRole('checkbox')
    // Initially off
    expect(screen.getByTestId('off-comp')).toBeInTheDocument()
    // Toggle on
    fireEvent.click(switchInput)
    expect(screen.getByTestId('on-comp')).toBeInTheDocument()
    expect(screen.queryByTestId('off-comp')).not.toBeInTheDocument()
    // Toggle off again
    fireEvent.click(switchInput)
    expect(screen.getByTestId('off-comp')).toBeInTheDocument()
    expect(screen.queryByTestId('on-comp')).not.toBeInTheDocument()
  })

  it('renders only offComponent when disabled', () => {
    render(
      <TogglePanel
        label={label}
        offComponent={<OffComponent />}
        onComponent={<OnComponent />}
        disabled={true}
      />
    )
    expect(screen.getByTestId('off-comp')).toBeInTheDocument()
    expect(screen.queryByTestId('on-comp')).not.toBeInTheDocument()
    // Should not render the switch
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('updates when defaultState prop changes', () => {
    const { rerender } = render(
      <TogglePanel
        label={label}
        offComponent={<OffComponent />}
        onComponent={<OnComponent />}
        defaultState={false}
      />
    )
    expect(screen.getByTestId('off-comp')).toBeInTheDocument()
    rerender(
      <TogglePanel
        label={label}
        offComponent={<OffComponent />}
        onComponent={<OnComponent />}
        defaultState={true}
      />
    )
    expect(screen.getByTestId('on-comp')).toBeInTheDocument()
  })
})
