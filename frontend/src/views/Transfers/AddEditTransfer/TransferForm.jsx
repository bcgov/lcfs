import React, { useState, useEffect } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import * as Yup from 'yup'
import PropTypes from 'prop-types'
import { Box, Typography, Button } from '@mui/material'
import AgreementDate from './components/AgreementDate'
import SigningAuthority from './components/SigningAuthority'
import Comments from './components/Comments'
import TransferDetails from './components/TransferDetails'

// Calculate total value based on quantity and price per unit
const calculateTotalValue = (quantity, pricePerUnit) => {
  const quantityNum = parseFloat(quantity)
  const priceNum = parseFloat(pricePerUnit)
  return !isNaN(quantityNum) && !isNaN(priceNum) ? quantityNum * priceNum : 0
}

const TransferForm = ({ currentOrg, organizations }) => {
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
      <TransferDetails
        register={register}
        renderError={renderError}
        organizations={organizations}
        currentOrg={currentOrg}
        totalValue={totalValue}
        control={control}
        errors={errors}
      />

      <AgreementDate register={register} errors={errors} maxDate={maxDate} />

      <Comments register={register} />
      
      <SigningAuthority register={register} errors={errors} />

      {/* Save Draft Button */}
      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button
          type="submit"
          variant="contained"
          color="primary"
          onClick={() => console.log('Submitting form')}
        >
          Save Draft
        </Button>
      </Box>
    </>
  )
}

// Defining PropTypes for the component
TransferForm.propTypes = {
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

export default TransferForm
