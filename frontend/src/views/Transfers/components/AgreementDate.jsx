import { Box, TextField, Typography } from '@mui/material'
import { useFormContext } from 'react-hook-form'
import { LabelBox } from './LabelBox'
import { useTranslation } from 'react-i18next'
import { dateFormatter } from '@/utils/formatters'

export const AgreementDate = () => {
  const { t } = useTranslation(['transfer'])
  const {
    register,
    formState: { errors }
  } = useFormContext()

  const currentDate = new Date()
  const maxDate = dateFormatter(currentDate)
  return (
    <LabelBox
      label={t('transfer:agrDateLabel')}
      description={t('transfer:agrDateDescText')}
      data-test="agreement-date"
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        gap="10px"
      >
        <Typography variant="body2">{t('transfer:agrDateHeader')}</Typography>
        <TextField
          data-test="transfer-agreement-date"
          {...register('agreementDate')}
          type="date"
          placeholder="yyyy-mm-dd"
          inputProps={{
            max: maxDate,
            'data-test': 'transfer-agreement-date-input'
          }}
          size="small"
          error={!!errors.agreementDate}
          helperText={errors.agreementDate?.message}
        />
      </Box>
    </LabelBox>
  )
}
