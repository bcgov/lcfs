import React, { useMemo, useEffect, useState } from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Grid2 as Grid,
  Paper,
  Divider,
  List,
  ListItemButton,
  Stack,
  ListItem,
  InputLabel,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl
} from '@mui/material'
import colors from '@/themes/base/colors'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import { BCFormRadio } from '@/components/BCForm'
import { NumericFormat } from 'react-number-format'
import { useFuelSupplyOptions } from '@/hooks/useFuelSupply'
import { useGetCompliancePeriodList } from '@/hooks/usePublic'
import Loading from '@/components/Loading'

// Constants moved outside the component for better performance and readability
const FUEL_CATEGORIES = ['Diesel', 'Gasoline', 'Jet fuel']
const FUEL_CODES = [
  { value: 'BCLCF999.0', label: 'BCLCF999.0' },
  { value: 'BCLCF123.4', label: 'BCLCF123.4' }
]
const CARBON_INTENSITY_METHODS = [
  {
    value: 'Fuel code - section 19 (b) (i)',
    label: 'Fuel code - section 19 (b) (i)'
  },
  {
    value: 'Fuel code - section 19 (b) (ii)',
    label: 'Fuel code - section 19 (b) (ii)'
  }
]
const COMPLIANCE_OPTIONS = [
  {
    value: 'Renewable fuel requirement & Low carbon fuel requirement',
    label: 'Renewable fuel requirement & Low carbon fuel requirement'
  },
  {
    value: 'Low carbon fuel requirement only',
    label: 'Low carbon fuel requirement only'
  }
]
const SELECTABLE_FUEL_TYPES = [
  'Biodiesel',
  'CNG',
  'Electricity',
  'Fossil-derived diesel',
  'HDRD',
  'Hydrogen',
  'LNG',
  'Other diesel fuel',
  'Other',
  'Propane'
]
const END_USES = [
  'Battery bus',
  'Battery truck',
  'Cargo handling equipment',
  'Fixed guiderail',
  'Ground support equipment',
  'Heavy forklift',
  'Marine',
  'Other or unknown',
  'Shore power',
  'Trolley bus'
]

