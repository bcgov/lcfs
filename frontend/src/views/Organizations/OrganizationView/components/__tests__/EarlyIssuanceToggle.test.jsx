import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { EarlyIssuanceToggle } from '../EarlyIssuanceToggle'

const mockMutateAsync = vi.fn()

vi.mock('@/hooks/useOrganization', () => ({
  useUpdateOrganizationEarlyIssuance: () => ({ mutateAsync: mockMutateAsync })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts?.year ? `${key} ${opts.year}` : key)
  })
}))

// data-test lands on MUI's root span; the assertions need the underlying input
const radio = (id) => screen.getByTestId(id).querySelector('input')

const renderToggle = (props) =>
  render(
    <ThemeProvider theme={theme}>
      <EarlyIssuanceToggle orgID={1} hasEarlyIssuance={false} {...props} />
    </ThemeProvider>
  )

describe('EarlyIssuanceToggle', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockMutateAsync.mockResolvedValue({})
  })

  it('shows the current value as plain text, with no control, when the user cannot edit', () => {
    renderToggle({ canEdit: false, hasEarlyIssuance: true })

    expect(screen.getByTestId('early-issuance-value')).toHaveTextContent(
      'common:yes'
    )
    expect(screen.queryByTestId('hasEarlyIssuanceYes')).toBeNull()
    expect(screen.queryByTestId('hasEarlyIssuanceNo')).toBeNull()
  })

  it('shows "No" as plain text when disabled and the user cannot edit', () => {
    renderToggle({ canEdit: false, hasEarlyIssuance: false })

    expect(screen.getByTestId('early-issuance-value')).toHaveTextContent(
      'common:no'
    )
  })

  it('enables the control for users who can edit', () => {
    renderToggle({ canEdit: true })

    expect(radio('hasEarlyIssuanceYes')).toBeEnabled()
    expect(radio('hasEarlyIssuanceNo')).toBeEnabled()
    expect(radio('hasEarlyIssuanceNo')).toBeChecked()
  })

  it('asks for confirmation before saving and saves on confirm', async () => {
    renderToggle({ canEdit: true })

    fireEvent.click(screen.getByTestId('hasEarlyIssuanceYes'))

    expect(
      await screen.findByTestId('early-issuance-confirm')
    ).toHaveTextContent('org:earlyIssuanceConfirmEnable')
    expect(mockMutateAsync).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('common:saveBtn'))

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(true))
  })

  it('does not save when the confirmation is cancelled', async () => {
    renderToggle({ canEdit: true })

    fireEvent.click(screen.getByTestId('hasEarlyIssuanceYes'))
    fireEvent.click(await screen.findByText('common:cancelBtn'))

    await waitFor(() =>
      expect(screen.queryByTestId('early-issuance-confirm')).toBeNull()
    )
    expect(mockMutateAsync).not.toHaveBeenCalled()
    expect(radio('hasEarlyIssuanceNo')).toBeChecked()
  })

  it('confirms before disabling early issuance', async () => {
    renderToggle({ canEdit: true, hasEarlyIssuance: true })

    fireEvent.click(screen.getByTestId('hasEarlyIssuanceNo'))

    expect(
      await screen.findByTestId('early-issuance-confirm')
    ).toHaveTextContent('org:earlyIssuanceConfirmDisable')
    fireEvent.click(screen.getByText('common:saveBtn'))

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(false))
  })
})
