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
import {
  useCalculateComplianceUnits,
  useGetCompliancePeriodList,
  useGetFuelTypeList,
  useGetFuelTypeOptions
} from '@/hooks/useCalculator'
import Loading from '@/components/Loading'
import {
  FUEL_CATEGORIES,
  LEGISLATION_TRANSITION_YEAR
} from '@/constants/common'
import { numberFormatter } from '@/utils/formatters'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const CreditCalculator = () => {
  const { t } = useTranslation(['report'])
  const ciParameterLabels = useMemo(
    () => t('report:ciParameters', { returnObjects: true }),
    [t]
  )
  const fuelRequirementOptions = useMemo(() => {
    const arr = t('report:fuelRequirementOptions', { returnObjects: true })
    return Array.isArray(arr)
      ? arr.map((option) => ({ value: option, label: option }))
      : []
  }, [t])

  const { data: currentUser } = useCurrentUser()

  // Only fetch organization balance if user has an organization
  const { data: orgBalance } = useCurrentOrgBalance({
    enabled: !!currentUser?.organization?.organizationId
  })

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
        return year >= 2019 && year <= 2030
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
      fuelRequirement: fuelRequirementOptions[0]?.value || '',
      fuelType: '',
      fuelCode: '',
      provisionOfTheAct: '',
      quantity: 0,
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
  const {
    complianceYear,
    fuelCategory,
    fuelRequirement,
    endUseType,
    provisionOfTheAct,
    quantity,
    fuelCode
  } = watchedValues

  // State for selected items from lists
  const [selectedFuelType, setSelectedFuelType] = useState()
  const [selectedEndUse, setSelectedEndUse] = useState()
  const [calculatedResults, setCalculatedResults] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const { data: fuelTypeListData, isLoading: isFuelTypeListLoading } =
    useGetFuelTypeList(
      {
        complianceYear,
        fuelCategory,
        lcfsOnly: fuelRequirement === 'Low carbon fuel requirement only'
      },
      { enabled: Boolean(fuelCategory) }
    )

  // Get the selected fuel based on user selection
  const selectedFuel = useMemo(() => {
    return fuelTypeListData?.data?.find(
      (ft) => ft.fuelType === watchedValues.fuelType
    )
  }, [fuelTypeListData, watchedValues.fuelType])

  // Memoized selector options to prevent unnecessary re-renders
  const selectedFuelObj = useMemo(() => {
    return fuelTypeListData?.data?.find(
      (ft) => ft.fuelType === selectedFuelType
    )
  }, [fuelTypeListData, selectedFuelType])

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
        lcfsOnly: fuelRequirement === 'Low carbon fuel requirement only'
      },
      {
        enabled: Boolean(
          selectedFuelObj && selectedFuelType && fuelCategory && selectedFuel
        )
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

  // Get unit based on selected fuel
  const unit = useMemo(() => {
    return fuelTypeOptions?.data?.unit || ''
  }, [fuelTypeOptions])

  // Apply fuel type and end use selection to form
  useEffect(() => {
    if (selectedFuelType) {
      setValue('fuelType', selectedFuelType)
      // Clear dependent fields
      setValue('endUseType', '')
      setValue('provisionOfTheAct', '')
      setValue('fuelCode', '')
      setValue('quantity', 0)
      setSelectedEndUse(undefined)
    }
  }, [selectedFuelType, setValue, fuelCategory])

  useEffect(() => {
    if (selectedEndUse) {
      setValue('endUseType', selectedEndUse)
      setValue('provisionOfTheAct', '')
      setValue('fuelCode', '')
      setValue('quantity', 0)
    }
  }, [selectedEndUse, setValue])

  useEffect(() => {
    if (provisionOfTheAct) {
      setValue('fuelCode', '')
    }
  }, [provisionOfTheAct, setValue])

  // Calculate credits when form values change
  const fuelTypeId = selectedFuelObj?.fuelTypeId
  const fuelCategoryId = selectedFuelObj?.fuelCategoryId
  const endUseId = fuelTypeOptions?.data?.eerRatios?.find(
    (e) => e.endUseType?.type === endUseType
  )?.endUseType?.endUseTypeId

  const { data: calculatedData } = useCalculateComplianceUnits({
    compliancePeriod: complianceYear,
    fuelCategoryId,
    fuelTypeId,
    endUseId,
    quantity: Number(quantity),
    fuelCodeId: fuelTypeOptions?.data?.fuelCodes?.find(
      (f) => f.fuelCode === fuelCode
    )?.fuelCodeId,
    enabled:
      Boolean(complianceYear) &&
      Boolean(fuelCategoryId) &&
      Boolean(fuelTypeId) &&
      Boolean(endUseId) &&
      Boolean(quantity) &&
      (provisionOfTheAct !== 'Fuel code - section 19 (b) (i)' ||
        Boolean(fuelCode))
  })

  // Handle form reset
  const handleClear = () => {
    reset({
      complianceYear: String(defaultCompliancePeriod),
      fuelRequirement: fuelRequirementOptions[0]?.value || '',
      fuelType: '',
      fuelCode: '',
      provisionOfTheAct: '',
      quantity: 0,
      fuelCategory: '',
      endUseType: ''
    })
    setSelectedFuelType(undefined)
    setSelectedEndUse(undefined)
    setCalculatedResults(null)
  }

  const handleCopy = async () => {
    try {
      const copyText = `Compliance Year: ${complianceYear}
Selected fuel type: ${selectedFuelType || 'N/A'}
End use: ${selectedEndUse || 'N/A'}
Determining carbon intensity: ${provisionOfTheAct || 'N/A'}
Fuel code: ${fuelCode || 'N/A'}

Quantity supplied: ${quantity?.toLocaleString() || 0} ${unit}

Compliance units = (TCI * EER - (RCI + UCI)) * EC / 1,000,000
${t('report:formulaECDefinition')}

TCI - Target carbon intensity        ${resultData.formulaValues.carbonIntensity}
EER - Energy effectiveness ratio     ${resultData.formulaValues.eer}
RCI - Recorded carbon intensity      ${resultData.formulaValues.ci}  
UCI - Additional carbon intensity    ${resultData.formulaValues.uci || '0'}
EC - Energy content                  ${resultData.formulaValues.energyContent}
ED - Energy density                  ${resultData.formulaValues.energyDensity}

${resultData.formulaDisplay}

Credits generated: ${resultData.credits.toLocaleString()}`

      await navigator.clipboard.writeText(copyText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
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
      availableUnits: 0,
      previousUnits: 0,
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

    if (!calculatedData?.data) return fallback

    const data = calculatedData.data
    const totalBalance = orgBalance?.totalBalance || 0

    return {
      credits: data.complianceUnits || 0,
      availableUnits: numberFormatter(totalBalance + data.complianceUnits),
      previousUnits: numberFormatter(totalBalance),
      formulaValues: {
        carbonIntensity: data.tci || 0,
        eer: (data.eer || 0).toFixed(2),
        ci: data.rci || 0,
        uci: data.uci || 0,
        energyContent: numberFormatter(data.energyContent || 0),
        energyDensity: `${data.energyDensity || 0} ${fuelTypeOptions?.data?.energyDensity?.unit?.name || ''}`
      },
      formulaDisplay: `${(data.complianceUnits || 0).toLocaleString()} = (${data.tci || 0} * ${data.eer || 0} - (${data.rci || 0} + ${data.uci || 'N/A'})) * ${numberFormatter(data.energyContent || 0)} / 1,000,000`
    }
  }, [calculatedData, fuelTypeOptions, orgBalance])

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
            <Grid container flexDirection={'row'} rowSpacing={1}>
              {/* Left Section */}
              <Grid size={{ sm: 12, md: 6 }} px={4} py={8}>
                <Stack direction={'row'} spacing={4}>
                  {/* Compliance Year */}
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
                  {/* Fuel Category */}
                  <BCFormRadio
                    name="fuelCategory"
                    control={control}
                    options={FUEL_CATEGORIES.filter(
                      (category) =>
                        (parseInt(complianceYear) <
                          LEGISLATION_TRANSITION_YEAR &&
                          category !== 'Jet fuel') ||
                        parseInt(complianceYear) >= LEGISLATION_TRANSITION_YEAR
                    ).map((type) => ({
                      value: type,
                      label: type
                    }))}
                    orientation="horizontal"
                    sx={{
                      backgroundColor: 'transparent',
                      padding: 0,
                      pb: 1,
                      transform: 'translate(0px, -5px) scale(1)',
                      borderTop: '1px solid rgba(0,0,0,0.9)',
                      borderBottom: '1px solid rgba(0,0,0,0.9)'
                    }}
                  />
                </Stack>
                <Grid container flexDirection={'row'} rowSpacing={1} mt={4}>
                  <Grid size={4}>
                    <BCTypography variant="h6" color="primary">
                      {t('report:selectFuelType')}
                    </BCTypography>
                    {/* Fuel type */}
                    <List
                      component="nav"
                      sx={{
                        maxWidth: '100%',
                        pl: 2
                      }}
                    >
                      {isFuelTypeListLoading && <Loading />}
                      {fuelTypes.length > 0 &&
                        fuelTypes.map(({ label, value }) => (
                          <ListItemButton
                            component="span"
                            key={value}
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
                                selectedFuelType === value ? 'selected' : ''
                              }
                              alignItems="flex-start"
                              onClick={() => setSelectedFuelType(value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedFuelType(value)
                                }
                              }}
                              data-test={value}
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
                                {value}
                              </BCTypography>
                            </BCBox>
                          </ListItemButton>
                        ))}
                    </List>
                  </Grid>

                  <Grid size={4}>
                    <BCTypography variant="h6" color="primary">
                      {t('report:endUse')}
                    </BCTypography>
                    {/* End Use Type */}
                    <List
                      component="nav"
                      sx={{
                        pl: 2
                      }}
                    >
                      {isLoadingFuelOptions && <Loading />}
                      {endUses.length > 0 &&
                        endUses.map(({ label, value }) => (
                          <ListItemButton
                            component="span"
                            key={value}
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
                                selectedEndUse === value ? 'selected' : ''
                              }
                              alignItems="flex-start"
                              onClick={() => setSelectedEndUse(value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedEndUse(value)
                                }
                              }}
                              data-test={value}
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
                                {value}
                              </BCTypography>
                            </BCBox>
                          </ListItemButton>
                        ))}
                    </List>
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={2} sx={{ mt: 10, mb: 2 }}>
                  {/* Provision of the act */}
                  <FormControl
                    sx={{
                      width: '28rem',
                      height: '2.5rem',
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
                      htmlFor="provision-of-the-act"
                      component="label"
                      className="form-label"
                      shrink
                    >
                      <BCTypography variant="label" component="span">
                        {t('report:ciLabel')}
                      </BCTypography>
                    </InputLabel>
                    <Controller
                      name="provisionOfTheAct"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="provision-of-the-act"
                          labelId="provision-of-the-act-select-label"
                          {...field}
                          error={!!errors.provisionOfTheAct}
                          disabled={
                            (!endUseType &&
                              parseInt(complianceYear) >=
                                LEGISLATION_TRANSITION_YEAR) ||
                            (!selectedFuelType &&
                              parseInt(complianceYear) <
                                LEGISLATION_TRANSITION_YEAR)
                          }
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
                          {fuelTypeOptions?.data?.provisions?.map(
                            (provision) => (
                              <MenuItem
                                key={provision.provisionOfTheActId}
                                value={provision.name}
                              >
                                {provision.name}
                              </MenuItem>
                            )
                          )}
                        </Select>
                      )}
                    />
                    {renderError('provisionOfTheAct')}
                  </FormControl>
                  {/* Fuel Code */}
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
                          disabled={isFuelCodeDisabled()}
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
                </Stack>

                <Stack
                  direction="row"
                  spacing={2}
                  mt={2}
                  sx={{
                    justifyContent: 'flex-start',
                    position: 'absolute',
                    bottom: 30,
                    left: 30,
                    alignItems: 'center'
                  }}
                >
                  <BCButton
                    variant="outlined"
                    color="primary"
                    onClick={handleClear}
                  >
                    Clear
                  </BCButton>

                  {/* fuel requirement type selection */}
                  {fuelRequirementOptions.length > 0 && (
                    <BCFormRadio
                      name="fuelRequirement"
                      control={control}
                      options={fuelRequirementOptions}
                      sx={{
                        padding: 1,
                        pb: 2,
                        maxWidth: '32rem'
                      }}
                    />
                  )}
                </Stack>
              </Grid>

              {/* Right Section */}
              <Grid
                size={{ sm: 12, md: 6 }}
                sx={{
                  m: 0,
                  pt: 2,
                  backgroundColor: 'rgba(218, 218, 218, 0.6)'
                }}
              >
                {/* Copy button */}
                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  sx={{ p: 2, pb: 1 }}
                >
                  <BCButton
                    variant={copySuccess ? 'contained' : 'outlined'}
                    color={copySuccess ? 'success' : 'primary'}
                    size="small"
                    onClick={handleCopy}
                    sx={{
                      minWidth: '80px',
                      px: 2,
                      py: 1,
                      fontWeight: 'bold',
                      borderWidth: '2px',
                      '&:hover': {
                        borderWidth: '2px',
                        backgroundColor: copySuccess
                          ? undefined
                          : 'primary.light',
                        color: copySuccess ? undefined : 'white'
                      },
                      '& .MuiButton-startIcon': { mr: 1 },
                      boxShadow: copySuccess ? 2 : 1,
                      transition: 'all 0.3s ease'
                    }}
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

                {/* Quantity supplied section */}
                <BCBox sx={{ textAlign: 'center', py: 2 }}>
                  <BCTypography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>
                    {t('report:qtySuppliedLabel')}
                  </BCTypography>
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
                          '& .MuiInputBase-input': {
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            width: '200px'
                          }
                        }}
                        slotProps={{
                          input: {
                            endAdornment: unit ? (
                              <InputAdornment position="end">
                                <BCTypography variant="h5">{unit}</BCTypography>
                              </InputAdornment>
                            ) : null,
                            style: { textAlign: 'left' },
                            maxLength: 13,
                            'data-test': 'quantity'
                          }
                        }}
                      />
                    )}
                  />
                </BCBox>

                {/* Compliance units formula */}
                <BCBox sx={{ textAlign: 'center', mb: 2 }}>
                  {parseInt(complianceYear) < LEGISLATION_TRANSITION_YEAR ? (
                    <BCTypography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {t('report:formulaBefore2024')}
                    </BCTypography>
                  ) : (
                    <BCBox sx={{ display: 'inline-block', textAlign: 'left' }}>
                      <BCTypography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {t('report:formulaAfter2024')}
                      </BCTypography>
                      <BCTypography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {t('report:formulaECDefinition')}
                      </BCTypography>
                    </BCBox>
                  )}
                </BCBox>

                {/* Formula values table */}
                <Paper
                  variant="outlined"
                  sx={{
                    mx: 3,
                    backgroundColor: '#f2f2f2',
                    borderRadius: '15px',
                    p: 2,
                    mb: 2
                  }}
                >
                  <Stack
                    direction="row"
                    divider={
                      <Divider
                        orientation="vertical"
                        flexItem
                        sx={{
                          borderColor: '#8c8c8c',
                          my: 2,
                          borderRightWidth: 2
                        }}
                      />
                    }
                  >
                    {/* Left column - Labels */}
                    <BCBox sx={{ flex: 2, p: 2 }}>
                      {Object.entries(ciParameterLabels).map(([key, label]) => (
                        <BCTypography
                          key={key}
                          variant="body2"
                          sx={{ py: 0.5, fontWeight: 'bold' }}
                        >
                          {`${key.toUpperCase()} - ${label}`}
                        </BCTypography>
                      ))}
                    </BCBox>

                    {/* Right column - Values */}
                    <BCBox sx={{ flex: 1, p: 2 }}>
                      {Object.values(resultData.formulaValues).map(
                        (value, index) => (
                          <BCTypography
                            key={index}
                            variant="body2"
                            sx={{
                              py: 0.5,
                              fontWeight: 'bold',
                              textAlign: 'right'
                            }}
                          >
                            {value}
                          </BCTypography>
                        )
                      )}
                    </BCBox>
                  </Stack>
                </Paper>

                {/* Formula calculation display */}
                <BCTypography
                  variant="body2"
                  sx={{
                    textAlign: 'center',
                    mb: 3,
                    px: 2
                  }}
                >
                  {resultData.formulaDisplay}
                </BCTypography>

                {/* Credits generated section */}
                <BCBox
                  sx={{
                    backgroundColor: '#38598a',
                    color: colors.white.main,
                    textAlign: 'center',
                    py: 3
                  }}
                >
                  <BCTypography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                    {t('report:generatedLabel')}
                  </BCTypography>
                  <BCBox
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      backgroundColor: colors.white.main,
                      color: colors.text.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <BCTypography variant="h4" fontWeight="bold">
                      {resultData.credits.toLocaleString()}
                    </BCTypography>
                  </BCBox>
                </BCBox>

                {/* Organization balance section */}
                {orgBalance && (
                  <Stack
                    component="div"
                    sx={{
                      backgroundColor: colors.primary.light,
                      width: '100%',
                      height: '8rem',
                      p: 3,
                      borderBottomRightRadius: '10px',
                      borderTop: '1px solid rgba(255,255,255,0.5)'
                    }}
                    color={colors.white.main}
                    spacing={1}
                  >
                    <BCTypography align="center" variant="h6" fontWeight="bold">
                      {t('report:changeInUnits')}
                    </BCTypography>
                    <BCTypography align="center" variant="h3">
                      {resultData.previousUnits.toLocaleString()}{' '}
                      {resultData.credits > 0 ? '+' : '-'}{' '}
                      {Math.abs(resultData.credits).toLocaleString()} ={' '}
                      {resultData.availableUnits.toLocaleString()}
                    </BCTypography>
                  </Stack>
                )}
              </Grid>
            </Grid>
          }
        />
      </FormProvider>
    </BCBox>
  )
}
