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

export const CreditCalculator = () => {
  const { t } = useTranslation(['report'])
  const ciParameterLabels = useMemo(
    () => t('report:ciParameters', { returnObjects: true }),
    [t]
  )
  const fuelRequirementOptions = useMemo(() => {
    const arr = t('report:fuelRequirementOptions', { returnObjects: true })
    if (!Array.isArray(arr)) return []

    return arr.map((option) => ({
      value: option,
      label: option
    }))
  }, [t])
  const { data: orgBalance } = useCurrentOrgBalance()
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
      fuelRequirement:
        fuelRequirementOptions.length > 0
          ? fuelRequirementOptions[0].value
          : '',
      fuelType: '',
      fuelCode: '',
      provisionOfTheAct: 0,
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
  const complianceYear = watchedValues.complianceYear
  const fuelCategory = watchedValues.fuelCategory
  const fuelRequirement = watchedValues.fuelRequirement
  const endUseType = watchedValues.endUseType
  const provisionOfTheAct = watchedValues.provisionOfTheAct

  // State for selected items from lists
  const [selectedFuelType, setSelectedFuelType] = useState()
  const [selectedEndUse, setSelectedEndUse] = useState()
  const [calculatedResults, setCalculatedResults] = useState(null)

  const { data: fuelTypeListData, isLoading: isFuelTypeListLoading } =
    useGetFuelTypeList(
      {
        complianceYear,
        fuelCategory,
        lcfsOnly: fuelRequirement === 'Low carbon fuel requirement only'
      },
      { enabled: !!fuelCategory }
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
      })) ?? []
    )
  }, [fuelTypeListData])

  // Fetch fuel supply options based on compliance period
  const {
    data: fuelTypeOptions,
    isLoading: isLoadingFuelOptions,
    error
  } = useGetFuelTypeOptions(
    {
      complianceYear,
      fuelCategoryId: selectedFuelObj?.fuelCategoryId,
      fuelTypeId: selectedFuelObj?.fuelTypeId,
      lcfsOnly: fuelRequirement === 'Low carbon fuel requirement only'
    },
    {
      enabled:
        !!selectedFuelObj &&
        !!selectedFuelType &&
        !!fuelCategory &&
        !!selectedFuel
    }
  )

  const endUses = useMemo(() => {
    const uniqueEndUses = new Map()
    fuelTypeOptions?.data?.eerRatios?.forEach((eer) => {
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
      : undefined
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

  // Calculate credits when form values change
  const fuelTypeId = selectedFuelObj?.fuelTypeId
  const fuelCategoryId = selectedFuelObj?.fuelCategoryId
  const endUseId = fuelTypeOptions?.data?.eerRatios?.find(
    (e) => e.endUseType?.type === endUseType
  )?.endUseType?.endUseTypeId

  const {
    data: calculatedData,
    isFetching: isCalculating,
    error: calcError
  } = useCalculateComplianceUnits({
    compliancePeriod: complianceYear,
    fuelCategoryId,
    fuelTypeId,
    endUseId,
    quantity: Number(watchedValues.quantity),
    fuelCodeId: fuelTypeOptions?.data?.fuelCodes?.find(
      (f) => f.fuelCode === watchedValues.fuelCode
    )?.fuelCodeId,
    enabled:
      !!complianceYear &&
      !!fuelCategoryId &&
      !!fuelTypeId &&
      !!endUseId &&
      !!watchedValues.quantity &&
      (watchedValues.provisionOfTheAct !== 'Fuel code - section 19 (b) (i)' ||
        !!watchedValues.fuelCode)
  })

  // Handle form reset
  const handleClear = () => {
    reset({
      complianceYear: String(defaultCompliancePeriod),
      fuelRequirement:
        fuelRequirementOptions.length > 0
          ? fuelRequirementOptions[0].value
          : '',
      fuelType: undefined,
      fuelCode: undefined,
      provisionOfTheAct: undefined,
      quantity: 0,
      fuelCategory: '',
      endUseType: undefined
    })
    setSelectedFuelType()
    setSelectedEndUse()
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

    return {
      credits: calculatedData?.data.complianceUnits ?? 0,
      availableUnits: numberFormatter(
        orgBalance?.totalBalance + calculatedData?.data.complianceUnits
      ),
      previousUnits: numberFormatter(orgBalance?.totalBalance ?? 0),
      formulaValues: {
        carbonIntensity: calculatedData?.data.tci ?? 0,
        eer: calculatedData?.data.eer.toFixed(2) ?? 0,
        ci: calculatedData?.data.rci ?? 0,
        uci: calculatedData?.data.uci ?? 0,
        energyContent: numberFormatter(calculatedData?.data.energyContent ?? 0),
        energyDensity: `${calculatedData?.data.energyDensity ?? 0} ${fuelTypeOptions?.data?.energyDensity?.unit?.name}`
      },
      formulaDisplay: `${(calculatedData?.data.complianceUnits ?? 0).toLocaleString()} = (${calculatedData?.data.tci ?? 0} * ${calculatedData?.data.eer ?? 0} - (${calculatedData?.data.rci ?? 0} + ${calculatedData?.data.uci || 'N/A'})) * ${numberFormatter(calculatedData?.data.energyContent ?? 0)} / 1,000,000`
    }
  }, [calculatedData?.data, fuelTypeOptions?.data?.energyDensity?.unit?.name])

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
              <Grid size={{ sm: 12, md: 6 }} p={2}>
                <BCTypography variant="h6" pb={8} color="primary">
                  {t('report:fuelType')}
                </BCTypography>
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
                  {/* fuel requirement type selection */}
                  {fuelRequirementOptions.length > 0 && (
                    <BCFormRadio
                      name="fuelRequirement"
                      control={control}
                      options={fuelRequirementOptions}
                      sx={{
                        backgroundColor: colors.background.grey,
                        padding: 1,
                        pb: 2,
                        maxWidth: '32rem',
                        transform: 'translate(0px, -16px) scale(1)'
                      }}
                    />
                  )}
                </Stack>
                <Grid container spacing={1}>
                  <Divider
                    orientation="horizontal"
                    sx={{ maxWidth: '18rem', borderColor: 'rgba(0,0,0,1)' }}
                  />
                  {/* Fuel Category */}
                  <BCFormRadio
                    name="fuelCategory"
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
                    {/* Fuel type */}
                    <List
                      component="nav"
                      sx={{
                        maxWidth: '100%',
                        pl: 2
                      }}
                    >
                      {isFuelTypeListLoading && <Loading />}
                      {fuelTypes?.length > 0 &&
                        fuelTypes?.map(({ label, value }) => (
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

                  <Grid size={8}>
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
                      {endUses &&
                        endUses?.map((use) => (
                          <ListItemButton
                            component="span"
                            key={use.value}
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
                              className={
                                selectedEndUse === use.value ? 'selected' : ''
                              }
                              alignItems="flex-start"
                              onClick={() => setSelectedEndUse(use.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedEndUse(use.value)
                                }
                              }}
                              data-test={use.value}
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
                                {use.value}
                              </BCTypography>
                            </BCBox>
                          </ListItemButton>
                        ))}
                    </List>
                  </Grid>
                </Grid>

                <Stack
                  direction="row"
                  spacing={2}
                  mt={2}
                  sx={{
                    justifyContent: 'flex-start',
                    position: 'absolute',
                    bottom: 30,
                    left: 30
                  }}
                >
                  {/* Clear button */}
                  <BCButton
                    variant="outlined"
                    color="primary"
                    onClick={handleClear}
                  >
                    Clear
                  </BCButton>
                </Stack>
              </Grid>

              {/* Right Section */}
              <Grid
                size={{ sm: 12, md: 6 }}
                sx={{ m: 0, pt: 2, backgroundColor: colors.background.grey }}
              >
                <Stack direction={'row'} spacing={4} m={4} mb={0} ml={10}>
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
                          disabled={!endUseType}
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
                          disabled={
                            !endUseType ||
                            provisionOfTheAct !==
                              'Fuel code - section 19 (b) (i)'
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

                <BCBox
                  sx={{
                    m: '0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto',
                    maxWidth: '12rem',
                    transform: 'translate(0px, 24px) scale(1) !important'
                  }}
                >
                  {/* quantity */}
                  <InputLabel
                    htmlFor="quantity"
                    sx={{
                      pb: 1,
                      maxWidth: '240px'
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
                        color: '#313132',
                        transform: 'translate(0px, 24px) scale(1) !important'
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
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <BCTypography variant="subtitle2">
                                  {unit}
                                </BCTypography>
                              </InputAdornment>
                            ),
                            style: { textAlign: 'left' },
                            maxLength: 13,
                            'data-test': 'quantity'
                          }
                        }}
                      />
                    )}
                  />
                </BCBox>

                <BCTypography
                  variant="body3"
                  sx={{
                    mt: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mx: 'auto'
                  }}
                  fontWeight="bold"
                >
                  {parseInt(complianceYear) < LEGISLATION_TRANSITION_YEAR
                    ? t('report:formulaBefore2024')
                    : t('report:formulaAfter2024')}
                </BCTypography>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mt: 2,
                    width: '65%',
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
                      minWidth: 110,
                      minHeight: 110,
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
                {orgBalance && (
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
