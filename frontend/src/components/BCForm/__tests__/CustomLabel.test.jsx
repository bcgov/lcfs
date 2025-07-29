/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustomLabel } from '../CustomLabel'
import { AppWrapper, getByDataTest } from '@/tests/utils'

// Mock BCTypography component
vi.mock('@/components/BCTypography', () => ({
  default: ({ variant, component, children, ...props }) => (
    <span 
      data-test="bc-typography" 
      data-variant={variant}
      data-component={component}
      {...props}
    >
      {children}
    </span>
  )
}))

describe('CustomLabel', () => {
  const defaultProps = {
    header: 'Test Header',
    text: 'Test description text'
  }

  const renderCustomLabel = (props = {}) => {
    return render(
      <CustomLabel {...defaultProps} {...props} />,
      { wrapper: AppWrapper }
    )
  }

  describe('Rendering', () => {
    it('renders header and text correctly', () => {
      renderCustomLabel()
      
      expect(screen.getByText('Test Header')).toBeInTheDocument()
      expect(screen.getByText((content, element) => 
        content.includes('Test description text')
      )).toBeInTheDocument()
    })

    it('renders with BCTypography component with correct props', () => {
      renderCustomLabel()
      
      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'body4')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    it('renders header in strong tag', () => {
      renderCustomLabel()
      
      const strongElement = screen.getByText('Test Header')
      expect(strongElement.tagName).toBe('STRONG')
    })

    it('includes separator between header and text', () => {
      renderCustomLabel()
      
      const typography = getByDataTest('bc-typography')
      expect(typography.textContent).toContain('Test Header —\u00A0Test description text')
    })
  })

  describe('Props', () => {
    it('renders different header text', () => {
      renderCustomLabel({ header: 'Different Header' })
      
      expect(screen.getByText('Different Header')).toBeInTheDocument()
      expect(screen.queryByText('Test Header')).not.toBeInTheDocument()
    })

    it('renders different description text', () => {
      renderCustomLabel({ text: 'Different description' })
      
      expect(screen.getByText((content) => 
        content.includes('Different description')
      )).toBeInTheDocument()
      expect(screen.queryByText((content) => 
        content.includes('Test description text')
      )).not.toBeInTheDocument()
    })

    it('handles empty strings', () => {
      renderCustomLabel({ header: '', text: '' })
      
      const typography = getByDataTest('bc-typography')
      expect(typography.textContent).toBe(' —\u00A0')
    })

    it('handles special characters in header', () => {
      renderCustomLabel({ header: 'Header with <>&"\'', text: 'Normal text' })
      
      expect(screen.getByText('Header with <>&"\'')).toBeInTheDocument()
    })

    it('handles special characters in text', () => {
      renderCustomLabel({ header: 'Normal Header', text: 'Text with <>&"\'' })
      
      expect(screen.getByText((content) => 
        content.includes('Text with <>&"\'')
      )).toBeInTheDocument()
    })
  })

  describe('Structure', () => {
    it('has correct HTML structure', () => {
      renderCustomLabel()
      
      const typography = getByDataTest('bc-typography')
      const strong = screen.getByText('Test Header')
      
      expect(typography).toContainElement(strong)
    })
  })

  describe('Accessibility', () => {
    it('renders as semantic span element', () => {
      renderCustomLabel()
      
      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    it('maintains proper text hierarchy with strong element', () => {
      renderCustomLabel()
      
      const strongElement = screen.getByText('Test Header')
      expect(strongElement.tagName).toBe('STRONG')
    })

    it('preserves text content for screen readers', () => {
      renderCustomLabel({ 
        header: 'Important Information', 
        text: 'This is crucial for accessibility' 
      })
      
      const typography = getByDataTest('bc-typography')
      expect(typography.textContent).toContain('Important Information —\u00A0This is crucial for accessibility')
    })
  })

  describe('Styling Integration', () => {
    it('uses body4 typography variant', () => {
      renderCustomLabel()
      
      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'body4')
    })

    it('renders as span component for inline usage', () => {
      renderCustomLabel()
      
      const typography = getByDataTest('bc-typography')
      expect(typography).toHaveAttribute('data-component', 'span')
    })
  })

  describe('Edge Cases', () => {
    it('handles very long header text', () => {
      const longHeader = 'This is a very long header that might wrap to multiple lines'
      renderCustomLabel({ header: longHeader })
      
      expect(screen.getByText(longHeader)).toBeInTheDocument()
    })

    it('handles very long description text', () => {
      const longText = 'This is a very long description that contains multiple sentences and might wrap to several lines to test how the component handles lengthy content.'
      renderCustomLabel({ text: longText })
      
      expect(screen.getByText((content) => 
        content.includes(longText)
      )).toBeInTheDocument()
    })

    it('handles text with line breaks', () => {
      renderCustomLabel({ 
        header: 'Header\nwith\nbreaks', 
        text: 'Text\nwith\nbreaks' 
      })
      
      const typography = getByDataTest('bc-typography')
      expect(typography.textContent).toContain('Header\nwith\nbreaks')
      expect(typography.textContent).toContain('Text\nwith\nbreaks')
    })

    it('handles numeric content', () => {
      renderCustomLabel({ 
        header: '123', 
        text: '456.78' 
      })
      
      expect(screen.getByText('123')).toBeInTheDocument()
      expect(screen.getByText((content) => 
        content.includes('456.78')
      )).toBeInTheDocument()
    })
  })
})