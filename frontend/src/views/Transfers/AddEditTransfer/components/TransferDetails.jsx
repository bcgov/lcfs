import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganization'
import {
  FormControl,
  MenuItem,
  Select,
  TextField,
  InputAdornment
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import LabelBox from './LabelBox'
import { calculateTotalValue } from '@/utils/formatters'

const TransferDetails = () => {
  const { t } = useTranslation(['common', 'transfer', 'organization'])
  const [totalValue, setTotalValue] = useState(0.0)
  const {
    register,
    control,
    watch,
    formState: { errors }
  } = useFormContext()
  const { data: currentUser } = useCurrentUser()
  const { data: orgData } = useRegExtOrgs()
  const organizations = orgData?.map((org) => ({
    value: parseInt(org.organization_id),
    label: org.name || t('common:unknown')
  }))

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
    <BCBox>
      <LabelBox label={t('transfer:detailsLabel')}>
        <BCTypography variant="body4" component="div">
          <BCTypography fontWeight="bold" variant="body4" component="span">
            {currentUser?.organization?.name}
          </BCTypography>
          {` ${t('transfer:transfers')} `}
          <TextField
            {...register('quantity')}
            placeholder={t('common:quantity')}
            size="small"
            error={!!errors.quantity}
            helperText={errors.quantity?.message}
            sx={{ width: '6rem', marginInline: '0.2rem', bottom: '0.2rem' }}
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
                  labelId="to-organization-select-label"
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
                  {organizations.map((org) => (
                    <MenuItem key={org.value} value={org.value}>
                      {org.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {renderError('toOrganizationId')}
          </FormControl>
          {t('transfer:for')}
          <TextField
            {...register('pricePerUnit')}
            placeholder={t('transfer:fairMarketText')}
            size="small"
            error={!!errors.pricePerUnit}
            helperText={errors.pricePerUnit?.message}
            inputProps={{
              maxLength: 13,
              step: '10',
              style: { textAlign: 'right' }
            }}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            sx={{
              minWidth: '24rem',
              marginInline: '0.2rem',
              bottom: '0.2rem'
            }}
          />
          {t('transfer:totalValueText')}
          <BCTypography
            variant="body4"
            fontWeight="bold"
            component="span"
            color="primary"
            data-testid="transfer-total-value"
          >
            {`${totalValue.toLocaleString('en-CA', {
              style: 'currency',
              currency: 'CAD'
            })} CAD.`}
          </BCTypography>
        </BCTypography>
      </LabelBox>
    </BCBox>
  )
}

export default TransferDetails