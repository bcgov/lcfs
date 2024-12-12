import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Comments } from '../Comments'
import { FormProvider, useForm } from 'react-hook-form'
import { wrapper } from '@/tests/utils/wrapper'
import { describe, expect, it, vi } from 'vitest'

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('Comments Component', () => {
  it('renders correctly when commentField is provided', () => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByTestId('comments')).toBeInTheDocument()
  })

  it('does not render when commentField is not provided', () => {
    render(
      <MockFormProvider>
        <Comments commentField="" />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.queryByTestId('comments')).not.toBeInTheDocument()
  })

  it('displays the correct label based on props', () => {
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

  it('toggles collapse state when clicked', async () => {
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

  it('registers the TextField correctly', () => {
    const { getByRole } = render(
      <MockFormProvider>
        <Comments commentField="comments" />
      </MockFormProvider>,
      { wrapper }
    )
    const textField = getByRole('textbox')
    expect(textField).toHaveAttribute('id', 'external-comments')
  })

  it('is initially expanded by default when isDefaultExpanded is false', () => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" isDefaultExpanded={false} />
      </MockFormProvider>,
      { wrapper }
    )
    // With isDefaultExpanded=false, the component should start expanded
    expect(screen.getByTestId('external-comments')).toBeVisible()
  })

  it('is initially collapsed when isDefaultExpanded is true', async () => {
    render(
      <MockFormProvider>
        <Comments commentField="comments" isDefaultExpanded={true} />
      </MockFormProvider>,
      { wrapper }
    )
    // With isDefaultExpanded=true, we useState(!true)=false, so it should start collapsed
    await waitFor(() =>
      expect(
        screen.getByTestId('external-comments').parentElement
      ).not.toBeVisible()
    )
  })
})
