import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { LabelBox } from '../LabelBox'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it } from 'vitest'

describe('LabelBox Component', () => {
  it('renders with children only (minimal props)', () => {
    render(
      <LabelBox>
        <div data-test="child-content">Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('renders label when label prop is provided', () => {
    render(
      <LabelBox label="Test Label">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('does not render label when label prop is not provided', () => {
    render(
      <LabelBox>
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()
  })

  it('uses default labelVariant "h6" when labelVariant not provided', () => {
    render(
      <LabelBox label="Test Label">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    const labelElement = screen.getByText('Test Label')
    expect(labelElement.closest('.MuiTypography-h6')).toBeInTheDocument()
  })

  it('uses custom labelVariant when provided', () => {
    render(
      <LabelBox label="Test Label" labelVariant="h4">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    const labelElement = screen.getByText('Test Label')
    expect(labelElement.closest('.MuiTypography-h4')).toBeInTheDocument()
  })

  it('renders description when description prop is provided', () => {
    render(
      <LabelBox description="Test Description">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  it('does not render description when description prop is not provided', () => {
    render(
      <LabelBox>
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument()
  })

  it('uses default descriptionVariant "body2" when descriptionVariant not provided', () => {
    render(
      <LabelBox description="Test Description">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    const descElement = screen.getByText('Test Description')
    expect(descElement.closest('.MuiTypography-body2')).toBeInTheDocument()
  })

  it('uses custom descriptionVariant when provided', () => {
    render(
      <LabelBox description="Test Description" descriptionVariant="body1">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    const descElement = screen.getByText('Test Description')
    expect(descElement.closest('.MuiTypography-body1')).toBeInTheDocument()
  })

  it('spreads boxProps correctly to main BCBox', () => {
    render(
      <LabelBox data-test="custom-box" className="custom-class">
        <div>Child Content</div>
      </LabelBox>,
      { wrapper }
    )
    const boxElement = screen.getByTestId('custom-box')
    expect(boxElement).toBeInTheDocument()
    expect(boxElement).toHaveClass('custom-class')
  })

  it('renders complete component with all props', () => {
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
      { wrapper }
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

  it('always renders children regardless of other props', () => {
    const childText = 'Always Visible Child'
    render(
      <LabelBox>
        <span>{childText}</span>
      </LabelBox>,
      { wrapper }
    )
    expect(screen.getByText(childText)).toBeInTheDocument()
  })
})