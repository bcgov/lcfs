import BCBox from '@/components/BCBox'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { useTransfer } from '@/hooks/useTransfer'
import { FormControlLabel, Radio, RadioGroup } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

export const Recommendation = ({ currentStatus }) => {
  const { t } = useTranslation(['common', 'transfer'])
  const { transferId } = useParams()
  const { data: transferData } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false
  })

  const { control } = useFormContext()

  return (
    <BCBox my={2}>
      <BCTypography variant="h6" color="primary" mb={2}>
        {t('transfer:analystRecommend')}
      </BCTypography>
      {transferData.currentStatus.status === TRANSFER_STATUSES.SUBMITTED ? (
        <Controller
          control={control}
          name="recommendation"
          defaultValue={null}
          render={({ field }) => (
            <RadioGroup
              row
              style={{
                gap: 24,
                alignItems: 'center'
              }}
              name="recommend"
              {...field}
            >
              <FormControlLabel
                value="Record"
                control={<Radio data-test="recommend-record-radio" />}
                label={t('transfer:recommendRecord')}
              />
              <FormControlLabel
                value="Refuse"
                control={<Radio data-test="recommend-refuse-radio" />}
                label={t('transfer:recommendRefuse')}
              />
            </RadioGroup>
          )}
        />
      ) : (
        <BCTypography>
          The analyst has recommended that you to{' '}
          <strong>{transferData.recommendation}</strong> this transfer.
        </BCTypography>
      )}
    </BCBox>
  )
}
