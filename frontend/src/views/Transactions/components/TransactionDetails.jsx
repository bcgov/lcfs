import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
} from '@mui/material';
import { dateFormatter } from '@/utils/formatters'
import { useFormContext, Controller } from 'react-hook-form'
import { useRegExtOrgs, useOrganizationBalance } from '@/hooks/useOrganization'

export const TransactionDetails = () => {
  const { t } = useTranslation(['txn']);
  
  const {
    watch,
    register,
    formState: { errors }
  } = useFormContext()

  const { data: orgData } = useRegExtOrgs()
  const organizations =
    orgData?.map((org) => ({
      value: parseInt(org.organizationId),
      label: org.name || t('common:unknown')
    })) || []

  const currentDate = new Date()
  const maxDate = dateFormatter(currentDate)

  const selectedOrgId = watch('organizationId');
  const { data: orgBalanceInfo } = useOrganizationBalance(selectedOrgId);

  // Fetching organizartion balance
  const displayBalance = () => {
    if (!orgBalanceInfo) return t('txn:loadingBalance');
    return `${orgBalanceInfo.totalBalance.toLocaleString()} (${orgBalanceInfo.reservedBalance.toLocaleString()} ${t('txn:inReserve')})`;
  };

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

  return (
    <BCBox mb={4}>
      <LabelBox>
        <BCBox m={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Controller
                name="txnType"
                defaultValue=""
                render={({ field }) => (
                  <RadioGroup
                    id="txnType"
                    name="txnType"
                    row
                    {...field}
                  >
                    <FormControlLabel
                      value="initiativeAgreement"
                      control={
                        <Radio data-test="txn-type-initiative-agreement" />
                      }
                      label={
                        <BCTypography variant="body3">
                          {t('txn:initiativeAgreement')}
                        </BCTypography>
                      }
                      sx={{ marginRight: 4 }}
                    />
                    <FormControlLabel
                      value="administrativeAdjustment"
                      control={
                        <Radio data-test="txn-type-administrative-adjustment" />
                      }
                      label={
                        <BCTypography variant="body3">
                          {t('txn:administrativeAdjustment')}
                        </BCTypography>
                      }
                    />
                  </RadioGroup>
                )}
              >
              </Controller>
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
                  name="organizationId"
                  // control={control} // Note: control needs to be passed down from the parent component
                  displayEmpty
                  render={({ field }) => (
                    <Select
                      id="organization-id"
                      labelId="organization-select-label"
                      {...field}
                      error={!!errors.toOrganizationId}
                      helperText={errors.toOrganizationId?.message}
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
                {renderError('organizationId')}
              </FormControl>
              {selectedOrgId && (
                <BCBox mt={2}>
                  <BCTypography variant="body2">
                    {t('txn:complianceBalance')}: {displayBalance()}
                  </BCTypography>
                </BCBox>
              )}
            </Grid>

            <Grid item lg={8} md={12} xs={12}>
              <BCBox>
                <InputLabel htmlFor="complianceUnits" sx={{ pb: 1 }}>
                  <BCTypography variant="body3" dangerouslySetInnerHTML={{ __html:t('txn:complianceUnits')}}></BCTypography>
                </InputLabel>
                <TextField
                  data-test="compliance-units"
                  {...register('complianceUnits')}
                  type="text"
                  error={!!errors.complianceUnits}
                  helperText={errors.complianceUnits?.message}
                />
              </BCBox>
            </Grid>
          </Grid>
        </BCBox>

        <BCBox sx={{bgcolor: '#f2f2f2'}} p={3} m={1} mt={4}>
          <Grid container>
            <Grid item lg={12}>
              <BCBox>
                <InputLabel htmlFor="orgLegalName" sx={{ pb: 1 }}>
                  <BCTypography variant="body3" dangerouslySetInnerHTML={{ __html:t('txn:effectiveDate')}}></BCTypography>
                </InputLabel>
                <TextField
                  data-test="txn-effective-date"
                  {...register('effectiveDate')}
                  type="date"
                  defaultValue={maxDate}
                  inputProps={{
                    max: maxDate,
                    'data-testid': 'txn-effective-date-input'
                  }}
                  size="small"
                  error={!!errors.effectiveDate}
                  helperText={errors.effectiveDate?.message}
                />
              </BCBox>
            </Grid>
            <Grid item lg={12} mt={3}>
              <BCTypography variant="body3"
                sx={{
                  '& p': {
                    marginBottom: '16px'
                  },
                  '& p:last-child': {
                    marginBottom: '0'
                  }
                }}
                dangerouslySetInnerHTML={{ __html:t('txn:description')}}
              >
              </BCTypography>
            </Grid>
          </Grid>
        </BCBox>
      </LabelBox>
    </BCBox>
  )
}
