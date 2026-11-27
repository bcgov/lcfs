import BCBox from '@/components/BCBox'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { useTransfer } from '@/hooks/useTransfer'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import BCTypography from '@/components/BCTypography'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

interface TransferRecommendationData {
  currentStatus?: { status: string }
  recommendation?: string
}

function hasRecommendationData(
  data: unknown
): data is TransferRecommendationData {
  return typeof data === 'object' && data !== null
}

export const Recommendation = (_props: { currentStatus?: string }) => {
  const { t } = useTranslation(['common', 'transfer'])
  const { transferId } = useParams()
  const { data } = useTransfer(transferId, {
    enabled: !!transferId,
    retry: false
  })
  const transferData = hasRecommendationData(data) ? data : undefined

  const { control } = useFormContext()

  return (
    <BCBox my={2}>
      <BCTypography variant="h6" color="primary" mb={2}>
        {t('transfer:analystRecommend')}
      </BCTypography>
      {transferData?.currentStatus?.status === TRANSFER_STATUSES.SUBMITTED ? (
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
        <BCTypography variant="body2">
          The analyst has recommended that you to{' '}
          <strong>{transferData?.recommendation}</strong> this transfer.
        </BCTypography>
      )}
    </BCBox>
  )
}
