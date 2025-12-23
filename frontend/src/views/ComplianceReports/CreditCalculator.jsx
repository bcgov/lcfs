import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Grid2 as Grid,
  Paper,
  Divider,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputAdornment
} from '@mui/material'
import colors from '@/themes/base/colors'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import { BCFormRadio } from '@/components/BCForm'
import { NumericFormat } from 'react-number-format'
import {
  useCalculateComplianceUnits,
  useGetCompliancePeriodList,
  useGetFuelTypeList,
  useGetFuelTypeOptions,
  useCalculateQuantityFromComplianceUnits
} from '@/hooks/useCalculator'
import Loading from '@/components/Loading'
import {
  FUEL_CATEGORIES,
  LEGISLATION_TRANSITION_YEAR
} from '@/constants/common'
import { numberFormatter } from '@/utils/formatters'
import { copyToClipboard } from '@/utils/clipboard'

const CUSTOM_CI_OPTION_VALUE = 'customCi'
const CARBON_INTENSITY_UNIT = 'gCO₂e/MJ'

export const CreditCalculator = () => {
  const { t } = useTranslation(['report'])
  const ciParameterLabels = useMemo(
    () => t('report:ciParameters', { returnObjects: true }),
    [t]
  )

  const DEFAULT_QUANTITY = 100000

  // Fetch compliance periods from API
  const { data: compliancePeriods, isLoading: isLoadingPeriods } =
    useGetCompliancePeriodList()

  // Transform compliance periods data for select input
  const formattedCompliancePeriods = useMemo(() => {
    if (!compliancePeriods?.data?.length) return []

    return compliancePeriods.data
      .map((period) => ({
        value: period.description,
        label: period.description
      }))
      .filter((period) => {
        const year = parseInt(period.value)
        return year >= LEGISLATION_TRANSITION_YEAR && year <= 2030
      })
      .sort((a, b) => parseInt(b.value) - parseInt(a.value))
  }, [compliancePeriods])

  // Get the most recent compliance period for default value
  const defaultCompliancePeriod = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const isBeforeMarch31 =
      today.getMonth() < 2 || (today.getMonth() === 2 && today.getDate() <= 31)
    const targetYear = isBeforeMarch31 ? currentYear - 1 : currentYear

    if (!formattedCompliancePeriods.length) {
      return targetYear.toString()
    }

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
      fuelType: '',
      fuelCode: '',
      provisionOfTheAct: '',
      quantity: DEFAULT_QUANTITY,
      fuelCategory: '',
      endUseType: '',
      complianceUnits: '',
      customCi: ''
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
  const {
    complianceYear,
    fuelCategory,
    endUseType,
    provisionOfTheAct,
    quantity,
    fuelCode,
    fuelType,
    complianceUnits,
    customCi
  } = watchedValues

  const isCustomCiSelected = provisionOfTheAct === CUSTOM_CI_OPTION_VALUE
  const customCiValue =
    isCustomCiSelected && customCi !== '' ? customCi : undefined

  // State for selected items from lists
  const [calculatedResults, setCalculatedResults] = useState(null)
  const [activeCalculatorMode, setActiveCalculatorMode] = useState('quantity')
  const [syncingField, setSyncingField] = useState(null)
  const syncingFieldRef = useRef(null)
  const calculationDebounceRef = useRef(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const { data: fuelTypeListData, isLoading: isFuelTypeListLoading } =
    useGetFuelTypeList(
      {
        complianceYear,
        fuelCategory,
        lcfsOnly: false
      },
      { enabled: Boolean(fuelCategory) }
    )

  // Get the selected fuel based on user selection
  // Memoized selector options to prevent unnecessary re-renders
  const selectedFuelObj = useMemo(() => {
    return fuelTypeListData?.data?.find((ft) => ft.fuelType === fuelType)
  }, [fuelTypeListData, fuelType])

  const fuelTypes = useMemo(() => {
    return (
      fuelTypeListData?.data?.map((ft) => ({
        label: ft.fuelType,
        value: ft.fuelType
      })) || []
    )
  }, [fuelTypeListData])

  // Fetch fuel supply options based on compliance period
  const { data: fuelTypeOptions, isLoading: isLoadingFuelOptions } =
    useGetFuelTypeOptions(
      {
        complianceYear,
        fuelCategoryId: selectedFuelObj?.fuelCategoryId,
        fuelTypeId: selectedFuelObj?.fuelTypeId,
        lcfsOnly: false
      },
      {
        enabled: Boolean(selectedFuelObj && fuelType && fuelCategory)
      }
    )

  const endUses = useMemo(() => {
    if (!fuelTypeOptions?.data?.eerRatios) return []

    const uniqueEndUses = new Map()
    fuelTypeOptions.data.eerRatios.forEach((eer) => {
      const endUse = eer.endUseType
      if (endUse) {
        uniqueEndUses.set(endUse.type, {
          value: endUse.type,
          label: endUse.type
        })
      }
    })

    return Array.from(uniqueEndUses.values())
  }, [fuelTypeOptions])
  const customCiOption = useMemo(
    () => ({
      label: t('report:customCiOption'),
      value: CUSTOM_CI_OPTION_VALUE
    }),
    [t]
  )

  const provisionOptions = useMemo(() => {
    const options =
      fuelTypeOptions?.data?.provisions?.map((provision) => ({
        label: provision.name,
        value: provision.name
      })) || []

    if (!fuelType) {
      return options
    }

    return [...options, customCiOption]
  }, [fuelTypeOptions, customCiOption, fuelType])

  const baseProvisionOptions = useMemo(() => {
    return provisionOptions.filter(
      (option) => option.value !== CUSTOM_CI_OPTION_VALUE
    )
  }, [provisionOptions])

  const selectedProvision = useMemo(() => {
    if (!provisionOfTheAct) return null
    return fuelTypeOptions?.data?.provisions?.find(
      (provision) => provision.name === provisionOfTheAct
    )
  }, [fuelTypeOptions, provisionOfTheAct])

  // Get unit based on selected fuel
  const unit = useMemo(() => {
    return fuelTypeOptions?.data?.unit || ''
  }, [fuelTypeOptions])

  // Apply fuel type and end use selection to form
  useEffect(() => {
    if (fuelType) {
      setValue('endUseType', '')
      setValue('provisionOfTheAct', '')
      setValue('fuelCode', '')
      setValue('customCi', '')
      setActiveCalculatorMode('quantity')
    }
  }, [fuelType, setValue, fuelCategory])

  useEffect(() => {
    if (endUseType) {
      setValue('provisionOfTheAct', '')
      setValue('fuelCode', '')
      setValue('customCi', '')
      setActiveCalculatorMode('quantity')
    }
  }, [endUseType, setValue])

  useEffect(() => {
    if (endUses.length === 1 && !endUseType) {
      setValue('endUseType', endUses[0].value)
    }
  }, [endUses, endUseType, setValue])

  useEffect(() => {
    if (provisionOfTheAct) {
      setValue('fuelCode', '')
      setValue('customCi', '')
    }
  }, [provisionOfTheAct, setValue])

  useEffect(() => {
    if (baseProvisionOptions.length === 1 && !provisionOfTheAct) {
      setValue('provisionOfTheAct', baseProvisionOptions[0].value)
    }
  }, [baseProvisionOptions, provisionOfTheAct, setValue])

  // Calculate credits when form values change
  const fuelTypeId = selectedFuelObj?.fuelTypeId
  const fuelCategoryId = selectedFuelObj?.fuelCategoryId
  const endUseId = fuelTypeOptions?.data?.eerRatios?.find(
    (e) => e.endUseType?.type === endUseType
  )?.endUseType?.endUseTypeId

  const { data: calculatedData, refetch: refetchCalculatedData } =
    useCalculateComplianceUnits({
      compliancePeriod: complianceYear,
      fuelCategoryId,
      fuelTypeId,
      endUseId,
      quantity: Number(quantity),
      fuelCodeId: fuelTypeOptions?.data?.fuelCodes?.find(
        (f) => f.fuelCode === fuelCode
      )?.fuelCodeId,
      useCustomCi: isCustomCiSelected,
      customCiValue,
      enabled: false
    })

  const {
    data: calculatedQuantityData,
    refetch: refetchCalculatedQuantityData
  } = useCalculateQuantityFromComplianceUnits({
    compliancePeriod: complianceYear,
    fuelCategoryId,
    fuelTypeId,
    endUseId,
    complianceUnits: Number(complianceUnits),
    fuelCodeId: fuelTypeOptions?.data?.fuelCodes?.find(
      (f) => f.fuelCode === fuelCode
    )?.fuelCodeId,
    useCustomCi: isCustomCiSelected,
    customCiValue,
    enabled: false
  })

  useEffect(() => {
    const hasCustomCiValue =
      !isCustomCiSelected || customCi === 0 || Boolean(customCi)

    const hasBaseCriteria =
      Boolean(complianceYear) &&
      Boolean(fuelCategoryId) &&
      Boolean(fuelTypeId) &&
      Boolean(endUseId) &&
      (provisionOfTheAct !== 'Fuel code - section 19 (b) (i)' ||
        Boolean(fuelCode)) &&
      hasCustomCiValue

    const hasQuantityValue = quantity === 0 || Boolean(quantity)
    const hasComplianceUnitsValue =
      complianceUnits === 0 || Boolean(complianceUnits)

    if (!hasBaseCriteria) return

    // Clear any pending debounced calculation
    if (calculationDebounceRef.current) {
      clearTimeout(calculationDebounceRef.current)
    }

    // Debounce the calculation to prevent screen jumping during typing
    calculationDebounceRef.current = setTimeout(() => {
      if (
        activeCalculatorMode === 'quantity' &&
        syncingField !== 'quantity' &&
        hasQuantityValue
      ) {
        refetchCalculatedData()
      }

      if (
        activeCalculatorMode === 'complianceUnits' &&
        syncingField !== 'complianceUnits' &&
        hasComplianceUnitsValue
      ) {
        refetchCalculatedQuantityData()
      }
    }, 300)

    return () => {
      if (calculationDebounceRef.current) {
        clearTimeout(calculationDebounceRef.current)
      }
    }
  }, [
    activeCalculatorMode,
    syncingField,
    complianceYear,
    fuelCategoryId,
    fuelTypeId,
    endUseId,
    quantity,
    complianceUnits,
    provisionOfTheAct,
    fuelCode,
    refetchCalculatedData,
    refetchCalculatedQuantityData,
    customCi,
    isCustomCiSelected
  ])

  useEffect(() => {
    const latestResults =
      activeCalculatorMode === 'complianceUnits'
        ? calculatedQuantityData?.data
        : calculatedData?.data
    // Only update results when we have actual data to prevent showing zeros during recalculation
    if (latestResults) {
      setCalculatedResults(latestResults)
    }
  }, [activeCalculatorMode, calculatedData, calculatedQuantityData])

  // Keep form fields in sync with whichever calculator response is active
  useEffect(() => {
    if (!calculatedResults) return

    if (
      activeCalculatorMode === 'quantity' &&
      calculatedResults.complianceUnits !== undefined
    ) {
      syncingFieldRef.current = 'complianceUnits'
      setSyncingField('complianceUnits')
      setValue('complianceUnits', calculatedResults.complianceUnits, {
        shouldDirty: false,
        shouldTouch: false
      })
    }

    if (
      activeCalculatorMode === 'complianceUnits' &&
      calculatedResults.quantity !== undefined
    ) {
      syncingFieldRef.current = 'quantity'
      setSyncingField('quantity')
      setValue('quantity', calculatedResults.quantity, {
        shouldDirty: false,
        shouldTouch: false
      })
    }
  }, [activeCalculatorMode, calculatedResults, setValue])

  useEffect(() => {
    if (!syncingField) return

    const frame = requestAnimationFrame(() => {
      syncingFieldRef.current = null
      setSyncingField(null)
    })

    return () => cancelAnimationFrame(frame)
  }, [syncingField])

  const provisionDisplayLabel = useMemo(() => {
    if (!provisionOfTheAct) return 'N/A'
    if (provisionOfTheAct === CUSTOM_CI_OPTION_VALUE) {
      return t('report:customCiOption')
    }
    return provisionOfTheAct
  }, [provisionOfTheAct, t])

  // Handle form reset
  const handleClear = () => {
    reset({
      complianceYear: String(defaultCompliancePeriod),
      fuelType: '',
      fuelCode: '',
      provisionOfTheAct: '',
      quantity: DEFAULT_QUANTITY,
      fuelCategory: '',
      endUseType: '',
      complianceUnits: '',
      customCi: ''
    })
    setCalculatedResults(null)
    setActiveCalculatorMode('quantity')
  }

  const handleCopy = async () => {
    try {
      const copyText = `Compliance Year: ${complianceYear}
Selected fuel type: ${fuelType || 'N/A'}
End use: ${endUseType || 'N/A'}
Determining carbon intensity: ${provisionDisplayLabel}
Fuel code: ${fuelCode || 'N/A'}

Quantity supplied: ${quantity?.toLocaleString() || 0} ${unit}

Compliance units = (TCI * EER - (RCI + UCI)) * EC / 1,000,000
${t('report:formulaECDefinition')}

TCI - Target carbon intensity        ${resultData.formulaValues.carbonIntensity}
EER - Energy effectiveness ratio     ${resultData.formulaValues.eer}
RCI - Recorded carbon intensity      ${resultData.formulaValues.ci}  
UCI - Additional carbon intensity    ${resultData.formulaValues.uci}
EC - Energy content                  ${resultData.formulaValues.energyContent}
ED - Energy density                  ${resultData.formulaValues.energyDensity}

${resultData.formulaDisplay}

Credits generated: ${resultData.credits.toLocaleString()}`

      const success = await copyToClipboard(copyText)
      if (success) {
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } else {
        console.error('Failed to copy text to clipboard')
      }
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // Helper function for rendering field errors
  const renderError = (fieldName) => {
    return errors[fieldName] ? (
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
    ) : null
  }

  // Check if fuel code selection should be disabled
  const isFuelCodeDisabled = () => {
    // If provisionOfTheAct is null, undefined, or empty string, disable the field
    if (!provisionOfTheAct) return true

    // Enable only if the provision includes specific text
    return !(
      provisionOfTheAct.includes('Fuel code - section') ||
      provisionOfTheAct.includes('Prescribed carbon intensity') ||
      provisionOfTheAct.includes('Approved fuel code')
    )
  }

  // Extracted result data for display (would come from API response)
  const resultData = useMemo(() => {
    const fallback = {
      credits: 0,
      formulaValues: {
        carbonIntensity: 0,
        eer: 0,
        ci: 0,
        uci: 0,
        energyContent: 0,
        energyDensity: 0
      },
      formulaDisplay: '0 = (0 * 0 - (0 + N/A)) * 0 / 1,000,000'
    }

    if (!calculatedResults) return fallback

    const data = calculatedResults

    return {
      credits: data.complianceUnits || 0,
      formulaValues: {
        carbonIntensity: `${data.tci || 0} ${CARBON_INTENSITY_UNIT}`,
        eer: (data.eer || 0).toFixed(2),
        ci: `${data.rci || 0} ${CARBON_INTENSITY_UNIT}`,
        uci: data.uci ? `${data.uci} ${CARBON_INTENSITY_UNIT}` : 'N/A',
        energyContent: `${numberFormatter(data.energyContent || 0)} MJ`,
        energyDensity: `${data.energyDensity || 0} ${fuelTypeOptions?.data?.energyDensity?.unit?.name || ''}`
      },
      formulaDisplay: `${(data.complianceUnits || 0).toLocaleString()} = (${data.tci || 0} * ${data.eer || 0} - (${data.rci || 0} + ${data.uci || 'N/A'})) * ${numberFormatter(data.energyContent || 0)} / 1,000,000`
    }
  }, [calculatedResults, fuelTypeOptions])

  const carbonIntensityDisplayValue = useMemo(() => {
    if (!provisionOfTheAct) return ''

    const shouldShowCarbonIntensity =
      provisionOfTheAct.includes('Fuel code') ||
      provisionOfTheAct.includes('Default carbon intensity')

    if (!shouldShowCarbonIntensity) return ''

    return resultData.formulaValues.ci || ''
  }, [provisionOfTheAct, resultData])

  if (isLoadingPeriods) {
    return <Loading />
  }

  return (
    <BCBox
      sx={{
        '& .MuiCardContent-root': { padding: '0 !important', margin: 0 },
        '& .MuiFormLabel-root': {
          transform: 'translate(-0px, -32px) scale(1) !important'
        }
      }}
    >
      <FormProvider {...methods}>
        <BCWidgetCard
          component="div"
          title={t('report:calcTitle')}
          content={
            <>
              <Grid container flexDirection={'column'} rowSpacing={1}>
                {/* Top Section */}
                <Grid px={4} py={2} flexDirection={'row'} container spacing={4}>
                  <Stack direction={'column'} size={3} flex={0.5} gap={4}>
                    {/* Compliance Year */}
                    <FormControl>
                      <BCTypography variant="label" component="span">
                        {t('report:complianceYear')}
                      </BCTypography>

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
                              height: '40px'
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
                    {/* Fuel Category */}
                    <BCFormRadio
                      label={t('report:fuelCategory')}
                      name="fuelCategory"
                      control={control}
                      options={FUEL_CATEGORIES.filter(
                        (category) =>
                          (parseInt(complianceYear) <
                            LEGISLATION_TRANSITION_YEAR &&
                            category !== 'Jet fuel') ||
                          parseInt(complianceYear) >=
                            LEGISLATION_TRANSITION_YEAR
                      ).map((type) => ({
                        value: type,
                        label: type
                      }))}
                      orientation="vertical"
                      sx={{ mt: '0 !important' }}
                    />
                  </Stack>
                  {/* <Grid container flexDirection={'row'} rowSpacing={1} mt={4}> */}
                  <Grid size={3} flex={1}>
                    {isFuelTypeListLoading && <Loading />}
                    <BCFormRadio
                      label={t('report:selectFuelType')}
                      name="fuelType"
                      control={control}
                      options={fuelTypes}
                      disabled={isFuelTypeListLoading || fuelTypes.length === 0}
                    />
                  </Grid>

                  <Grid size={3} flex={2}>
                    {isLoadingFuelOptions && <Loading />}
                    <BCFormRadio
                      label={t('report:endUse')}
                      name="endUseType"
                      control={control}
                      options={endUses}
                      disabled={
                        isLoadingFuelOptions || !endUses.length || !fuelType
                      }
                    />
                  </Grid>
                  {/* </Grid> */}

                  <Stack direction="column" spacing={2} size={3} flex={1}>
                    <BCFormRadio
                      label={t('report:ciLabel')}
                      name="provisionOfTheAct"
                      control={control}
                      options={provisionOptions}
                      disabled={
                        isLoadingFuelOptions ||
                        !provisionOptions.length ||
                        (!endUseType &&
                          parseInt(complianceYear) >=
                            LEGISLATION_TRANSITION_YEAR) ||
                        (!fuelType &&
                          parseInt(complianceYear) <
                            LEGISLATION_TRANSITION_YEAR)
                      }
                    />
                    {renderError('provisionOfTheAct')}
                    {/* Fuel Code */}
                    <FormControl>
                      <BCTypography variant="label" component="span">
                        {t('report:fuelCodeLabel')}
                      </BCTypography>

                      <Controller
                        name="fuelCode"
                        control={control}
                        render={({ field }) => (
                          <Select
                            id="fuel-code"
                            labelId="fuel-code-select-label"
                            {...field}
                            error={!!errors.fuelCode}
                            disabled={isFuelCodeDisabled()}
                            displayEmpty
                            MenuProps={{
                              sx: {
                                marginTop: '0 !important'
                              }
                            }}
                            sx={{
                              height: '40px'
                            }}
                          >
                            {fuelTypeOptions?.data?.fuelCodes?.map((code) => (
                              <MenuItem
                                key={code.fuelCodeId}
                                value={code.fuelCode}
                              >
                                {code.fuelCode}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      />
                      {renderError('fuelCode')}
                    </FormControl>
                    <FormControl>
                      <BCTypography variant="label" component="span">
                        Custom CI
                      </BCTypography>
                      <Controller
                        name="customCi"
                        control={control}
                        render={({
                          field: { onChange, onBlur, value, name, ref }
                        }) =>
                          isCustomCiSelected ? (
                            <NumericFormat
                              id="carbon-intensity-input"
                              customInput={TextField}
                              name={name}
                              inputRef={ref}
                              value={value ?? ''}
                              onValueChange={(vals) => {
                                onChange(
                                  typeof vals.floatValue === 'number'
                                    ? Number(vals.floatValue.toFixed(2))
                                    : ''
                                )
                              }}
                              onBlur={onBlur}
                              placeholder="0.00"
                              size="small"
                              sx={{ mt: 1 }}
                              decimalScale={2}
                              fixedDecimalScale
                              allowNegative
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <BCTypography
                                      variant="caption1"
                                      component="span"
                                    >
                                      {CARBON_INTENSITY_UNIT}
                                    </BCTypography>
                                  </InputAdornment>
                                )
                              }}
                              error={!!errors.customCi}
                              helperText={errors.customCi?.message}
                            />
                          ) : (
                            <TextField
                              id="carbon-intensity-display"
                              value={carbonIntensityDisplayValue}
                              placeholder="N/A"
                              size="small"
                              sx={{ mt: 1 }}
                              disabled
                            />
                          )
                        }
                      />
                    </FormControl>
                  </Stack>
                </Grid>

                {/* Bottom Section */}
                <Grid container flexDirection="row">
                  <Stack
                    size={6}
                    flex={1}
                    px={4}
                    gap={4}
                    justifyContent={'center'}
                    sx={{
                      backgroundColor: colors.secondary.nav,
                      color: colors.white.main,
                      textAlign: 'center'
                    }}
                  >
                    {/* Quantity supplied section */}
                    <Stack gap={1}>
                      <BCTypography variant="span" fontWeight="bold">
                        {t('report:qtySuppliedLabel')}
                      </BCTypography>
                      <Controller
                        name="quantity"
                        control={control}
                        render={({
                          field: { onChange, onBlur, value, name, ref }
                        }) => (
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="center"
                            gap={1}
                          >
                            <NumericFormat
                              id="quantity"
                              customInput={TextField}
                              thousandSeparator
                              decimalScale={2}
                              fixedDecimalScale={false}
                              prefix=""
                              value={value}
                              onValueChange={(vals) => {
                                if (syncingFieldRef.current !== 'quantity') {
                                  setActiveCalculatorMode('quantity')
                                }
                                onChange(vals.floatValue)
                              }}
                              onBlur={onBlur}
                              onFocus={() => {
                                if (syncingFieldRef.current !== 'quantity') {
                                  setActiveCalculatorMode('quantity')
                                }
                              }}
                              name={name}
                              inputRef={ref}
                              placeholder={t('report:qtySuppliedLabel')}
                              size="small"
                              error={!!errors.quantity}
                              helperText={errors.quantity?.message}
                              sx={{
                                width: '200px',
                                alignSelf: 'center',
                                '& .MuiInputBase-input': {
                                  fontSize: '1.5rem',
                                  fontWeight: 'bold',
                                  textAlign: 'center'
                                }
                              }}
                              slotProps={{
                                input: {
                                  style: { textAlign: 'left' },
                                  maxLength: 13,
                                  'data-test': 'quantity'
                                }
                              }}
                            />
                            {unit && (
                              <BCTypography
                                variant="body2"
                                component="span"
                                data-test="quantity-unit"
                                data-testid="quantity-unit"
                              >
                                {unit}
                              </BCTypography>
                            )}
                          </Stack>
                        )}
                      />
                    </Stack>
                    {/* compliance units section */}

                    <Stack gap={1}>
                      <BCTypography variant="span" fontWeight="bold">
                        {t('report:quantitySuppliedcu')}
                      </BCTypography>
                      <Controller
                        name="complianceUnits"
                        control={control}
                        render={({
                          field: { onChange, onBlur, value, name, ref }
                        }) => (
                          <NumericFormat
                            id="complianceUnits"
                            customInput={TextField}
                            thousandSeparator
                            fixedDecimalScale={false}
                            prefix=""
                            value={value}
                            onValueChange={(vals) => {
                              if (
                                syncingFieldRef.current !== 'complianceUnits'
                              ) {
                                setActiveCalculatorMode('complianceUnits')
                              }
                              onChange(vals.floatValue)
                            }}
                            onBlur={onBlur}
                            onFocus={() => {
                              if (
                                syncingFieldRef.current !== 'complianceUnits'
                              ) {
                                setActiveCalculatorMode('complianceUnits')
                              }
                            }}
                            name={name}
                            inputRef={ref}
                            placeholder=""
                            size="small"
                            error={!!errors.complianceUnits}
                            helperText={errors.complianceUnits?.message}
                            sx={{
                              width: '200px',
                              alignSelf: 'center',
                              '& .MuiInputBase-input': {
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                textAlign: 'center'
                              }
                            }}
                            slotProps={{
                              input: {
                                style: { textAlign: 'left' },
                                maxLength: 13,
                                'data-test': 'complianceUnits'
                              }
                            }}
                          />
                        )}
                      />
                    </Stack>
                    {/* Formula calculation display */}
                    <BCTypography
                      variant="body2"
                      sx={{
                        textAlign: 'center'
                      }}
                    >
                      {resultData.formulaDisplay}
                    </BCTypography>
                  </Stack>
                  {/* Formula values table */}

                  <Stack
                    size={6}
                    flex={1}
                    px={4}
                    py={8}
                    gap={2}
                    sx={{
                      backgroundColor: 'rgba(218, 218, 218, 0.6)'
                    }}
                  >
                    <BCBox>
                      <BCBox
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'max-content auto',
                          columnGap: 4,
                          rowGap: 1,
                          width: 'fit-content',
                          justifySelf: 'center'
                        }}
                      >
                        {Object.entries(ciParameterLabels).map(
                          ([key, label], index) => (
                            <React.Fragment key={key}>
                              {/* Left column - Label */}
                              <BCTypography
                                variant="body2"
                                sx={{
                                  fontWeight: 'bold',
                                  gridColumn: 1
                                }}
                              >
                                {`${key.toUpperCase()} - ${label}`}:
                              </BCTypography>

                              {/* Right column - Value */}
                              <BCTypography
                                variant="body2"
                                sx={{
                                  gridColumn: 2
                                }}
                              >
                                {Object.values(resultData.formulaValues)[index]}
                              </BCTypography>
                            </React.Fragment>
                          )
                        )}
                      </BCBox>
                    </BCBox>
                    {/* Compliance units formula */}

                    {parseInt(complianceYear) < LEGISLATION_TRANSITION_YEAR ? (
                      <BCTypography
                        variant="body2"
                        sx={{ textAlign: 'center' }}
                      >
                        {t('report:formulaBefore2024')}
                      </BCTypography>
                    ) : (
                      <>
                        <BCTypography
                          variant="body2"
                          sx={{ textAlign: 'center' }}
                        >
                          {t('report:formulaAfter2024')}
                        </BCTypography>
                        <BCTypography
                          variant="body2"
                          sx={{ textAlign: 'center' }}
                        >
                          {t('report:formulaECDefinition')}
                        </BCTypography>
                      </>
                    )}
                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      spacing={2}
                    >
                      <BCButton
                        variant="outlined"
                        color="dark"
                        size="small"
                        onClick={handleClear}
                      >
                        Clear
                      </BCButton>
                      <BCButton
                        variant={copySuccess ? 'contained' : 'outlined'}
                        color={copySuccess ? 'success' : 'dark'}
                        size="small"
                        onClick={handleCopy}
                        startIcon={
                          copySuccess ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="20,6 9,17 4,12"></polyline>
                            </svg>
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              ></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )
                        }
                      >
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </BCButton>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </>
          }
        />
      </FormProvider>
    </BCBox>
  )
}
