import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Comments } from '../Comments'
import { FormProvider, useForm } from 'react-hook-form'
import { test } from '@/tests/utils/fixtures'
import { describe, expect, vi } from 'vitest'

const MockFormProvider = ({ children, errors = {} }) => {
  const methods = useForm()
  // Mock the formState to include our errors
  const mockFormState = {
    ...methods.formState,
    errors
  }
  const mockMethods = {
    ...methods,
    formState: mockFormState
  }
  return <FormProvider {...mockMethods}>{children}</FormProvider>
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('Comments Component', () => {
  test('renders correctly when commentField is provided', ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      [theme]
    )
    expect(screen.getByTestId('comments')).toBeInTheDocument()
  })

  test('does not render when commentField is not provided', ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="" />
      </MockFormProvider>,
      [theme]
    )
    expect(screen.queryByTestId('comments')).not.toBeInTheDocument()
  })

  test('displays the correct label based on props', ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments
          editorMode={true}
          isGovernmentUser={false}
          commentField="comments"
        />
      </MockFormProvider>,
      [theme]
    )
    expect(screen.getByText('transfer:commentsLabel')).toBeInTheDocument()

    render(
      <MockFormProvider>
        <Comments
          editorMode={false}
          isGovernmentUser={true}
          commentField="comments"
        />
      </MockFormProvider>,
      [theme]
    )
    expect(screen.getByText('transfer:govCommentLabel')).toBeInTheDocument()

    render(
      <MockFormProvider>
        <Comments
          editorMode={false}
          isGovernmentUser={false}
          commentField="comments"
        />
      </MockFormProvider>,
      [theme]
    )
    expect(screen.getByText('transfer:toOrgCommentLabel')).toBeInTheDocument()
  })

  test('toggles collapse state when clicked', async ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      [theme]
    )
    const toggleButton = screen.getByTestId('collapse-button')

    // Initially, the TextField should be visible
    expect(screen.getByTestId('external-comments')).toBeVisible()

    // Click to collapse
    fireEvent.click(toggleButton)
    await waitFor(() =>
      expect(
        screen.getByTestId('external-comments').parentElement
      ).not.toBeVisible()
    )

    // Click again to expand
    fireEvent.click(toggleButton)
    expect(screen.getByTestId('external-comments')).toBeVisible()
  })

  test('registers the TextField correctly', ({
    render,
    theme
  }) => {
    const { getByRole } = render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      [theme]
    )
    const textField = getByRole('textbox')
    expect(textField).toHaveAttribute('id', 'external-comments')
  })

  test('is initially expanded by default when isDefaultExpanded is false', ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" isDefaultExpanded={false} />
      </MockFormProvider>,
      [theme]
    )
    // With isDefaultExpanded=false, the component should start expanded
    expect(screen.getByTestId('external-comments')).toBeVisible()
  })

  test('is initially collapsed when isDefaultExpanded is true', async ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" isDefaultExpanded={true} />
      </MockFormProvider>,
      [theme]
    )
    // With isDefaultExpanded=true, we useState(!true)=false, so it should start collapsed
    await waitFor(() =>
      expect(
        screen.getByTestId('external-comments').parentElement
      ).not.toBeVisible()
    )
  })

  test('displays error state when field has validation errors', ({
    render,
    theme
  }) => {
    const fieldErrors = {
      comments: { message: 'This field is required' }
    }

    render(
      <MockFormProvider errors={fieldErrors}>
        <Comments commentField="comments" />
      </MockFormProvider>,
      [theme]
    )

    const textField = screen.getByRole('textbox')
    expect(textField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  test('shows correct icons based on expanded state', ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" isDefaultExpanded={false} />
      </MockFormProvider>,
      [theme]
    )

    const toggleButton = screen.getByTestId('collapse-button')

    // Initially expanded (isDefaultExpanded=false means useState(!false)=true)
    // Look for ExpandLess icon by its SVG path content
    expect(
      toggleButton.querySelector('svg[data-testid="ExpandLessIcon"]')
    ).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(toggleButton)

    // Now should show ExpandMore icon
    expect(
      toggleButton.querySelector('svg[data-testid="ExpandMoreIcon"]')
    ).toBeInTheDocument()
  })

  test('handles Box click to toggle collapse state', async ({
    render,
    theme
  }) => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      [theme]
    )

    // Find the Box with click handler (has cursor pointer style)
    const clickableBox = screen.getByRole('button', {
      name: /expand comments/i
    }).parentElement

    // Initially expanded, TextField should be visible
    expect(screen.getByTestId('external-comments')).toBeVisible()

    // Click the Box to collapse
    fireEvent.click(clickableBox)
    await waitFor(() =>
      expect(
        screen.getByTestId('external-comments').parentElement
      ).not.toBeVisible()
    )
  })
})
