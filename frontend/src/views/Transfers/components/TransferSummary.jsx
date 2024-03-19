import PropTypes from 'prop-types';
import { Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { decimalFormatter, calculateTotalValue, dateFormatter } from '@/utils/formatters'

export const TransferSummary = ({ transferData, formData }) => {
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
        {`: ${formData.quantity}`}
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
        {t('transfer:AgreementDt')}
        {`: ${dateFormatter(formData.agreementDate)}`}
      </BCTypography>
      <BCTypography mt={2} variant="body5">
        {t('transfer:sendConfirmText')}
        {`${transferData.toOrganization.name}?`}
      </BCTypography>
    </Stack>
  )
}

TransferSummary.propTypes = {
  transferData: PropTypes.shape({
    fromOrganization: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
    toOrganization: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  formData: PropTypes.shape({
    quantity: PropTypes.number.isRequired,
    pricePerUnit: PropTypes.number.isRequired,
    agreementDate: PropTypes.instanceOf(Date).isRequired,
  }).isRequired
};

TransferSummary.defaultProps = {
  transferData: {
    fromOrganization: {
      name: '',
    },
    toOrganization: {
      name: '',
    },
  },
  formData: {
    quantity: 0,
    pricePerUnit: 0,
    agreementDate: new Date(),
  },
};
