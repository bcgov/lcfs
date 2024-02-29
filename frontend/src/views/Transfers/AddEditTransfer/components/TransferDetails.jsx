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
import LabelBox from './LabelBox'
import BCTypography from '@/components/BCTypography'

const calculateTotalValue = (quantity, pricePerUnit) => {
  const quantityNum = parseFloat(quantity)
  const priceNum = parseFloat(pricePerUnit).toFixed(1)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

const TransferDetails = () => {
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
    label: org.name || 'Unknown'
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
      <LabelBox label="Transfer Details (required)">
        <BCTypography variant="body4" component="div">
          <BCTypography fontWeight="bold" variant="body4" component="span">
            {currentUser?.organization?.name}
          </BCTypography>
          {' transfers '}
          <TextField
            {...register('quantity')}
            placeholder="Quantity"
            size="small"
            error={!!errors.quantity}
            helperText={errors.quantity?.message}
            sx={{ width: '6rem', marginInline: '0.2rem', bottom: '0.2rem' }}
          />
          {' compliance units to '}
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
                    },
                    bottom: '0.2rem',
                    marginInline: '0.2rem'
                  }}
                  renderValue={(selected) => {
                    if (selected === '') {
                      return <em>Select an Organization</em>
                    }
                    const selectedOrg = organizations.find(
                      (org) => org.value === selected
                    )
                    return selectedOrg ? (
                      selectedOrg.label
                    ) : (
                      <em>Select an Organization</em>
                    )
                  }}
                >
                  <MenuItem value="">
                    <em>Select an Organization</em>
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
          {' for '}
          <TextField
            type="number"
            {...register('pricePerUnit')}
            placeholder="The fair market value of any consideration, in CAD"
            size="small"
            error={!!errors.pricePerUnit}
            helperText={errors.pricePerUnit?.message}
            inputProps={{
              maxLength: 13,
              step: '10',
              style: { textAlign: 'right' }
            }}
            sx={{
              width: '12rem',
              marginInline: '0.2rem',
              bottom: '0.2rem'
            }}
          />
          {' per compliance unit for a total value of '}
          <BCTypography
            variant="body4"
            fontWeight="bold"
            component="span"
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
