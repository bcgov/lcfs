import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReportOpenings } from '../ReportOpenings/ReportOpenings'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

describe('ReportOpenings', () => {
  it('renders years from the API and enables save on change', async () => {
    render(<ReportOpenings />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('2019')).toBeInTheDocument()
      expect(screen.getByText('2020')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    const saveButton = screen.getByRole('button', { name: /Save/i })

    expect(saveButton).toBeDisabled()

    await userEvent.click(checkboxes[1])

    expect(saveButton).not.toBeDisabled()
  })
})
