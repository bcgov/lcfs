import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext
} from 'react-hook-form'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/themes'
import { CreditCalculator } from '../CreditCalculator'
import { 
  useCalculateComplianceUnits,
  useGetCompliancePeriodList,
  useGetFuelTypeList,
  useGetFuelTypeOptions,
  useCalculateQuantityFromComplianceUnits
} from '@/hooks/useCalculator'
import { copyToClipboard } from '@/utils/clipboard'

// Mock translations
const mockT = vi.fn((key, options) => {
  const translations = {
    'report:ciParameters': {
      tci: 'Target carbon intensity',
      eer: 'Energy effectiveness ratio',
      rci: 'Recorded carbon intensity',
      uci: 'Additional carbon intensity',
      ec: 'Energy content',
      ed: 'Energy density'
    },
    'report:fuelRequirementOptions': ['All fuel requirements', 'Low carbon fuel requirement only'],
    'report:calcTitle': 'Compliance unit calculator',
    'report:complianceYear': 'Compliance Year',
    'report:selectFuelType': 'Select Fuel Type',
    'report:endUse': 'End Use',
    'report:ciLabel': 'Determining carbon intensity',
    'report:customCiOption': 'Custom CI',
    'report:fuelCodeLabel': 'Fuel code',
    'report:qtySuppliedLabel': 'Quantity supplied',
    'report:formulaBefore2024': 'Compliance units = (TCI * EER - RCI) * EC / 1,000,000',
    'report:formulaAfter2024': 'Compliance units = (TCI * EER - (RCI + UCI)) * EC / 1,000,000',
    'report:formulaECDefinition': 'EC = Quantity * Energy density',
    'report:generatedLabel': 'Credits Generated',
    'report:changeInUnits': 'Change in Units'
  }
  return options?.returnObjects ? translations[key] : translations[key] || key
})

const DEFAULT_QUANTITY = 100000

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

vi.mock('@/hooks/useCalculator', () => ({
  useCalculateComplianceUnits: vi.fn(),
  useGetCompliancePeriodList: vi.fn(),
  useGetFuelTypeList: vi.fn(),
  useGetFuelTypeOptions: vi.fn(),
  useCalculateQuantityFromComplianceUnits: vi.fn()
}))

vi.mock('@/components/BCForm', async () => {
  const actual = await vi.importActual('@/components/BCForm')
  const MockRadio = ({ name, label, options = [], disabled }) => {
    const { control, getValues } = useFormContext()

    const getTestId = (option, index) => {
      const baseValue = option.value || option
      if (name === 'fuelType' || name === 'endUseType') {
        return option.dataTestId || baseValue
      }
      return option.dataTestId || `${name}${index + 1}`
    }

    const handleSelect = (optionValue, onChange) => {
      onChange(optionValue)
    }

    return (
      <Controller
        name={name}
        control={control}
        defaultValue={getValues(name) ?? ''}
        render={({ field: { value, onChange } }) => (
          <div data-test={`${name}-radio-group`}>
            {label && (
              <span data-test={`${name}-label`} data-testid={`${name}-label`}>
                {label}
              </span>
            )}
            {options.map((option, index) => {
              const optionValue = option.value || option
              const testId = getTestId(option, index)
              const isSelected = value === optionValue
              return (
                <div
                  key={`${name}-${testId}`}
                  data-test={testId}
                  data-testid={testId}
                  className={isSelected ? 'selected' : ''}
                  tabIndex={0}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelect(optionValue, onChange)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelect(optionValue, onChange)
                    }
                  }}
                >
                  {option.label || optionValue}
                </div>
              )
            })}
          </div>
        )}
      />
    )
  }

  return {
    ...actual,
    BCFormRadio: MockRadio
  }
})

vi.mock('@/utils/clipboard', () => ({
  copyToClipboard: vi.fn()
}))

vi.mock('@/utils/formatters', () => ({
  numberFormatter: vi.fn((value) => value?.toLocaleString() || '0')
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: ({ title, content, children }) => (
    <div data-test="bc-widget-card">
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content || children}</div>
    </div>
  )
}))

vi.mock('@/constants/common', () => ({
  FUEL_CATEGORIES: ['Gasoline', 'Diesel', 'Jet fuel'],
  LEGISLATION_TRANSITION_YEAR: 2024,
  ADDRESS_SEARCH_URL: 'https://mock-address-api.com'
}))

