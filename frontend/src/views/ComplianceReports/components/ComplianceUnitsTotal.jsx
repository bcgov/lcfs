import BCTypography from '@/components/BCTypography'
import { Box } from '@mui/material'
import colors from '@/themes/base/colors'
import PropTypes from 'prop-types'

export const ComplianceUnitsTotal = ({ label, value, dataTest, isCurrency = false }) => {
  const formattedValue =
    value !== null && value !== undefined
      ? isCurrency
        ? value.toLocaleString('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : Math.round(value).toLocaleString('en-US')
      : isCurrency
        ? '$0.00'
        : '0'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        mb: 1.5,
        ml: 1
      }}
      data-test={dataTest}
    >
      <BCTypography
        variant="body2"
        sx={{
          fontWeight: 500,
          fontSize: '0.875rem',
          color: colors.text.primary
        }}
      >
        {label}
      </BCTypography>
      <BCTypography
        variant="body1"
        sx={{
          fontWeight: 700,
          fontSize: '1rem',
          color: colors.text.primary
        }}
      >
        {formattedValue}
      </BCTypography>
    </Box>
  )
}

ComplianceUnitsTotal.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  dataTest: PropTypes.string,
  isCurrency: PropTypes.bool
}

ComplianceUnitsTotal.defaultProps = {
  value: 0,
  dataTest: 'compliance-units-total',
  isCurrency: false
}

ComplianceUnitsTotal.displayName = 'ComplianceUnitsTotal'
