import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { Recommendation } from '../Recommendation'
import { useForm, FormProvider } from 'react-hook-form'
import { beforeEach, describe, expect, vi } from 'vitest'
import { useTransfer } from '@/hooks/useTransfer'
import { test } from '@/tests/utils/fixtures'
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
    test('renders with correct title', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByText('Analyst Recommendation')).toBeInTheDocument()
    })

    test('renders correctly with currentStatus prop', ({
      render,
      theme
    }) => {
      const currentStatus = { status: TRANSFER_STATUSES.SUBMITTED }

      render(
        <MockFormProvider>
          <Recommendation currentStatus={currentStatus} />
        </MockFormProvider>,
        [theme]
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

    test('displays radio buttons when status is SUBMITTED', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByLabelText('Record')).toBeInTheDocument()
      expect(screen.getByLabelText('Refuse')).toBeInTheDocument()
    })

    test('renders Controller component with radiogroup', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })

    test('allows selecting Record radio button', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      const recordRadio = screen.getByLabelText('Record')
      const refuseRadio = screen.getByLabelText('Refuse')

      fireEvent.click(recordRadio)

      expect(recordRadio).toBeChecked()
      expect(refuseRadio).not.toBeChecked()
    })

    test('allows selecting Refuse radio button', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      const recordRadio = screen.getByLabelText('Record')
      const refuseRadio = screen.getByLabelText('Refuse')

      fireEvent.click(refuseRadio)

      expect(refuseRadio).toBeChecked()
      expect(recordRadio).not.toBeChecked()
    })

    test('allows switching between radio button selections', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
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

    test('has correct data-test attributes on radio buttons', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('recommend-record-radio')).toBeInTheDocument()
      expect(screen.getByTestId('recommend-refuse-radio')).toBeInTheDocument()
    })
  })

  describe('Non-SUBMITTED Status - Typography Branch', () => {
    test('displays recommendation message when status is RECOMMENDED', ({
      render,
      theme
    }) => {
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
        [theme]
      )

      expect(
        screen.getByText(/The analyst has recommended that you to/)
      ).toBeInTheDocument()
      expect(screen.getByText('Record')).toBeInTheDocument()
    })

    test('displays recommendation message when status is APPROVED', ({
      render,
      theme
    }) => {
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
        [theme]
      )

      expect(
        screen.getByText(/The analyst has recommended that you to/)
      ).toBeInTheDocument()
      expect(screen.getByText('Refuse')).toBeInTheDocument()
    })

    test('displays recommendation message when status is DECLINED', ({
      render,
      theme
    }) => {
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
        [theme]
      )

      expect(
        screen.getByText(/The analyst has recommended that you to/)
      ).toBeInTheDocument()
      expect(screen.getByText('Record')).toBeInTheDocument()
    })

    test('does not display radio buttons when status is not SUBMITTED', ({
      render,
      theme
    }) => {
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
        [theme]
      )

      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Record')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Refuse')).not.toBeInTheDocument()
    })
  })

  describe('Hook Integration and Edge Cases', () => {
    test('handles different recommendation values', ({
      render,
      theme
    }) => {
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
        [theme]
      )

      expect(screen.getByText('Custom Recommendation')).toBeInTheDocument()
    })

    test('correctly calls useTransfer hook with expected parameters', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      // Verify the hook was called
      expect(useTransfer).toHaveBeenCalledWith('1', {
        enabled: true,
        retry: false
      })
    })
  })

  describe('Form Integration', () => {
    test('integrates with form context correctly for Record selection', ({
      render,
      theme
    }) => {
      const TestWrapper = () => {
        const methods = useForm({ defaultValues: { recommendation: 'Record' } })
        return (
          <FormProvider {...methods}>
            <Recommendation />
          </FormProvider>
        )
      }

      render(<TestWrapper />, [theme])

      const recordRadio = screen.getByLabelText('Record')
      expect(recordRadio).toBeChecked()
    })

    test('integrates with form context correctly for Refuse selection', ({
      render,
      theme
    }) => {
      const TestWrapper = () => {
        const methods = useForm({ defaultValues: { recommendation: 'Refuse' } })
        return (
          <FormProvider {...methods}>
            <Recommendation />
          </FormProvider>
        )
      }

      render(<TestWrapper />, [theme])

      const refuseRadio = screen.getByLabelText('Refuse')
      expect(refuseRadio).toBeChecked()
    })

    test('has correct Controller configuration', ({
      render,
      theme
    }) => {
      render(
        <MockFormProvider>
          <Recommendation />
        </MockFormProvider>,
        [theme]
      )

      // Controller should render radiogroup when status is SUBMITTED
      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()
    })
  })
})
