import Stack from '@mui/material/Stack'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import {
  decimalFormatter,
  calculateTotalValue,
  formatNumberWithCommas
} from '@/utils/formatters'
import { formatCalendarDate } from '@/utils/calendarDate'

interface TransferSummaryProps {
  transferData?: {
    fromOrganization: { name: string }
    toOrganization: { name: string }
  }
  formData?: {
    quantity: number
    pricePerUnit: number
    agreementDate: Date
  }
}

export const TransferSummary = ({
  transferData = {
    fromOrganization: { name: '' },
    toOrganization: { name: '' }
  },
  formData = {
    quantity: 0,
    pricePerUnit: 0,
    agreementDate: new Date()
  }
}: TransferSummaryProps) => {
  const { t } = useTranslation()

  return (
    <Stack>
      <BCTypography variant="h6">{t('transfer:trnsSummary')}</BCTypography>
      <BCTypography mt={1} variant="body5">
        {t('transfer:complianceUnitsFrom')}
        {`: ${transferData.fromOrganization.name}`}
      </BCTypography>
      <BCTypography variant="body5">
        {t('transfer:complianceUnitsTo').trimEnd()}
        {`: ${transferData.toOrganization.name}`}
      </BCTypography>
      <BCTypography variant="body5">
        {t('transfer:numberOfUnitsToTrns')}
        {`: ${formatNumberWithCommas({ value: formData.quantity })}`}
      </BCTypography>
      <BCTypography variant="body5">
        {t('transfer:valuePerUnit')}
        {`: $${decimalFormatter(formData.pricePerUnit)}`}
      </BCTypography>
      <BCTypography variant="body5">
        {t('transfer:totalVal')}
        {`: $${decimalFormatter(
          calculateTotalValue(formData.quantity, formData.pricePerUnit)
        )}`}
      </BCTypography>
      <BCTypography variant="body5">
        {t('transfer:agreementDt')}
        {/* Same formatting as the saved value, so the user confirms that date */}
        {`: ${formatCalendarDate(formData.agreementDate)}`}
      </BCTypography>
      <BCTypography mt={2} variant="body5">
        {t('transfer:sendConfirmText')}
        {`${transferData.toOrganization.name}?`}
      </BCTypography>
    </Stack>
  )
}
