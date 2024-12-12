import PropTypes from 'prop-types'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { Stack, useMediaQuery, useTheme } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import { OrganizationBadge } from '@/views/Transfers/components'
import { useTranslation } from 'react-i18next'
import { decimalFormatter } from '@/utils/formatters'

export const TransferDetailsCard = ({
  fromOrgId,
  fromOrganization,
  toOrgId,
  toOrganization,
  quantity,
  pricePerUnit,
  transferStatus,
  isGovernmentUser
}) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))

  const iconSizeStyle = {
    fontSize: (theme) => `${theme.spacing(12)} !important`,
    marginTop: '-28px',
    marginBottom: '-25px'
  }

  const totalValue = (quantity * pricePerUnit).toFixed(2)
  return (
    <BCBox data-test="transfer-details-card">
      <Stack
        spacing={4}
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="center"
      >
        <OrganizationBadge
          organizationId={fromOrgId}
          organizationName={fromOrganization}
          isGovernmentUser={isGovernmentUser}
          transferStatus={transferStatus}
        />
        <Stack spacing={1} direction="column" justifyContent="center" pl={2}>
          <BCTypography variant="caption1" textAlign="center">
            {isMobileSize
              ? `$${decimalFormatter(totalValue)}`
              : `${quantity} ${t('transfer:complianceUnits')}`}
          </BCTypography>
          <BCBox
            display="flex"
            alignContent="center"
            flexDirection="column"
            alignItems="center"
            py={1}
          >
            {isMobileSize ? (
              <SwapVertIcon
                data-test="SwapVertIcon"
                color="primary"
                sx={{ ...iconSizeStyle }}
              />
            ) : (
              <SyncAltIcon
                data-test="SyncAltIcon"
                color="primary"
                sx={{ ...iconSizeStyle }}
              />
            )}
          </BCBox>
          <BCTypography variant="caption1" textAlign="center">
            {!isMobileSize
              ? `$${decimalFormatter(totalValue)}`
              : `${quantity} ${t('transfer:complianceUnits')}`}
          </BCTypography>
        </Stack>
        <OrganizationBadge
          organizationId={toOrgId}
          organizationName={toOrganization}
          isGovernmentUser={isGovernmentUser}
          transferStatus={transferStatus}
        />
      </Stack>
    </BCBox>
  )
}

TransferDetailsCard.propTypes = {
  fromOrgId: PropTypes.number,
  fromOrganization: PropTypes.string,
  toOrgId: PropTypes.number,
  toOrganization: PropTypes.string,
  quantity: PropTypes.number,
  pricePerUnit: PropTypes.number,
  transferStatus: PropTypes.string,
  isGovernmentUser: PropTypes.bool
}
