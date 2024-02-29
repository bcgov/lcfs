import BCBox from '@/components/BCBox'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganization'
import {
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import LabelBox from './LabelBox'

const calculateTotalValue = (quantity, pricePerUnit) => {
  const quantityNum = parseFloat(quantity)
  const priceNum = parseFloat(pricePerUnit)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

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
        <Typography
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
        </Typography>
      )
    )
  }
  return (
    <BCBox>
      <LabelBox label={t('transfer:detailsLabel')}>
        <Typography variant="body1" component="div">
          {`${currentUser?.organization?.name} ${t('transfer:transfers')} `}
          <TextField
            {...register('quantity')}
            placeholder={t('common:quantity')}
            size="small"
            error={!!errors.quantity}
            helperText={errors.quantity?.message}
            style={{ width: '200px', marginRight: '10px' }}
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
              }
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
                      return <em>{t('organization:selectOrgLabel')}</em>
                    }
                    const selectedOrg = organizations.find(
                      (org) => org.value === selected
                    )
                    return selectedOrg ? (
                      selectedOrg.label
                    ) : (
                      <em>{t('organization:selectOrgLabel')}</em>
                    )
                  }}
                >
                  <MenuItem value="">
                    <em>{t('organization:selectOrgLabel')}</em>
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
            style={{ width: '375px', marginRight: '10px' }}
          />
          {t('transfer:totalValueText')}
          <Typography
            variant="body1"
            component="span"
            color="primary"
            data-testid="transfer-total-value"
          >
            {totalValue.toLocaleString('en-CA', {
              style: 'currency',
              currency: 'CAD'
            })}
          </Typography>
          {' CAD.'}
        </Typography>
      </LabelBox>
    </BCBox>
  )
}

export default TransferDetails
