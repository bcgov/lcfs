/**
 * @vitest-environment jsdom
 */
import { describe, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { CustomLabel } from '../CustomLabel'
import { test as fixtureTest } from '@/tests/utils/fixtures'

const test = (name, callback) =>
  fixtureTest(name, ({ render: fixtureRender }) =>
    callback({
      render: (ui, providers = [], options = {}) =>
        fixtureRender(ui, providers.filter(Boolean), options),
      theme: undefined
    })
  )

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

describe.sequential('CustomLabel', () => {
  const defaultProps = {
    header: 'Test Header',
    text: 'Test description text'
  }

  const renderCustomLabel = (
    { render, query, theme, localization, router, i18n },
    props = {}
  ) => {
    return render(<CustomLabel {...defaultProps} {...props} />, [theme])
  }

  describe('Rendering', () => {
    test('renders header and text correctly', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      expect(screen.getByText('Test Header')).toBeInTheDocument()
      expect(
        screen.getByText((content, element) =>
          content.includes('Test description text')
        )
      ).toBeInTheDocument()
    })

    test('renders with BCTypography component with correct props', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-variant', 'body4')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    test('renders header in strong tag', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const strongElement = screen.getByText('Test Header')
      expect(strongElement.tagName).toBe('STRONG')
    })

    test('includes separator between header and text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography.textContent).toContain(
        'Test Header —\u00A0Test description text'
      )
    })
  })

  describe('Props', () => {
    test('renders different header text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { header: 'Different Header' }
      )

      expect(screen.getByText('Different Header')).toBeInTheDocument()
      expect(screen.queryByText('Test Header')).not.toBeInTheDocument()
    })

    test('renders different description text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { text: 'Different description' }
      )

      expect(
        screen.getByText((content) => content.includes('Different description'))
      ).toBeInTheDocument()
      expect(
        screen.queryByText((content) =>
          content.includes('Test description text')
        )
      ).not.toBeInTheDocument()
    })

    test('handles empty strings', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { header: '', text: '' }
      )

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography.textContent).toBe(' —\u00A0')
    })

    test('handles special characters in header', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { header: 'Header with <>&"\'', text: 'Normal text' }
      )

      expect(screen.getByText('Header with <>&"\'')).toBeInTheDocument()
    })

    test('handles special characters in text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { header: 'Normal Header', text: 'Text with <>&"\'' }
      )

      expect(
        screen.getByText((content) => content.includes('Text with <>&"\''))
      ).toBeInTheDocument()
    })
  })

  describe('Structure', () => {
    test('has correct HTML structure', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const typography = document.querySelector('[data-test="bc-typography"]')
      const strong = screen.getByText('Test Header')

      expect(typography).toContainElement(strong)
    })
  })

  describe('Accessibility', () => {
    test('renders as semantic span element', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-component', 'span')
    })

    test('maintains proper text hierarchy with strong element', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const strongElement = screen.getByText('Test Header')
      expect(strongElement.tagName).toBe('STRONG')
    })

    test('preserves text content for screen readers', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        {
          render,
          query,
          theme,
          localization,
          router,
          i18n
        },
        {
          header: 'Important Information',
          text: 'This is crucial for accessibility'
        }
      )

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography.textContent).toContain(
        'Important Information —\u00A0This is crucial for accessibility'
      )
    })
  })

  describe('Styling Integration', () => {
    test('uses body4 typography variant', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-variant', 'body4')
    })

    test('renders as span component for inline usage', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel({ render, query, theme, localization, router, i18n })

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-component', 'span')
    })
  })

  describe('Edge Cases', () => {
    test('handles very long header text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const longHeader =
        'This is a very long header that might wrap to multiple lines'
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { header: longHeader }
      )

      expect(screen.getByText(longHeader)).toBeInTheDocument()
    })

    test('handles very long description text', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      const longText =
        'This is a very long description that contains multiple sentences and might wrap to several lines to test how the component handles lengthy content.'
      renderCustomLabel(
        { render, query, theme, localization, router, i18n },
        { text: longText }
      )

      expect(
        screen.getByText((content) => content.includes(longText))
      ).toBeInTheDocument()
    })

    test('handles text with line breaks', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        {
          render,
          query,
          theme,
          localization,
          router,
          i18n
        },
        {
          header: 'Header\nwith\nbreaks',
          text: 'Text\nwith\nbreaks'
        }
      )

      const typography = document.querySelector('[data-test="bc-typography"]')
      expect(typography.textContent).toContain('Header\nwith\nbreaks')
      expect(typography.textContent).toContain('Text\nwith\nbreaks')
    })

    test('handles numeric content', ({
      render,
      query,
      theme,
      localization,
      router,
      i18n
    }) => {
      renderCustomLabel(
        {
          render,
          query,
          theme,
          localization,
          router,
          i18n
        },
        {
          header: '123',
          text: '456.78'
        }
      )

      expect(screen.getByText('123')).toBeInTheDocument()
      expect(
        screen.getByText((content) => content.includes('456.78'))
      ).toBeInTheDocument()
    })
  })
})
