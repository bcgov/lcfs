import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Recommendation } from '../Recommendation'
import { useForm, FormProvider } from 'react-hook-form'
import { vi } from 'vitest'
import { useTransfer } from '@/hooks/useTransfer'
import { wrapper } from '@/tests/utils/wrapper'
import { TRANSFER_STATUSES } from '@/constants/statuses'

vi.mock('@/hooks/useTransfer')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ transferId: '1' })
}))

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('Recommendation Component', () => {
  beforeEach(() => {
    useTransfer.mockReturnValue({
      data: {
        currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
        recommendation: 'approve'
      }
    })
  })

  test('renders correctly with title', () => {
    render(
      <MockFormProvider>
        <Recommendation />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('transfer:analystRecommend')).toBeInTheDocument()
  })

  test('displays radio buttons when status is SUBMITTED', () => {
    render(
      <MockFormProvider>
        <Recommendation />
      </MockFormProvider>,
      { wrapper }
    )
    expect(
      screen.getByLabelText('transfer:recommendRecord')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('transfer:recommendRefuse')
    ).toBeInTheDocument()
  })

  test('displays recommendation message when status is not SUBMITTED', () => {
    useTransfer.mockReturnValue({
      data: {
        currentStatus: { status: TRANSFER_STATUSES.RECOMMENDED },
        recommendation: 'approve'
      }
    })
    render(
      <MockFormProvider>
        <Recommendation />
      </MockFormProvider>,
      { wrapper }
    )
    expect(
      screen.getByText(/The analyst has recommended that you to/i)
    ).toBeInTheDocument()
    expect(screen.getByText('approve')).toBeInTheDocument()
  })

  test('allows selecting radio buttons', () => {
    render(
      <MockFormProvider>
        <Recommendation />
      </MockFormProvider>,
      { wrapper }
    )
    const recordRadio = screen.getByLabelText('transfer:recommendRecord')
    const refuseRadio = screen.getByLabelText('transfer:recommendRefuse')

    fireEvent.click(recordRadio)
    expect(recordRadio).toBeChecked()
    expect(refuseRadio).not.toBeChecked()

    fireEvent.click(refuseRadio)
    expect(refuseRadio).toBeChecked()
    expect(recordRadio).not.toBeChecked()
  })
})
