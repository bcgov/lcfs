import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { LabelBox } from './LabelBox'
import {
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Grid,
  InputLabel
} from '@mui/material'
import { dateFormatter, numberFormatter } from '@/utils/formatters'
import { useFormContext, Controller } from 'react-hook-form'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import Loading from '@/components/Loading'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'

export const TransactionDetails = ({ transactionId, isEditable }) => {
  const { t } = useTranslation(['txn'])

  const {
    watch,
    register,
    formState: { errors },
    control
  } = useFormContext()

  const { data: orgData } = useOrganizationNames(null)
  const organizations =
    orgData?.map((org) => ({
      value: parseInt(org.organizationId),
      label: org.name || t('common:unknown')
    })) || []

  const currentDate = new Date()
  const maxDate = dateFormatter(currentDate)

  const selectedOrgId = watch('toOrganizationId')
  const { data: orgBalanceInfo } = useOrganizationBalance(selectedOrgId)

  // Fetching organization balance
  const displayBalance = () => {
    if (!orgBalanceInfo) return t('txn:loadingBalance')
    return `${orgBalanceInfo.totalBalance.toLocaleString()} (${Math.abs(
      orgBalanceInfo.reservedBalance
    ).toLocaleString()} ${t('txn:inReserve')})`
  }

  // Render form error messages
  const renderError = (fieldName, sameAsField = null) => {
    // If the sameAsField is provided and is true, hide errors for this field
    if (sameAsField && watch(sameAsField)) {
      return null
    }

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

  if (!orgData || orgData.length === 0) {
    return <Loading message={t('txn:loadingBalance')} />
  }

  return (
    <BCBox mb={4}>
      <LabelBox>
        <BCBox m={1}>
          <Grid container spacing={3}>
            <Grid
              item
              xs={12}
              style={{ display: transactionId ? 'none' : 'block' }}
            >
              <Controller
                name="txnType"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <RadioGroup id="txnType" name="txnType" row {...field}>
                    <FormControlLabel
                      value={INITIATIVE_AGREEMENT}
                      control={
                        <Radio
                          data-test="txn-type-initiative-agreement"
                          disabled={!!transactionId || !isEditable}
                        />
                      }
                      label={
                        <BCTypography variant="body3">
                          {t('txn:initiativeAgreement')}
                        </BCTypography>
                      }
                      sx={{ alignItems: 'center', marginRight: 8 }}
                    />
                    <FormControlLabel
                      value={ADMIN_ADJUSTMENT}
                      control={
                        <Radio
                          data-test="txn-type-administrative-adjustment"
                          disabled={!!transactionId || !isEditable}
                        />
                      }
                      label={
                        <BCTypography variant="body3">
                          {t('txn:administrativeAdjustment')}
                        </BCTypography>
                      }
                      sx={{ alignItems: 'center' }}
                    />
                  </RadioGroup>
                )}
              />
              {renderError('txnType')}
            </Grid>

            <Grid item lg={4} md={7} xs={12}>
              <BCBox mb={1} mt={-1}>
                <BCTypography variant="body3">
                  {t('txn:organization')}
                </BCTypography>
              </BCBox>
              <FormControl
                sx={{
                  width: '100%',
                  height: '46px',
                  '.MuiOutlinedInput-root': {
                    height: '100%'
                  },
                  '& .Mui-error': {
                    height: '100%'
                  },
                  bottom: '0.09rem',
                  marginInline: '0.2rem'
                }}
              >
                <Controller
                  name="toOrganizationId"
                  control={control}
                  displayEmpty
                  render={({ field }) => (
                    <Select
                      id="to-organization-id"
                      labelId="organization-select-label"
                      {...field}
                      error={!!errors.toOrganizationId}
                      // helperText={errors.toOrganizationId?.message}
                      displayEmpty
                      disabled={!isEditable}
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
                      renderValue={(selected) => {
                        if (selected === '') {
                          return <em>{t('txn:selectOrgLabel')}</em>
                        }
                        const selectedOrg = organizations.find(
                          (org) => org.value === selected
                        )
                        return selectedOrg ? (
                          selectedOrg.label
                        ) : (
                          <em>{t('txn:selectOrgLabel')}</em>
                        )
                      }}
                    >
                      <MenuItem value="">
                        <em>{t('txn:selectOrgLabel')}</em>
                      </MenuItem>
                      {organizations.map((org, index) => (
                        <MenuItem key={index} value={org.value}>
                          {org.label}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                {renderError('toOrganizationId')}
              </FormControl>
              {selectedOrgId && (
                <BCBox mt={2}>
                  <BCTypography variant="body2">
                    {t('txn:complianceBalance')} {displayBalance()}
                  </BCTypography>
                </BCBox>
              )}
            </Grid>

            <Grid item lg={8} md={12} xs={12}>
              <BCBox>
                <InputLabel htmlFor="complianceUnits" sx={{ pb: 1 }}>
                  <BCTypography
                    variant="body3"
                    dangerouslySetInnerHTML={{
                      __html: t('txn:complianceUnits')
                    }}
                  ></BCTypography>
                </InputLabel>
                <Controller
                  name="complianceUnits"
                  control={control}
                  render={({ field: { onChange, value, ...fieldProps } }) => {
                    // Format the value with commas for display
                    const formattedValue = numberFormatter(value || '')
                    return (
                      <TextField
                        {...fieldProps}
                        data-test="compliance-units"
                        type="text"
                        disabled={!isEditable}
                        error={!!errors.complianceUnits}
                        helperText={errors.complianceUnits?.message}
                        value={formattedValue}
                        onChange={(e) => {
                          // Remove all non-digit characters (other than - at the front)
                          const numericValue = e.target.value.replace(
                            /(?!^-)[^0-9]/g,
                            ''
                          )
                          // Update the form state with the raw number
                          onChange(numericValue)
                        }}
                      />
                    )
                  }}
                />
              </BCBox>
            </Grid>
          </Grid>
        </BCBox>

        <BCBox sx={{ bgcolor: '#f2f2f2' }} p={3} m={1} mt={4}>
          <Grid container>
            <Grid item lg={12}>
              <BCBox>
                <InputLabel htmlFor="txnEffectiveDate" sx={{ pb: 1 }}>
                  <BCTypography
                    variant="body3"
                    dangerouslySetInnerHTML={{ __html: t('txn:effectiveDate') }}
                  ></BCTypography>
                </InputLabel>
                <TextField
                  id="txnEffectiveDate"
                  data-test="txn-effective-date"
                  {...register('transactionEffectiveDate')}
                  type="date"
                  defaultValue={null}
                  disabled={!isEditable}
                  inputProps={{
                    max: maxDate,
                    'data-testid': 'txn-effective-date-input'
                  }}
                  size="small"
                  error={!!errors.transactionEffectiveDate}
                  helperText={
                    errors.transactionEffectiveDate
                      ? errors.transactionEffectiveDate.message
                      : ''
                  }
                />
              </BCBox>
            </Grid>
          </Grid>
        </BCBox>
      </LabelBox>
    </BCBox>
  )
}
