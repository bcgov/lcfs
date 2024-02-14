import { Box, TextField } from '@mui/material'
import { Label } from './Label'
import { useTranslation } from 'react-i18next'

export const IDIRSpecificFormFields = ({
  handleChange,
  formData,
  errors,
  register
}) => {
  const { t } = useTranslation(['admin'])
  return (
    <>
      <Box>
        <Label htmlFor="IDIRUserName">{t('userForm.idirUserName')}</Label>
        <TextField
          fullWidth
          required
          name="IDIRUserName"
          id="IDIRUserName"
          data-test="IDIRUserName"
          error={!!errors.IDIRUserName}
          helperText={errors.IDIRUserName?.message}
          {...register('IDIRUserName')}
        />
      </Box>
      <Box>
        <Label htmlFor="email">{t('userForm.email')}</Label>
        <TextField
          fullWidth
          required
          name="email"
          id="email"
          data-test="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
        />
      </Box>
    </>
  )
}
