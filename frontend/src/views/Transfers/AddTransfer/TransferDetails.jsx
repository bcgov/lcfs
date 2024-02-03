import React, { useState, useEffect } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import * as Yup from 'yup'
import PropTypes from 'prop-types'
import {
  TextField,
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  Button
} from '@mui/material'
import BCBox from '@/components/BCBox'
import LabelBox from './components/LabelBox'
import AgreementDate from './components/AgreementDate'
import SigningAuthority from './components/SigningAuthority'
import Comment from './components/Comment'

// Schema for validating form fields
export const TransferDetailsSchema = Yup.object({
  agreementDate: Yup.date()
    .required('Agreement Date is required')
    .max(new Date(), 'Agreement Date cannot be in the future'),
  quantity: Yup.number()
    .typeError('Quantity must be a number')
    .required('Quantity is required')
    .positive('Quantity must be positive')
    .integer('Quantity must be a whole number'),
  organization: Yup.string().required('Organization selection is required'),
  pricePerUnit: Yup.number()
    .typeError('Price must be a number')
    .required('Price per unit is required')
    .min(0, 'Price cannot be negative')
    .test(
      'maxDigitsAfterDecimal',
      'Price must have 2 or fewer decimal places',
      (number) => /^\d+(\.\d{1,2})?$/.test(number)
    )
})

// Calculate total value based on quantity and price per unit
const calculateTotalValue = (quantity, pricePerUnit) => {
  const quantityNum = parseFloat(quantity)
  const priceNum = parseFloat(pricePerUnit)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

const TransferDetails = ({ currentOrg, organizations }) => {
  // Manage form state
  const {
    register,
    control,
    watch,
    formState: { errors }
  } = useFormContext()

  // Store the total value of the transaction
  const [totalValue, setTotalValue] = useState(0.0)

  // Watching changes in quantity and price per unit fields
  const quantity = watch('quantity')
  const pricePerUnit = watch('pricePerUnit')

  // Update total value when quantity or price per unit changes.
  useEffect(() => {
    const newTotalValue = calculateTotalValue(quantity, pricePerUnit)
    if (totalValue !== newTotalValue) {
      setTotalValue(newTotalValue)
    }
  }, [quantity, pricePerUnit])

  // Render form error messages
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

  // Function to format the current date in yyyy-mm-dd format
  const formatDate = (date) => {
    return date.toISOString().split('T')[0]
  }

  // Set the current date as the maximum date allowed and as the default value
  const currentDate = new Date()
  const maxDate = formatDate(currentDate)

  return (
    <>
      <BCBox>
        <LabelBox label="Transfer Details (required)">
          <Typography variant="body1" component="div">
            {`${currentOrg?.name} transfers `}
            <TextField
              {...register('quantity')}
              placeholder="Quantity"
              size="small"
              error={!!errors.quantity}
              helperText={errors.quantity?.message}
              style={{ width: '200px', marginRight: '10px' }}
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
                name="organization"
                control={control}
                displayEmpty
                render={({ field }) => (
                  <Select
                    labelId="organization-select-label"
                    {...field}
                    error={!!errors.organization}
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
              {renderError('organization')}
            </FormControl>
            {' for '}
            <TextField
              {...register('pricePerUnit')}
              placeholder="The fair market value of any consideration, in CAD"
              size="small"
              error={!!errors.pricePerUnit}
              helperText={errors.pricePerUnit?.message}
              style={{ width: '375px', marginRight: '10px' }}
            />
            {' per compliance unit for a total value of '}
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

      {/* Agreement Date */}
      <AgreementDate register={register} errors={errors} maxDate={maxDate} />

      {/* Comments */}
      <LabelBox
        label="Comments (optional)"
        description="Your comments will be visible to both organizations of the transfer and government:"
      >
        <Comment />
      </LabelBox>

      {/* Signing Authority */}
      <SigningAuthority register={register} errors={errors} />

      {/* TEST Submit button, To be Replaced with real Action Buttons */}
      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button
          type="submit"
          variant="contained"
          color="primary"
          onClick={() => console.log('Submitting form')}
        >
          Submit Transfer
        </Button>
      </Box>
    </>
  )
}

// Defining PropTypes for the component
TransferDetails.propTypes = {
  currentOrg: PropTypes.shape({
    organization_id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired
  }).isRequired,
  organizations: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired
}

export default TransferDetails
