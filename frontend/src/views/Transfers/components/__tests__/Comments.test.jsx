import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Comments } from '../Comments'
import { useForm, FormProvider } from 'react-hook-form'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { vi } from 'vitest'

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('Comments', () => {
  test('renders correctly when commentField is provided', () => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByTestId('comments')).toBeInTheDocument()
  })

  test('displays the correct label based on props', () => {
    render(
      <MockFormProvider>
        <Comments
          editorMode={true}
          isGovernmentUser={false}
          commentField="comments"
        />
      </MockFormProvider>,
      { wrapper }
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
      { wrapper }
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
      { wrapper }
    )
    expect(screen.getByText('transfer:toOrgCommentLabel')).toBeInTheDocument()
  })

  test('toggles collapse state when clicked', async () => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      { wrapper }
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

  test('registers the TextField correctly', () => {
    const { getByRole } = render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      { wrapper }
    )
    const textField = getByRole('textbox')
    expect(textField).toHaveAttribute('id', 'external-comments')
  })
})
