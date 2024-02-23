import { Box, TextField, Typography } from '@mui/material'
import { useFormContext } from 'react-hook-form'
import LabelBox from './LabelBox' // Assuming LabelBox is a custom component

const AgreementDate = () => {
  const {
    register,
    formState: { errors }
  } = useFormContext()

  const formatDate = (date) => {
    return date.toISOString().split('T')[0]
  }

  const currentDate = new Date()
  const maxDate = formatDate(currentDate)
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
