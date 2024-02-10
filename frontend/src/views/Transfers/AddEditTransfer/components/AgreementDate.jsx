import React from 'react'
import { Box, TextField, Typography } from '@mui/material'
import LabelBox from './LabelBox' // Assuming LabelBox is a custom component

const AgreementDate = ({ register, errors, maxDate }) => {
  return (
    <LabelBox
      label="Agreement Date (required)"
      description="Date on which the written agreement for the transfer was reached between the organizations:"
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        gap="10px"
      >
        <Typography variant="body2">Agreement Date:</Typography>
        <TextField
          data-testid="transfer-agreement-date"
          {...register('agreementDate')}
          type="date"
          defaultValue={maxDate}
          inputProps={{
            max: maxDate,
            'data-testid': 'transfer-agreement-date-input'
          }}
          size="small"
          error={!!errors.agreementDate}
          helperText={errors.agreementDate?.message}
        />
      </Box>
    </LabelBox>
  )
}

export default AgreementDate
