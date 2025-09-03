import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Recommendation } from '../Recommendation'
import { useForm, FormProvider } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransfer } from '@/hooks/useTransfer'
import { wrapper } from '@/tests/utils/wrapper'
import { TRANSFER_STATUSES } from '@/constants/statuses'

// Mock all dependencies
vi.mock('@/hooks/useTransfer')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'transfer:analystRecommend': 'Analyst Recommendation',
        'transfer:recommendRecord': 'Record',
        'transfer:recommendRefuse': 'Refuse'
      }
      return translations[key] || key
    }
  })
}))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ transferId: '1' })
}))

const MockFormProvider = ({ children }) => {
  const methods = useForm({
    defaultValues: { recommendation: null }
  })
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('Recommendation Component', () => {
  beforeEach(() => {
    useTransfer.mockReturnValue({
      data: {
        currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
        recommendation: 'Record'
      }
    })
  })

  describe('Component Rendering', () => {
    it('renders with correct title', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('Analyst Recommendation')).toBeInTheDocument()
    })

    it('renders correctly with currentStatus prop', () => {
      const currentStatus = { status: TRANSFER_STATUSES.SUBMITTED }
      
      render(
        <MockFormProvider>
          <Recommendation currentStatus={currentStatus} />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('Analyst Recommendation')).toBeInTheDocument()
    })
  })

  describe('SUBMITTED Status - RadioGroup Branch', () => {
    beforeEach(() => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          recommendation: 'Record'
        }
      })
    })

    it('displays radio buttons when status is SUBMITTED', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByLabelText('Record')).toBeInTheDocument()
      expect(screen.getByLabelText('Refuse')).toBeInTheDocument()
    })

    it('renders Controller component with radiogroup', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })

    it('allows selecting Record radio button', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      const recordRadio = screen.getByLabelText('Record')
      const refuseRadio = screen.getByLabelText('Refuse')

      fireEvent.click(recordRadio)
      
      expect(recordRadio).toBeChecked()
      expect(refuseRadio).not.toBeChecked()
    })

    it('allows selecting Refuse radio button', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      const recordRadio = screen.getByLabelText('Record')
      const refuseRadio = screen.getByLabelText('Refuse')

      fireEvent.click(refuseRadio)
      
      expect(refuseRadio).toBeChecked()
      expect(recordRadio).not.toBeChecked()
    })

    it('allows switching between radio button selections', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      const recordRadio = screen.getByLabelText('Record')
      const refuseRadio = screen.getByLabelText('Refuse')

      // Select Record first
      fireEvent.click(recordRadio)
      expect(recordRadio).toBeChecked()
      expect(refuseRadio).not.toBeChecked()

      // Switch to Refuse
      fireEvent.click(refuseRadio)
      expect(refuseRadio).toBeChecked()
      expect(recordRadio).not.toBeChecked()
    })

    it('has correct data-test attributes on radio buttons', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('recommend-record-radio')).toBeInTheDocument()
      expect(screen.getByTestId('recommend-refuse-radio')).toBeInTheDocument()
    })
  })

  describe('Non-SUBMITTED Status - Typography Branch', () => {
    it('displays recommendation message when status is RECOMMENDED', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.RECOMMENDED },
          recommendation: 'Record'
        }
      })
      
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText(/The analyst has recommended that you to/)).toBeInTheDocument()
      expect(screen.getByText('Record')).toBeInTheDocument()
    })

    it('displays recommendation message when status is APPROVED', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.APPROVED },
          recommendation: 'Refuse'
        }
      })
      
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText(/The analyst has recommended that you to/)).toBeInTheDocument()
      expect(screen.getByText('Refuse')).toBeInTheDocument()
    })

    it('displays recommendation message when status is DECLINED', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.DECLINED },
          recommendation: 'Record'
        }
      })
      
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText(/The analyst has recommended that you to/)).toBeInTheDocument()
      expect(screen.getByText('Record')).toBeInTheDocument()
    })

    it('does not display radio buttons when status is not SUBMITTED', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.RECOMMENDED },
          recommendation: 'Record'
        }
      })
      
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Record')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Refuse')).not.toBeInTheDocument()
    })
  })

  describe('Hook Integration and Edge Cases', () => {
    it('handles different recommendation values', () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.RECOMMENDED },
          recommendation: 'Custom Recommendation'
        }
      })
      
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('Custom Recommendation')).toBeInTheDocument()
    })

    it('correctly calls useTransfer hook with expected parameters', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Verify the hook was called
      expect(useTransfer).toHaveBeenCalledWith('1', {
        enabled: true,
        retry: false
      })
    })
  })

  describe('Form Integration', () => {
    it('integrates with form context correctly for Record selection', () => {
      const TestWrapper = () => {
        const methods = useForm({ defaultValues: { recommendation: 'Record' } })
        return (
          <FormProvider {...methods}>
            <Recommendation />
          </FormProvider>
        )
      }
      
      render(<TestWrapper />, { wrapper })
      
      const recordRadio = screen.getByLabelText('Record')
      expect(recordRadio).toBeChecked()
    })

    it('integrates with form context correctly for Refuse selection', () => {
      const TestWrapper = () => {
        const methods = useForm({ defaultValues: { recommendation: 'Refuse' } })
        return (
          <FormProvider {...methods}>
            <Recommendation />
          </FormProvider>
        )
      }
      
      render(<TestWrapper />, { wrapper })
      
      const refuseRadio = screen.getByLabelText('Refuse')
      expect(refuseRadio).toBeChecked()
    })

    it('has correct Controller configuration', () => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Controller should render radiogroup when status is SUBMITTED
      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })
  })
})