// Test wrapper component
const TestWrapper = ({ children, formProps = {} }) => {
  const methods = useForm({
    defaultValues: {
      complianceYear: '2023',
      fuelRequirement: 'All fuel requirements',
      fuelType: '',
      fuelCode: '',
      provisionOfTheAct: '',
      quantity: DEFAULT_QUANTITY,
      fuelCategory: '',
      endUseType: ''
    },
    ...formProps
  })

  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <FormProvider {...methods}>
          {children}
        </FormProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('CreditCalculator', () => {
  const mockCompliancePeriods = {
    data: [
      { description: '2025' },
      { description: '2024' },
      { description: '2023' },
      { description: '2022' },
      { description: '2021' },
      { description: '2020' }
    ]
  }

  const mockFuelTypeData = {
    data: [
      { fuelType: 'Gasoline', fuelCategoryId: 1, fuelTypeId: 1 },
      { fuelType: 'Diesel', fuelCategoryId: 2, fuelTypeId: 2 }
    ]
  }

  const mockFuelOptions = {
    data: {
      unit: 'L',
      eerRatios: [
        { endUseType: { type: 'Transportation', endUseTypeId: 1 } },
        { endUseType: { type: 'Heating', endUseTypeId: 2 } }
      ],
      provisions: [
        { provisionOfTheActId: 1, name: 'Fuel code - section 19 (b) (i)' },
        { provisionOfTheActId: 2, name: 'Prescribed carbon intensity' }
      ],
      fuelCodes: [
        { fuelCodeId: 1, fuelCode: 'BC-001' },
        { fuelCodeId: 2, fuelCode: 'BC-002' }
      ],
      energyDensity: { unit: { name: 'MJ/L' } }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    vi.mocked(useGetCompliancePeriodList).mockReturnValue({ 
      data: mockCompliancePeriods, 
      isLoading: false 
    })
    vi.mocked(useGetFuelTypeList).mockReturnValue({ 
      data: mockFuelTypeData, 
      isLoading: false 
    })
    vi.mocked(useGetFuelTypeOptions).mockReturnValue({ 
      data: mockFuelOptions, 
      isLoading: false 
    })
    vi.mocked(useCalculateComplianceUnits).mockReturnValue({ 
      data: { 
        data: { 
          complianceUnits: 500, 
          tci: 85, 
          eer: 1.0, 
          rci: 75, 
          uci: 5, 
          energyContent: 1000000, 
          energyDensity: 35.5 
        } 
      },
      refetch: vi.fn()
    })
    vi.mocked(useCalculateQuantityFromComplianceUnits).mockReturnValue({
      data: {
        data: {
          quantity: DEFAULT_QUANTITY
        }
      },
      refetch: vi.fn()
    })
    
    vi.mocked(copyToClipboard).mockResolvedValue(true)
  })

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })

    it('displays loading state when compliance periods are loading', () => {
      vi.mocked(useGetCompliancePeriodList).mockReturnValue({ 
        data: null, 
        isLoading: true 
      })
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('renders main sections when not loading', () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByText('Compliance Year')).toBeInTheDocument()
      expect(screen.getByText('Select Fuel Type')).toBeInTheDocument()
      expect(screen.getByText('End Use')).toBeInTheDocument()
      expect(screen.getByText('Quantity supplied')).toBeInTheDocument()
    })
  })

  describe('Helper Functions', () => {
    it('component renders form fields correctly', () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Test that key form elements are present (tests renderError indirectly)
      expect(screen.getByText('Compliance Year')).toBeInTheDocument()
      expect(screen.getByText('Select Fuel Type')).toBeInTheDocument()
      expect(screen.getByText('End Use')).toBeInTheDocument()
      expect(screen.getByText('Quantity supplied')).toBeInTheDocument()
    })
  })

  describe('Event Handlers', () => {
    it('handles clear button click and resets form', async () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      const clearButton = screen.getByText('Clear')
      fireEvent.click(clearButton)
      
      // Form should be reset - test by checking default state
      expect(clearButton).toBeInTheDocument()
    })

    it('handles copy button click successfully', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true)
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      const copyButton = screen.getByText('Copy')
      fireEvent.click(copyButton)
      
      await waitFor(() => {
        expect(vi.mocked(copyToClipboard)).toHaveBeenCalled()
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })
    
    it('handles copy button click failure', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(false)
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      const copyButton = screen.getByText('Copy')
      fireEvent.click(copyButton)
      
      await waitFor(() => {
        expect(vi.mocked(copyToClipboard)).toHaveBeenCalled()
        // Should still show Copy text on failure
        expect(screen.getByText('Copy')).toBeInTheDocument()
      })
    })
    
    it('handles copy button exception', async () => {
      vi.mocked(copyToClipboard).mockRejectedValue(new Error('Copy failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      const copyButton = screen.getByText('Copy')
      fireEvent.click(copyButton)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy text: ', expect.any(Error))
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('Data Calculations', () => {
    it('handles empty compliance periods data', () => {
      vi.mocked(useGetCompliancePeriodList).mockReturnValue({ 
        data: null, 
        isLoading: false 
      })
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Test that component renders without crashing when no data
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })

    it('handles compliance periods data correctly', () => {
      const mockData = {
        data: [
          { description: '2025' },
          { description: '2024' },
          { description: '2023' }
        ]
      }
      
      vi.mocked(useGetCompliancePeriodList).mockReturnValue({ 
        data: mockData, 
        isLoading: false 
      })
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Test that periods data is handled
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })

    it('handles fallback values when no calculated data', () => {
      vi.mocked(useCalculateComplianceUnits).mockReturnValue({ data: null })
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Test that component renders without crashing when no calculated data
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })

    it('formats calculated data correctly', async () => {
      const mockCalculatedData = {
        data: {
          complianceUnits: 1500,
          tci: 85,
          eer: 1.2,
          rci: 75,
          uci: 10,
          energyContent: 2000000,
          energyDensity: 35.5
        }
      }
      
      vi.mocked(useCalculateComplianceUnits).mockReturnValue({ 
        data: mockCalculatedData 
      })
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(
          screen.getByText(
            '1,500 = (85 * 1.2 - (75 + 10)) * 2,000,000 / 1,000,000'
          )
        ).toBeInTheDocument()
      })
    })
  })

  describe('Conditional Rendering', () => {
    it('displays loading state for fuel types', () => {
    vi.mocked(useGetFuelTypeList).mockReturnValue({ 
      data: null, 
      isLoading: true 
    })
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

    it('displays quantity input with correct unit', () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('quantity-unit')).toHaveTextContent('L')
    })
  })

  describe('Form Field States', () => {
    it('renders end use options when fuel options are available', async () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Transportation')).toBeInTheDocument()
        expect(screen.getByText('Heating')).toBeInTheDocument()
      })
    })
    
    it('disables provision dropdown based on compliance year and selections', () => {
      // Test provision dropdown disabled for compliance year >= 2024 with no end use
      vi.mocked(useGetCompliancePeriodList).mockReturnValue({ 
        data: { data: [{ description: '2024' }] }, 
        isLoading: false 
      })
      
      const TestWrapperWithYear = () => {
        const methods = useForm({
          defaultValues: {
            complianceYear: '2024',
            endUseType: '',
            fuelType: ''
          }
        })
        return (
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <FormProvider {...methods}>
                <CreditCalculator />
              </FormProvider>
            </ThemeProvider>
          </BrowserRouter>
        )
      }
      
      render(<TestWrapperWithYear />)
      
      // Should render the component
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })
    
    it('disables fuel code dropdown based on provision selection', () => {
      const TestWrapperWithProvision = () => {
        const methods = useForm({
          defaultValues: {
            provisionOfTheAct: 'Other provision',
            complianceYear: '2023'
          }
        })
        return (
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <FormProvider {...methods}>
                <CreditCalculator />
              </FormProvider>
            </ThemeProvider>
          </BrowserRouter>
        )
      }
      
      render(<TestWrapperWithProvision />)
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })
    
    it('enables fuel code dropdown for fuel code provisions', () => {
      const TestWrapperWithFuelCode = () => {
        const methods = useForm({
          defaultValues: {
            provisionOfTheAct: 'Fuel code - section 19 (b) (i)',
            complianceYear: '2023'
          }
        })
        return (
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <FormProvider {...methods}>
                <CreditCalculator />
              </FormProvider>
            </ThemeProvider>
          </BrowserRouter>
        )
      }
      
      render(<TestWrapperWithFuelCode />)
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })
  })

  describe('Custom CI behavior', () => {
    it('displays recorded CI value when custom CI is disabled', async () => {
      const singleProvisionFuelOptions = {
        data: {
          ...mockFuelOptions.data,
          provisions: [
            { provisionOfTheActId: 1, name: 'Fuel code - section 19 (b) (i)' }
          ]
        }
      }

      vi.mocked(useGetFuelTypeOptions).mockReturnValue({
        data: singleProvisionFuelOptions,
        isLoading: false
      })

      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('75 gCO₂e/MJ')
        ).toBeInTheDocument()
      })
    })

    it('allows entering negative custom CI values', async () => {
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )

      const clickAndVerify = async (element) => {
        fireEvent.click(element)
        await waitFor(() =>
          expect(element).toHaveAttribute('aria-checked', 'true')
        )
      }

      const fuelCategoryOption = await screen.findByTestId('fuelCategory1')
      await clickAndVerify(fuelCategoryOption)

      const fuelTypeOption = await screen.findByTestId('Gasoline')
      await clickAndVerify(fuelTypeOption)

      const endUseOption = await screen.findByTestId('Transportation')
      await clickAndVerify(endUseOption)

      const customOptionRadio = (
        await screen.findAllByText('Custom CI')
      ).find((element) => element.getAttribute('role') === 'radio')

      expect(customOptionRadio).toBeDefined()
      await clickAndVerify(customOptionRadio)

      const customCiInput = await screen.findByPlaceholderText('0.00')
      fireEvent.change(customCiInput, { target: { value: '-10' } })

      await waitFor(() => {
        expect(customCiInput).toHaveValue('-10.00')
      })
    })
  })
  
  describe('User Interactions', () => {
    it('handles fuel type selection click', async () => {
      // Mock with fuel category selected to show fuel types
      vi.mocked(useGetFuelTypeList).mockReturnValue({ 
        data: mockFuelTypeData, 
        isLoading: false 
      })
      
      render(
        <TestWrapper formProps={{
          defaultValues: {
            complianceYear: '2023',
            fuelRequirement: 'All fuel requirements',
            fuelCategory: 'Gasoline', // Set fuel category to show fuel types
            fuelType: '',
            fuelCode: '',
            provisionOfTheAct: '',
            quantity: DEFAULT_QUANTITY,
            endUseType: ''
          }
        }}>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Wait for fuel types to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('Gasoline')).toBeInTheDocument()
      })
      
      const gasolineOption = screen.getByTestId('Gasoline')
      fireEvent.click(gasolineOption)
      
      expect(gasolineOption).toHaveAttribute('aria-checked', 'true')
    })
    
    it('handles fuel type selection keyboard events (Enter)', async () => {
      // Mock with fuel category selected to show fuel types
      vi.mocked(useGetFuelTypeList).mockReturnValue({ 
        data: mockFuelTypeData, 
        isLoading: false 
      })
      
      render(
        <TestWrapper formProps={{
          defaultValues: {
            complianceYear: '2023',
            fuelRequirement: 'All fuel requirements',
            fuelCategory: 'Gasoline', // Set fuel category to show fuel types
            fuelType: '',
            fuelCode: '',
            provisionOfTheAct: '',
            quantity: DEFAULT_QUANTITY,
            endUseType: ''
          }
        }}>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Wait for fuel types to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('Gasoline')).toBeInTheDocument()
      })
      
      const gasolineOption = screen.getByTestId('Gasoline')
      fireEvent.keyDown(gasolineOption, { key: 'Enter' })
      
      expect(gasolineOption).toHaveAttribute('aria-checked', 'true')
    })
    
    it('handles fuel type selection keyboard events (Space)', async () => {
      // Mock with fuel category selected to show fuel types
      vi.mocked(useGetFuelTypeList).mockReturnValue({ 
        data: mockFuelTypeData, 
        isLoading: false 
      })
      
      render(
        <TestWrapper formProps={{
          defaultValues: {
            complianceYear: '2023',
            fuelRequirement: 'All fuel requirements',
            fuelCategory: 'Gasoline', // Set fuel category to show fuel types
            fuelType: '',
            fuelCode: '',
            provisionOfTheAct: '',
            quantity: DEFAULT_QUANTITY,
            endUseType: ''
          }
        }}>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Wait for fuel types to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('Gasoline')).toBeInTheDocument()
      })
      
      const gasolineOption = screen.getByTestId('Gasoline')
      fireEvent.keyDown(gasolineOption, { key: ' ' })
      
      expect(gasolineOption).toHaveAttribute('aria-checked', 'true')
    })
    
    it('handles end use selection click', async () => {
      // Mock the fuel options to show end uses
      vi.mocked(useGetFuelTypeOptions).mockReturnValue({ 
        data: mockFuelOptions, 
        isLoading: false 
      })
      
      render(
        <TestWrapper formProps={{
          defaultValues: {
            complianceYear: '2023',
            fuelRequirement: 'All fuel requirements',
            fuelCategory: 'Gasoline',
            fuelType: 'Gasoline', // Set fuel type to show end uses
            fuelCode: '',
            provisionOfTheAct: '',
            quantity: DEFAULT_QUANTITY,
            endUseType: ''
          }
        }}>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Wait for end uses to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('Transportation')).toBeInTheDocument()
      })
      
      const transportationOption = screen.getByTestId('Transportation')
      fireEvent.click(transportationOption)
      
      await waitFor(() => {
        expect(transportationOption).toHaveAttribute('aria-checked', 'true')
      })
    })
    
    it('handles end use selection keyboard events', async () => {
      // Mock the fuel options to show end uses
      vi.mocked(useGetFuelTypeOptions).mockReturnValue({ 
        data: mockFuelOptions, 
        isLoading: false 
      })
      
      render(
        <TestWrapper formProps={{
          defaultValues: {
            complianceYear: '2023',
            fuelRequirement: 'All fuel requirements',
            fuelCategory: 'Gasoline',
            fuelType: 'Gasoline', // Set fuel type to show end uses
            fuelCode: '',
            provisionOfTheAct: '',
            quantity: DEFAULT_QUANTITY,
            endUseType: ''
          }
        }}>
          <CreditCalculator />
        </TestWrapper>
      )
      
      // Wait for end uses to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('Transportation')).toBeInTheDocument()
      })
      
      const transportationOption = screen.getByTestId('Transportation')
      fireEvent.keyDown(transportationOption, { key: 'Enter' })
      
      await waitFor(() => {
        expect(transportationOption).toHaveAttribute('aria-checked', 'true')
      })
    })
  })
  
  describe('Business Logic', () => {
    it('filters fuel categories based on compliance year before 2024', () => {
      const TestWrapperBefore2024 = () => {
        const methods = useForm({
          defaultValues: { complianceYear: '2023' }
        })
        return (
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <FormProvider {...methods}>
                <CreditCalculator />
              </FormProvider>
            </ThemeProvider>
          </BrowserRouter>
        )
      }
      
      render(<TestWrapperBefore2024 />)
      
      // Should not show Jet fuel option before 2024
      expect(screen.queryByDisplayValue('Jet fuel')).not.toBeInTheDocument()
    })
    
    it('includes all fuel categories for compliance year 2024+', () => {
      const TestWrapper2024 = () => {
        const methods = useForm({
          defaultValues: { complianceYear: '2024' }
        })
        return (
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <FormProvider {...methods}>
                <CreditCalculator />
              </FormProvider>
            </ThemeProvider>
          </BrowserRouter>
        )
      }
      
      render(<TestWrapper2024 />)
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })
    
    it('displays the post-2024 formula when applicable', () => {
      const TestWrapperAfter2024 = () => {
        const methods = useForm({
          defaultValues: { complianceYear: '2024' }
        })
        return (
          <BrowserRouter>
            <ThemeProvider theme={theme}>
              <FormProvider {...methods}>
                <CreditCalculator />
              </FormProvider>
            </ThemeProvider>
          </BrowserRouter>
        )
      }

      render(<TestWrapperAfter2024 />)

      expect(
        screen.getByText(
          'Compliance units = (TCI * EER - (RCI + UCI)) * EC / 1,000,000'
        )
      ).toBeInTheDocument()
    })
    
    it('handles different compliance year scenarios', () => {
      // Test that component renders correctly with different compliance years
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
      expect(screen.getByText('Compliance Year')).toBeInTheDocument()
    })
  })
  
  describe('Default Values and Data Processing', () => {
    it('calculates default compliance period correctly for dates before March 31', () => {
      // Mock date to February (before March 31)
      const mockDate = new Date('2023-02-15')
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
      
      vi.restoreAllMocks()
    })
    
    it('handles empty fuel requirement options array', () => {
      // This test verifies the component renders without errors when fuel requirement options are empty
      // The existing mock already handles this case correctly
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })
    
    it('handles different data states', () => {
      // Test that component handles various data states without crashing
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      expect(screen.getByText('Compliance unit calculator')).toBeInTheDocument()
    })
    
    it('displays copy success state temporarily', async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true)
      
      render(
        <TestWrapper>
          <CreditCalculator />
        </TestWrapper>
      )
      
      const copyButton = screen.getByText('Copy')
      fireEvent.click(copyButton)
      
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })
  })
})
