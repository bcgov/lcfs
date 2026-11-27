import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { RepresentativeAgreement } from '../RepresentativeAgreement'

const mockMutateAsync = vi.fn()

vi.mock('@/hooks/useOrganization', () => ({
  useUpdateOrganizationRepresentativeAgreement: () => ({
    mutateAsync: mockMutateAsync
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// data-test lands on MUI's root span; assertions need the underlying input
const radio = (id) => screen.getByTestId(id).querySelector('input')
const nameInput = () => screen.getByTestId('representativeOrganizationName')

const renderComponent = (props) =>
  render(
    <ThemeProvider theme={theme}>
      <RepresentativeAgreement
        orgID={1}
        hasRepresentativeAgreement={false}
        representativeOrganizationName={null}
        {...props}
      />
    </ThemeProvider>
  )

describe('RepresentativeAgreement', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockMutateAsync.mockResolvedValue({})
  })

  it('shows "No" as plain text when there is no agreement', () => {
    renderComponent({ canEdit: false })

    expect(
      screen.getByTestId('representative-agreement-value')
    ).toHaveTextContent('common:no')
    expect(screen.queryByTestId('hasRepresentativeAgreementNo')).toBeNull()
    expect(screen.queryByTestId('representativeOrganizationName')).toBeNull()
  })

  it('shows the representative name as plain text for users who cannot edit', () => {
    renderComponent({
      canEdit: false,
      hasRepresentativeAgreement: true,
      representativeOrganizationName: 'ABC Environmental Services Ltd.'
    })

    expect(
      screen.getByTestId('representative-agreement-value')
    ).toHaveTextContent('common:yes — ABC Environmental Services Ltd.')
    expect(screen.queryByTestId('representative-agreement-save')).toBeNull()
    expect(screen.queryByTestId('hasRepresentativeAgreementYes')).toBeNull()
  })

  it('lets editors record an agreement and saves the trimmed name', async () => {
    renderComponent({ canEdit: true })

    fireEvent.click(radio('hasRepresentativeAgreementYes'))
    const input = nameInput()
    fireEvent.change(input, { target: { value: '  ABC Environmental  ' } })
    fireEvent.click(screen.getByText('common:saveBtn'))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        hasRepresentativeAgreement: true,
        representativeOrganizationName: 'ABC Environmental'
      })
    )
  })

  it('labels the Yes option "Yes, organisation name:" only while selected', () => {
    renderComponent({ canEdit: true })

    expect(screen.getByText('common:yes')).toBeInTheDocument()
    expect(screen.queryByText('org:representativeYesOrgName')).toBeNull()

    fireEvent.click(radio('hasRepresentativeAgreementYes'))

    expect(screen.getByText('org:representativeYesOrgName')).toBeInTheDocument()
    expect(screen.queryByText('common:yes')).toBeNull()
  })

  it('requires a name when an agreement is selected', async () => {
    renderComponent({ canEdit: true })

    fireEvent.click(radio('hasRepresentativeAgreementYes'))
    fireEvent.click(screen.getByText('common:saveBtn'))

    expect(
      await screen.findByText('org:representativeNameRequired')
    ).toBeInTheDocument()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('clears the name when switching an existing agreement to "No"', async () => {
    renderComponent({
      canEdit: true,
      hasRepresentativeAgreement: true,
      representativeOrganizationName: 'ABC Environmental'
    })

    fireEvent.click(radio('hasRepresentativeAgreementNo'))
    fireEvent.click(screen.getByText('common:saveBtn'))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        hasRepresentativeAgreement: false,
        representativeOrganizationName: null
      })
    )
  })

  it('discards the draft on cancel', () => {
    renderComponent({ canEdit: true })

    fireEvent.click(radio('hasRepresentativeAgreementYes'))
    fireEvent.click(screen.getByText('common:cancelBtn'))

    expect(radio('hasRepresentativeAgreementNo')).toBeChecked()
    expect(screen.queryByTestId('representativeOrganizationName')).toBeNull()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })
})
