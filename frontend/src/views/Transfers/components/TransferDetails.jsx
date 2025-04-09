import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import {
  FormControl,
  MenuItem,
  Select,
  TextField,
  InputAdornment
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { LabelBox } from './LabelBox'
import { calculateTotalValue } from '@/utils/formatters'
import { NumericFormat } from 'react-number-format'

export const TransferDetails = () => {
  const { t } = useTranslation(['common', 'transfer', 'organization'])
  const [totalValue, setTotalValue] = useState(0.0)
  const [showAdjustmentAlert, setShowAdjustmentAlert] = useState(false)
  const { data: balanceData } = useCurrentOrgBalance()
  const {
    control,
    watch,
    formState: { errors }
  } = useFormContext()
  const { data: currentUser } = useCurrentUser()
  const { data: orgData } = useRegExtOrgs()

  const availableBalance = useMemo(() => {
    if (!balanceData) return 0
    // Maximum Allowed = Total Balance - Reserved Balance, but never less than zero.
    return Math.max(
      balanceData.totalBalance - Math.abs(balanceData.reservedBalance),
      0
    )
  }, [balanceData])

  const organizations =
    orgData?.map((org) => ({
      value: parseInt(org.organizationId),
      label: org.name || t('common:unknown')
    })) || []

  const quantity = watch('quantity')
  const pricePerUnit = watch('pricePerUnit')

  useEffect(() => {
    const newTotalValue = calculateTotalValue(quantity, pricePerUnit)
    if (totalValue !== newTotalValue) {
      setTotalValue(newTotalValue)
    }
  }, [quantity, pricePerUnit])

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
    <BCBox data-test="transfer-details">
      <LabelBox label={t('transfer:detailsLabel')}>
        {showAdjustmentAlert && (
          <BCAlert
            severity="warning"
            sx={{ mb: 2 }}
            onClose={() => setShowAdjustmentAlert(false)}
          >
            {availableBalance === 0
              ? `${t('transfer:noAvailableBalance')}: 0`
              : `${t(
                  'transfer:quantityAdjusted'
                )}: ${availableBalance.toLocaleString()}`}
          </BCAlert>
        )}
        <BCTypography variant="body4" component="div">
          <BCTypography fontWeight="bold" variant="body4" component="span">
            {currentUser?.organization?.name}
          </BCTypography>
          {` ${t('transfer:transfers')} `}

          <Controller
            name="quantity"
            control={control}
            render={({ field: { onChange, onBlur, value, name, ref } }) => (
              <NumericFormat
                customInput={TextField}
                thousandSeparator
                value={value}
                isAllowed={(values) => {
                  const { floatValue } = values
                  if (floatValue > availableBalance) {
                    onChange(availableBalance)
                    setShowAdjustmentAlert(true)
                    return
                  }
                  return (
                    floatValue === undefined || typeof floatValue === 'number'
                  )
                }}
                onValueChange={(values) => {
                  const newValue = values.floatValue || 0
                  if (newValue > availableBalance) {
                    onChange(availableBalance)
                    setShowAdjustmentAlert(true)
                    return
                  }
                  setShowAdjustmentAlert(false)
                  onChange(newValue)
                }}
                onBlur={onBlur}
                name={name}
                inputRef={ref}
                inputProps={{ 'data-test': 'quantity' }}
                placeholder={t('common:quantity')}
                size="small"
                error={!!errors.quantity}
                helperText={errors.quantity?.message}
                sx={{ width: '6rem', marginInline: '0.2rem', bottom: '0.2rem' }}
              />
            )}
          />

          {t('transfer:complianceUnitsTo')}
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
            <Controller
              name="toOrganizationId"
              control={control} // Note: control needs to be passed down from the parent component
              displayEmpty
              render={({ field }) => (
                <Select
                  id="to-organization-id"
                  labelId="to-organization-select-label"
                  {...field}
                  error={!!errors.toOrganizationId}
                  // helperText={errors.toOrganizationId?.message}
                  displayEmpty
                  menuprops={{
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
                      return <em>{t('org:selectOrgLabel')}</em>
                    }
                    const selectedOrg = organizations.find(
                      (org) => org.value === selected
                    )
                    return selectedOrg ? (
                      selectedOrg.label
                    ) : (
                      <em>{t('org:selectOrgLabel')}</em>
                    )
                  }}
                >
                  <MenuItem value="">
                    <em>{t('org:selectOrgLabel')}</em>
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

          {t('transfer:for')}

          <Controller
            name="pricePerUnit"
            control={control}
            render={({ field: { onChange, onBlur, value, name, ref } }) => (
              <NumericFormat
                id="price-per-unit"
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
                placeholder={t('transfer:fairMarketText')}
                size="small"
                error={!!errors.pricePerUnit}
                helperText={errors.pricePerUnit?.message}
                sx={{
                  minWidth: '25rem',
                  marginInline: '0.2rem',
                  bottom: '0.2rem'
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                  style: { textAlign: 'right' }
                }}
                inputProps={{
                  maxLength: 13,
                  'data-test': 'price-per-unit'
                }}
              />
            )}
          />

          {t('transfer:totalValueText')}
          <BCTypography
            variant="body4"
            fontWeight="bold"
            component="span"
            color="primary"
            data-test="transfer-total-value"
          >
            {`${totalValue.toLocaleString('en-CA', {
              style: 'currency',
              currency: 'CAD'
            })} CAD.`}
          </BCTypography>
        </BCTypography>

        <BCTypography
          variant="body4"
          component="div"
          sx={{ marginTop: '1rem', fontWeight: 'bold' }}
        >
          {t('transfer:zeroDollarInstructionText')}
        </BCTypography>
      </LabelBox>
    </BCBox>
  )
}