export const CreditCalculator = () => {
  const { t } = useTranslation(['report'])
  const ciParameterLabels = useMemo(
    () => t('report:ciParameters', { returnObjects: true }),
    [t]
  )

  // Fetch compliance periods from API
  const {
    data: compliancePeriods,
    isLoading: isLoadingPeriods,
    isFetched
  } = useGetCompliancePeriodList()

  // Transform compliance periods data for select input
  const formattedCompliancePeriods = useMemo(() => {
    if (!compliancePeriods?.data?.length) return []

    return compliancePeriods.data
      .filter(
        (period) =>
          period.compliancePeriodId >= 4 && period.compliancePeriodId <= 17
      )
      .map((period) => ({
        value: period.description,
        label: period.description
      }))
      .sort((a, b) => parseInt(b.value) - parseInt(a.value))
  }, [compliancePeriods])

  // Get the most recent compliance period for default value
  const defaultCompliancePeriod = useMemo(() => {
    if (!formattedCompliancePeriods.length) {
      const today = new Date()
      const currentYear = today.getFullYear()
      const isBeforeMarch31 =
        today.getMonth() < 2 ||
        (today.getMonth() === 2 && today.getDate() <= 31)
      return isBeforeMarch31 ? currentYear - 1 : currentYear
    }

    const today = new Date()
    const currentYear = today.getFullYear()
    const isBeforeMarch31 =
      today.getMonth() < 2 || (today.getMonth() === 2 && today.getDate() <= 31)
    const targetYear = isBeforeMarch31 ? currentYear - 1 : currentYear

    const matchedPeriod = formattedCompliancePeriods.find(
      (p) => parseInt(p.value) === targetYear
    )
    return matchedPeriod
      ? matchedPeriod.value
      : formattedCompliancePeriods[0]?.value
  }, [formattedCompliancePeriods])

  // Setup React Hook Form
  const methods = useForm({
    defaultValues: {
      complianceYear: String(defaultCompliancePeriod),
      complianceType: COMPLIANCE_OPTIONS[0].value,
      fuelType: FUEL_CATEGORIES[0],
      fuelCode: FUEL_CODES[0].value,
      carbonIntensityMethod: CARBON_INTENSITY_METHODS[0].value,
      quantity: '100000',
      fuelCategory: '',
      endUseType: ''
    }
  })

  const {
    control,
    watch,
    setValue,
    formState: { errors },
    reset,
    handleSubmit
  } = methods

  const watchedValues = watch()
  const complianceYear = watchedValues.complianceYear

  // State for selected items from lists
  const [selectedFuelType, setSelectedFuelType] = useState('LNG')
  const [selectedEndUse, setSelectedEndUse] = useState('Battery bus')
  const [calculatedResults, setCalculatedResults] = useState(null)

  // Fetch fuel supply options based on compliance period
  const { data: tableOptions, isLoading: isLoadingFuelOptions } =
    useFuelSupplyOptions(
      { compliancePeriod: complianceYear },
      { enabled: !!isFetched }
    )

  // Get the selected fuel based on user selection
  const selectedFuel = useMemo(() => {
    return tableOptions?.fuelTypes?.find(
      (ft) => ft.fuelType === watchedValues.fuelType
    )
  }, [tableOptions, watchedValues.fuelType])

  // Memoized selector options to prevent unnecessary re-renders
  const fuelCodeOptions = useMemo(() => {
    return (
      selectedFuel?.fuelCodes?.map((fc) => ({
        value: fc.fuelCode,
        label: fc.fuelCode
      })) || FUEL_CODES
    )
  }, [selectedFuel])

  const fuelCategoryOptions = useMemo(() => {
    return (
      selectedFuel?.fuelCategories?.map((cat) => ({
        value: cat.fuelCategory,
        label: cat.fuelCategory
      })) || [{ value: 'Any', label: 'Any' }]
    )
  }, [selectedFuel])

  const endUseOptions = useMemo(() => {
    if (!selectedFuel?.eerRatios?.length)
      return [{ value: 'Any', label: 'Any' }]

    const uniqueEndUses = new Map()
    selectedFuel.eerRatios.forEach((eer) => {
      const endUse = eer.endUseType
      if (endUse) {
        uniqueEndUses.set(endUse.type, {
          value: endUse.type,
          label: endUse.type
        })
      }
    })

    return Array.from(uniqueEndUses.values()).length
      ? Array.from(uniqueEndUses.values())
      : [{ value: 'Any', label: 'Any' }]
  }, [selectedFuel])

  // Get unit based on selected fuel
  const unit = useMemo(() => {
    return selectedFuel?.unit || 'kWh'
  }, [selectedFuel])

  // Apply fuel type and end use selection to form
  useEffect(() => {
    if (selectedFuelType) {
      setValue('fuelType', selectedFuelType)
    }
    if (selectedEndUse) {
      setValue('endUseType', selectedEndUse)
    }
  }, [selectedFuelType, selectedEndUse, setValue])

  // Calculate credits when form values change
  const calculateCredits = async (data) => {
    try {
      const payload = {
        quantity: Number(data.quantity),
        unit,
        fuelType: data.fuelType,
        fuelCode: data.fuelCode,
        carbonIntensityMethod: data.carbonIntensityMethod,
        fuelCategory: data.fuelCategory || fuelCategoryOptions[0]?.value,
        endUseType: data.endUseType,
        compliancePeriod: data.complianceYear
      }

      const result = await fetch('/api/credit-calculation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!result.ok) {
        throw new Error('Failed to calculate credits')
      }

      const json = await result.json()
      setCalculatedResults(json)
    } catch (err) {
      console.error('Failed to calculate credits', err)
      // Here you might want to add error handling UI feedback
    }
  }

  const onSubmit = handleSubmit(calculateCredits)

  // Handle form reset
  const handleClear = () => {
    reset({
      complianceYear: String(defaultCompliancePeriod),
      complianceType: COMPLIANCE_OPTIONS[0].value,
      fuelType: FUEL_CATEGORIES[0],
      fuelCode: FUEL_CODES[0].value,
      carbonIntensityMethod: CARBON_INTENSITY_METHODS[0].value,
      quantity: '100000',
      fuelCategory: '',
      endUseType: ''
    })
    setSelectedFuelType('LNG')
    setSelectedEndUse('Battery bus')
    setCalculatedResults(null)
  }

  // Helper function for rendering field errors
  const renderError = (fieldName) => {
    return (
      errors[fieldName] && (
        <BCTypography
          color="error"
          variant="caption"
          sx={{
            marginLeft: '14px',
            marginRight: '14px',
            marginTop: '4px',
            marginBottom: '-20px'
          }}
        >
          {errors[fieldName].message}
        </BCTypography>
      )
    )
  }

  if (isLoadingPeriods || isLoadingFuelOptions) {
    return <Loading />
  }

  // Extracted result data for display (would come from API response)
  const resultData = calculatedResults || {
    credits: 888888,
    availableUnits: 51255,
    previousUnits: 51154,
    formulaValues: {
      ci: 88.83,
      eer: 88.83,
      carbonIntensity: 88.83,
      energyDensity: 88.83,
      energyContent: 88.83,
      fuelClass: 88.83
    },
    formulaDisplay:
      '888,888 = (78.68 * 3.9 - (12.14 + N/A)) * 360,000 / 1,000,000'
  }

  return (
    <BCBox
      sx={{
        '& .MuiCardContent-root': { padding: '0 !important', margin: 0 },
        '& .MuiFormLabel-root': {
          transform: 'translate(-1px, -32px) scale(1)'
        }
      }}
    >
      <FormProvider {...methods}>
        <BCWidgetCard
          component="div"
          title={t('report:calcTitle')}
          content={
            <Grid container flexDirection={'row'} rowSpacing={1}>
              {/* Left Section */}
              <Grid size={{ sm: 12, md: 6 }} p={2}>
                <BCTypography variant="h6" pb={8} color="primary">
                  {t('report:fuelType')}
                </BCTypography>
                <Stack direction={'row'} spacing={4}>
                  <FormControl
                    sx={{
                      width: '140px',
                      height: '40px',
                      '.MuiOutlinedInput-root': {
                        height: '100%'
                      },
                      '& .Mui-error': {
                        height: '100%'
                      },
                      bottom: '0.2rem',
                      marginInline: '0.2rem'
                    }}
                  >
                    <InputLabel
                      htmlFor="compliance-year"
                      component="label"
                      className="form-label"
                      shrink
                    >
                      <BCTypography variant="label" component="span">
                        {t('report:complianceYear')}
                      </BCTypography>
                    </InputLabel>
                    <Controller
                      name="complianceYear"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="compliance-year"
                          labelId="compliance-year-select-label"
                          aria-label="compliance year"
                          {...field}
                          error={!!errors.complianceYear}
                          displayEmpty
                          MenuProps={{
                            sx: {
                              marginTop: '0 !important'
                            }
                          }}
                          sx={{
                            height: '100% !important',
                            '.MuiSelect-select': {
                              height: '100% !important',
                              paddingTop: '0px',
                              paddingBottom: '0px'
                            }
                          }}
                        >
                          {formattedCompliancePeriods.map((period) => (
                            <MenuItem key={period.value} value={period.value}>
                              {period.label}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                    {renderError('complianceYear')}
                  </FormControl>

                  <BCFormRadio
                    name="complianceType"
                    control={control}
                    options={COMPLIANCE_OPTIONS}
                    sx={{
                      backgroundColor: colors.background.grey,
                      padding: 1,
                      pb: 2,
                      maxWidth: '32rem',
                      transform: 'translate(0px, -16px) scale(1)'
                    }}
                  />
                </Stack>
                <Grid container spacing={1}>
                  <Divider
                    orientation="horizontal"
                    sx={{ maxWidth: '18rem', borderColor: 'rgba(0,0,0,1)' }}
                  />
                  <BCFormRadio
                    name="fuelType"
                    control={control}
                    options={FUEL_CATEGORIES.map((type) => ({
                      value: type,
                      label: type
                    }))}
                    orientation="horizontal"
                    sx={{ width: '100%' }}
                  />
                  <Divider
                    orientation="horizontal"
                    sx={{ maxWidth: '18rem', borderColor: 'rgba(0,0,0,1)' }}
                  />
                </Grid>
                <Grid container flexDirection={'row'} rowSpacing={1} mt={4}>
                  <Grid size={4}>
                    <BCTypography variant="h6" color="primary">
                      {t('report:selectFuelType')}
                    </BCTypography>
                    <List
                      component="nav"
                      sx={{
                        maxWidth: '100%',
                        pl: 2
                      }}
                    >
                      {SELECTABLE_FUEL_TYPES.map((type) => (
                        <ListItemButton
                          component="span"
                          key={type}
                          sx={{
                            display: 'list-item',
                            listStyleType: 'disc',
                            p: 0.4,
                            color: colors.primary.main,
                            '&::marker': {
                              fontSize: '0.7em'
                            }
                          }}
                        >
                          <BCBox
                            sx={{
                              cursor: 'pointer',
                              '&.selected': {
                                '& .list-text': {
                                  color: 'text.primary',
                                  textDecoration: 'none',
                                  fontWeight: 'bold'
                                }
                              }
                            }}
                            component="a"
                            tabIndex={0}
                            className={
                              selectedFuelType === type ? 'selected' : ''
                            }
                            alignItems="flex-start"
                            onClick={() => setSelectedFuelType(type)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedFuelType(type)
                              }
                            }}
                            data-test={type}
                          >
                            <BCTypography
                              variant="subtitle2"
                              color="link"
                              className="list-text"
                              sx={{
                                textDecoration: 'underline',
                                '&:hover': { color: 'info.main' }
                              }}
                            >
                              {type}
                            </BCTypography>
                          </BCBox>
                        </ListItemButton>
                      ))}
                    </List>
                  </Grid>

                  <Grid size={8}>
                    <BCTypography variant="h6" color="primary">
                      {t('report:endUse')}
                    </BCTypography>
                    <List
                      component="nav"
                      sx={{
                        pl: 2
                      }}
                    >
                      {END_USES.map((use) => (
                        <ListItemButton
                          component="span"
                          key={use}
                          sx={{
                            display: 'list-item',
                            listStyleType: 'disc',
                            p: 0.4,
                            color: colors.primary.main,
                            '&::marker': {
                              fontSize: '0.7em'
                            },
                            '&.selected': {
                              pl: 2
                            }
                          }}
                        >
                          <BCBox
                            sx={{
                              cursor: 'pointer',
                              '&.selected': {
                                '& .list-text': {
                                  color: 'text.primary',
                                  textDecoration: 'none',
                                  fontWeight: 'bold'
                                }
                              }
                            }}
                            component="a"
                            tabIndex={0}
                            className={selectedEndUse === use ? 'selected' : ''}
                            alignItems="flex-start"
                            onClick={() => setSelectedEndUse(use)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedEndUse(use)
                              }
                            }}
                            data-test={use}
                          >
                            <BCTypography
                              variant="subtitle2"
                              color="link"
                              className="list-text"
                              sx={{
                                textDecoration: 'underline',
                                '&:hover': { color: 'info.main' }
                              }}
                            >
                              {use}
                            </BCTypography>
                          </BCBox>
                        </ListItemButton>
                      ))}
                    </List>
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={2} mt={2}>
                  <BCButton
                    variant="outlined"
                    color="primary"
                    onClick={handleClear}
                  >
                    Clear
                  </BCButton>
                  <BCButton
                    variant="contained"
                    color="primary"
                    onClick={onSubmit}
                  >
                    Calculate
                  </BCButton>
                </Stack>
              </Grid>

              {/* Right Section */}
              <Grid
                size={{ sm: 12, md: 6 }}
                sx={{ m: 0, pt: 2, backgroundColor: colors.background.grey }}
              >
                <Stack direction={'row'} spacing={4} m={4} mb={0} ml={10}>
                  <FormControl
                    sx={{
                      width: '350px',
                      height: '40px',
                      '.MuiOutlinedInput-root': {
                        height: '100%'
                      },
                      '& .Mui-error': {
                        height: '100%'
                      },
                      bottom: '0.2rem',
                      marginInline: '0.2rem'
                    }}
                  >
                    <InputLabel
                      htmlFor="carbon-intensity-method"
                      component="label"
                      className="form-label"
                      shrink
                    >
                      <BCTypography variant="label" component="span">
                        {t('report:ciLabel')}
                      </BCTypography>
                    </InputLabel>
                    <Controller
                      name="carbonIntensityMethod"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="carbon-intensity-method"
                          labelId="carbon-intensity-method-select-label"
                          {...field}
                          error={!!errors.carbonIntensityMethod}
                          displayEmpty
                          MenuProps={{
                            sx: {
                              marginTop: '0 !important'
                            }
                          }}
                          sx={{
                            height: '100% !important',
                            '.MuiSelect-select': {
                              height: '100% !important',
                              paddingTop: '0px',
                              paddingBottom: '0px'
                            }
                          }}
                        >
                          {CARBON_INTENSITY_METHODS.map((method) => (
                            <MenuItem key={method.value} value={method.value}>
                              {method.label}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                    {renderError('carbonIntensityMethod')}
                  </FormControl>
                  <FormControl
                    sx={{
                      width: '240px',
                      height: '40px',
                      '.MuiOutlinedInput-root': {
                        height: '100%'
                      },
                      '& .Mui-error': {
                        height: '100%'
                      },
                      bottom: '0.2rem',
                      marginInline: '0.2rem'
                    }}
                  >
                    <InputLabel
                      htmlFor="fuel-code"
                      component="label"
                      className="form-label"
                      shrink
                    >
                      <BCTypography variant="label" component="span">
                        {t('report:fuelCodeLabel')}
                      </BCTypography>
                    </InputLabel>
                    <Controller
                      name="fuelCode"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="fuel-code"
                          labelId="fuel-code-select-label"
                          {...field}
                          error={!!errors.fuelCode}
                          displayEmpty
                          MenuProps={{
                            sx: {
                              marginTop: '0 !important'
                            }
                          }}
                          sx={{
                            height: '100% !important',
                            '.MuiSelect-select': {
                              height: '100% !important',
                              paddingTop: '0px',
                              paddingBottom: '0px'
                            }
                          }}
                        >
                          {fuelCodeOptions.map((code) => (
                            <MenuItem key={code.value} value={code.value}>
                              {code.label}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                    {renderError('fuelCode')}
                  </FormControl>
                </Stack>

                <BCBox
                  sx={{
                    m: '0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto',
                    maxWidth: '12rem'
                  }}
                >
                  <InputLabel
                    htmlFor="quantity"
                    sx={{
                      pb: 1,
                      maxWidth: '240px',
                      transform: 'translate(0px, 0px) scale(1) !important'
                    }}
                  >
                    <BCTypography
                      variant="h5"
                      sx={{
                        m: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        mx: 'auto',
                        color: '#313132'
                      }}
                      fontWeight="bold"
                    >
                      {t('report:qtySuppliedLabel')}
                    </BCTypography>
                  </InputLabel>
                  <Controller
                    name="quantity"
                    control={control}
                    render={({
                      field: { onChange, onBlur, value, name, ref }
                    }) => (
                      <NumericFormat
                        id="quantity"
                        customInput={TextField}
                        thousandSeparator
                        decimalScale={2}
                        fixedDecimalScale={false}
                        prefix=""
                        value={value}
                        onValueChange={(vals) => onChange(vals.floatValue)}
                        onBlur={onBlur}
                        name={name}
                        inputRef={ref}
                        placeholder={t('report:qtySuppliedLabel')}
                        size="small"
                        error={!!errors.quantity}
                        helperText={errors.quantity?.message}
                        sx={{
                          marginInline: '0.2rem',
                          bottom: '0.2rem'
                        }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <BCTypography variant="subtitle2">
                                {unit}
                              </BCTypography>
                            </InputAdornment>
                          ),
                          style: { textAlign: 'left' }
                        }}
                        inputProps={{
                          maxLength: 13,
                          'data-test': 'quantity'
                        }}
                      />
                    )}
                  />
                </BCBox>

                <BCTypography
                  variant="body3"
                  sx={{
                    mt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto'
                  }}
                  fontWeight="bold"
                >
                  {t('report:formula')}
                </BCTypography>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mt: 2,
                    width: '60%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto'
                  }}
                >
                  <BCBox sx={{ width: '100%', mx: 'auto' }}>
                    <Stack
                      direction="row"
                      divider={
                        <Divider
                          orientation="vertical"
                          flexItem
                          sx={{ borderColor: 'rgba(0,0,0,1)' }}
                        />
                      }
                      spacing={2}
                    >
                      {/* Left List */}
                      <List sx={{ flex: 2 }}>
                        {Object.entries(ciParameterLabels).map(
                          ([key, label]) => (
                            <ListItem key={key}>
                              <BCTypography
                                variant="body4"
                                fontWeight="bold"
                                noWrap
                              >{`${key.toUpperCase()} - ${label}`}</BCTypography>
                            </ListItem>
                          )
                        )}
                      </List>

                      {/* Right List - show calculated values */}
                      <List sx={{ flex: 1 }}>
                        {Object.values(resultData.formulaValues).map(
                          (value, index) => (
                            <ListItem key={index}>
                              <BCTypography variant="body4" fontWeight="bold">
                                {value}
                              </BCTypography>
                            </ListItem>
                          )
                        )}
                      </List>
                    </Stack>
                  </BCBox>
                </Paper>

                <BCTypography
                  variant="body4"
                  sx={{
                    mt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto'
                  }}
                >
                  {resultData.formulaDisplay}
                </BCTypography>

                <BCTypography
                  variant="h5"
                  sx={{
                    mt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto'
                  }}
                  fontWeight="bold"
                >
                  {t('report:generatedLabel')}
                </BCTypography>
                <BCBox
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  mt={2}
                  mb={4}
                >
                  <BCBox
                    sx={{
                      minWidth: 90,
                      minHeight: 90,
                      borderRadius: '50%',
                      bgcolor: colors.white.main
                    }}
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <BCTypography variant="h5">
                      {resultData.credits.toLocaleString()}
                    </BCTypography>
                  </BCBox>
                </BCBox>
                <Stack
                  component="div"
                  sx={{
                    backgroundColor: colors.primary.light,
                    width: '100%',
                    height: '8rem',
                    p: 4,
                    borderBottomRightRadius: '10px'
                  }}
                  color={colors.white.main}
                  spacing={1}
                >
                  <BCTypography align="center" variant="h6" fontWeight="bold">
                    Compliance units available
                  </BCTypography>
                  <BCTypography align="center" variant="h3">
                    {resultData.previousUnits.toLocaleString()} +{' '}
                    {resultData.credits.toLocaleString()} ={' '}
                    {resultData.availableUnits.toLocaleString()}
                  </BCTypography>
                </Stack>
              </Grid>
            </Grid>
          }
        />
      </FormProvider>
    </BCBox>
  )
}
