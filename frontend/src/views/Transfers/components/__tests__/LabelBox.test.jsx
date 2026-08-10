import { createElement } from 'react'
import { screen } from '@testing-library/react'
import { LabelBox } from '../LabelBox'
import { test } from '@/tests/utils/fixtures'
import { describe, expect } from 'vitest'

describe('LabelBox Component', () => {
  test('renders with children only (minimal props)', ({ render, app }) => {
    render(
      <LabelBox>
        <div data-test="child-content">Child Content</div>
      </LabelBox>,
      app
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  test('renders label when label prop is provided', ({ render, app }) => {
    render(
      <LabelBox label="Test Label">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  test('does not render label when label prop is not provided', ({
    render,
    app
  }) => {
    render(
      <LabelBox>
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()
  })

  test('uses default labelVariant "h6" when labelVariant not provided', ({
    render,
    app
  }) => {
    render(
      <LabelBox label="Test Label">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    const labelElement = screen.getByText('Test Label')
    expect(labelElement.closest('.MuiTypography-h6')).toBeInTheDocument()
  })

  test('uses custom labelVariant when provided', ({ render, app }) => {
    render(
      <LabelBox label="Test Label" labelVariant="h4">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    const labelElement = screen.getByText('Test Label')
    expect(labelElement.closest('.MuiTypography-h4')).toBeInTheDocument()
  })

  test('renders description when description prop is provided', ({
    render,
    app
  }) => {
    render(
      <LabelBox description="Test Description">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  test('does not render description when description prop is not provided', ({
    render,
    app
  }) => {
    render(
      <LabelBox>
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument()
  })

  test('uses default descriptionVariant "body2" when descriptionVariant not provided', ({
    render,
    app
  }) => {
    render(
      <LabelBox description="Test Description">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    const descElement = screen.getByText('Test Description')
    expect(descElement.closest('.MuiTypography-body2')).toBeInTheDocument()
  })

  test('uses custom descriptionVariant when provided', ({ render, app }) => {
    render(
      <LabelBox description="Test Description" descriptionVariant="body1">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    const descElement = screen.getByText('Test Description')
    expect(descElement.closest('.MuiTypography-body1')).toBeInTheDocument()
  })

  test('spreads boxProps correctly to main BCBox', ({ render, app }) => {
    render(
      <LabelBox data-test="custom-box" className="custom-class">
        <div>Child Content</div>
      </LabelBox>,
      app
    )
    const boxElement = screen.getByTestId('custom-box')
    expect(boxElement).toBeInTheDocument()
    expect(boxElement).toHaveClass('custom-class')
  })

  test('renders complete component with all props', ({ render, app }) => {
    render(
      <LabelBox
        label="Complete Label"
        description="Complete Description"
        labelVariant="h5"
        descriptionVariant="subtitle1"
        data-test="complete-box"
        className="complete-class"
      >
        <div data-test="complete-child">Complete Child Content</div>
      </LabelBox>,
      app
    )

    expect(screen.getByText('Complete Label')).toBeInTheDocument()
    expect(screen.getByText('Complete Description')).toBeInTheDocument()
    expect(screen.getByTestId('complete-child')).toBeInTheDocument()

    const labelElement = screen.getByText('Complete Label')
    const descElement = screen.getByText('Complete Description')
    const boxElement = screen.getByTestId('complete-box')

    expect(labelElement.closest('.MuiTypography-h5')).toBeInTheDocument()
    expect(descElement.closest('.MuiTypography-subtitle1')).toBeInTheDocument()
    expect(boxElement).toHaveClass('complete-class')
  })

  test('always renders children regardless of other props', ({
    render,
    app
  }) => {
    const childText = 'Always Visible Child'
    render(
      <LabelBox>
        <span>{childText}</span>
      </LabelBox>,
      app
    )
    expect(screen.getByText(childText)).toBeInTheDocument()
  })
})
