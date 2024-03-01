import PropTypes from 'prop-types';
import { Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { decimalFormatter, calculateTotalValue } from '@/utils/formatters'

const TransferSummary = ({ transferData, formData }) => {
  const { t } = useTranslation()

  return (
    <Stack>
      <BCTypography variant="h6">{t('transfer:trnsSummary')}</BCTypography>
      <BCTypography mt={1} variant="body5">
        {t('transfer:complianceUnitsFrom')}
        {`: ${transferData.from_organization.name}`}
      </BCTypography>
      <BCTypography variant="body5">
        {t('transfer:complianceUnitsTo').trimEnd()}
        {`: ${transferData.to_organization.name}`}
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
        {`: ${new Date(formData.agreementDate).toISOString().split('T')[0]}`}
      </BCTypography>
      <BCTypography mt={2} variant="body5">
        {t('transfer:sendConfirmText')}
        {`${transferData.to_organization.name}?`}
      </BCTypography>
    </Stack>
  )
}

TransferSummary.propTypes = {
  transferData: PropTypes.shape({
    from_organization: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
    to_organization: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  formData: PropTypes.shape({
    quantity: PropTypes.number.isRequired,
    pricePerUnit: PropTypes.number.isRequired,
    agreementDate: PropTypes.instanceOf(Date).isRequired,
  }).isRequired,
  calculateTotalValue: PropTypes.func.isRequired,
};

TransferSummary.defaultProps = {
  transferData: {
    from_organization: {
      name: '',
    },
    to_organization: {
      name: '',
    },
  },
  formData: {
    quantity: 0,
    pricePerUnit: 0,
    agreementDate: new Date(),
  },
};

export default TransferSummary
