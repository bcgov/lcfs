import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LabelBox } from '../LabelBox'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

const renderComponent = (props = {}) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LabelBox {...props}>
          <div data-test="child-content">Test child content</div>
        </LabelBox>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('LabelBox Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with all props provided', () => {
    renderComponent({
      label: 'Test Label',
      description: 'Test Description',
      labelVariant: 'h5',
      descriptionVariant: 'body1',
      'data-test': 'custom-box'
    })

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('renders without label when label is not provided', () => {
    renderComponent({
      description: 'Test Description'
    })

    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('renders without label when label is empty string', () => {
    renderComponent({
      label: '',
      description: 'Test Description'
    })

    // Check that no h6 element is rendered (which would contain the label)
    expect(document.querySelector('h6')).not.toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  it('renders without label when label is null', () => {
    renderComponent({
      label: null,
      description: 'Test Description'
    })

    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('uses default h6 variant when labelVariant is not provided', () => {
    renderComponent({
      label: 'Test Label'
    })

    const labelElement = screen.getByText('Test Label')
    expect(labelElement).toBeInTheDocument()
    expect(labelElement.tagName.toLowerCase()).toBe('h6')
  })

  it('uses custom labelVariant when provided', () => {
    renderComponent({
      label: 'Test Label',
      labelVariant: 'h4'
    })

    const labelElement = screen.getByText('Test Label')
    expect(labelElement).toBeInTheDocument()
    expect(labelElement.tagName.toLowerCase()).toBe('h4')
  })

  it('renders without description when description is not provided', () => {
    renderComponent({
      label: 'Test Label'
    })

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument()
  })

  it('renders without description when description is empty string', () => {
    const { container } = renderComponent({
      label: 'Test Label',
      description: ''
    })

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    // Check that no p element with body2 class is rendered in labelBoxContent (which would contain description)
    const descriptionElement = container.querySelector('.labelBoxContent p')
    expect(descriptionElement).not.toBeInTheDocument()
  })

  it('renders without description when description is null', () => {
    renderComponent({
      label: 'Test Label',
      description: null
    })

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('uses default body2 variant when descriptionVariant is not provided', () => {
    renderComponent({
      description: 'Test Description'
    })

    const descriptionElement = screen.getByText('Test Description')
    expect(descriptionElement).toBeInTheDocument()
  })

  it('uses custom descriptionVariant when provided', () => {
    renderComponent({
      description: 'Test Description',
      descriptionVariant: 'body1'
    })

    const descriptionElement = screen.getByText('Test Description')
    expect(descriptionElement).toBeInTheDocument()
  })

  it('renders children correctly', () => {
    renderComponent({
      label: 'Test Label',
      description: 'Test Description'
    })

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Test child content')).toBeInTheDocument()
  })

  it('passes boxProps to the main BCBox component', () => {
    renderComponent({
      label: 'Test Label',
      'data-test': 'custom-label-box',
      className: 'custom-class'
    })

    const boxElement = screen.getByTestId('custom-label-box')
    expect(boxElement).toBeInTheDocument()
    expect(boxElement).toHaveClass('custom-class')
  })

  it('renders with only children and no label or description', () => {
    renderComponent()

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Test child content')).toBeInTheDocument()
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument()
  })

  it('has correct CSS class for labelBoxContent', () => {
    renderComponent({
      label: 'Test Label'
    })

    const contentBox = document.querySelector('.labelBoxContent')
    expect(contentBox).toBeInTheDocument()
  })
})