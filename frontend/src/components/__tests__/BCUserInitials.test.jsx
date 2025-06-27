import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'

describe('BCUserInitials Component', () => {
  const defaultProps = {
    fullName: 'John Doe',
    tooltipText: 'This is a test comment',
    maxLength: 500
  }

  it('should render the component with user initials', () => {
    render(<BCUserInitials {...defaultProps} />)

    const chipLabel = screen.getByText('JD')
    expect(chipLabel).toBeInTheDocument()
  })

  it('should generate correct initials for various name formats', () => {
    const testCases = [
      { name: 'John Doe', expected: 'JD' },
      { name: 'John', expected: 'J' },
      { name: 'John Michael Doe', expected: 'JM' }, // First two words only
      { name: 'jean-pierre martin', expected: 'JM' } // Note: jean-pierre is one word
    ]

    testCases.forEach(({ name, expected }) => {
      const { unmount } = render(
        <BCUserInitials fullName={name} tooltipText="test" />
      )

      const chipLabel = screen.getByText(expected)
      expect(chipLabel).toBeInTheDocument()

      unmount()
    })
  })

  it('should display tooltip with clean text', () => {
    render(<BCUserInitials {...defaultProps} />)

    const tooltip = screen.getByLabelText('This is a test comment')
    expect(tooltip).toBeInTheDocument()
  })

  it('should strip HTML tags from tooltip text', () => {
    const htmlTooltip =
      '<p>This is <strong>bold</strong> text with <em>emphasis</em></p>'
    const expectedCleanText = 'This is bold text with emphasis'

    render(<BCUserInitials fullName="John Doe" tooltipText={htmlTooltip} />)

    const tooltip = screen.getByLabelText(expectedCleanText)
    expect(tooltip).toBeInTheDocument()
  })

  it('should truncate tooltip text when exceeding maxLength', () => {
    const longText =
      'This is a very long comment that should be truncated when it exceeds the maximum length specified in the component props'
    const maxLength = 50

    render(
      <BCUserInitials
        fullName="John Doe"
        tooltipText={longText}
        maxLength={maxLength}
      />
    )

    // Should find the truncated version (check what was actually rendered)
    const tooltip = screen.getByLabelText(
      /This is a very long comment that should be truncat\.\.\./
    )
    expect(tooltip).toBeInTheDocument()
  })

  it('should handle empty tooltip text gracefully', () => {
    render(<BCUserInitials fullName="John Doe" tooltipText="" />)

    const chipLabel = screen.getByText('JD')
    expect(chipLabel).toBeInTheDocument()
  })

  it('should handle special characters in names', () => {
    const specialNames = [
      { name: 'José María', expected: 'JM' },
      { name: 'François Müller', expected: 'FM' }
    ]

    specialNames.forEach(({ name, expected }) => {
      const { unmount } = render(
        <BCUserInitials fullName={name} tooltipText="test" />
      )

      const chipLabel = screen.getByText(expected)
      expect(chipLabel).toBeInTheDocument()

      unmount()
    })
  })

  it('should handle very long names gracefully', () => {
    const longName =
      'John Michael Christopher Alexander Benjamin Theodore Roosevelt'

    render(<BCUserInitials fullName={longName} tooltipText="test" />)

    // Should get first two initials (limited to 2 characters)
    const chipLabel = screen.getByText('JM')
    expect(chipLabel).toBeInTheDocument()
  })

  it('should use default maxLength when not provided', () => {
    const longText = 'A'.repeat(600) // Longer than default 500

    render(<BCUserInitials fullName="John Doe" tooltipText={longText} />)

    const chipLabel = screen.getByText('JD')
    expect(chipLabel).toBeInTheDocument()

    // The tooltip should be truncated (we can't easily test the exact truncation without accessing internals)
    const tooltip = screen.getByLabelText(/A{500,}\.\.\./)
    expect(tooltip).toBeInTheDocument()
  })

  it('should handle mixed HTML and text content', () => {
    const mixedContent =
      'Plain text <b>bold</b> more plain text <i>italic</i> end'
    const expectedClean = 'Plain text bold more plain text italic end'

    render(<BCUserInitials fullName="Test User" tooltipText={mixedContent} />)

    const tooltip = screen.getByLabelText(expectedClean)
    expect(tooltip).toBeInTheDocument()
  })
})
