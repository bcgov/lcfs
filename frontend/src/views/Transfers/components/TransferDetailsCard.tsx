import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import useTheme from '@mui/material/styles/useTheme'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import { OrganizationBadge } from '@/views/Transfers/components'
import { useTranslation } from 'react-i18next'
import {
  calculateTotalValue,
  currencyFormatter,
  formatNumberWithCommas
} from '@/utils/formatters'
import SwapVert from '@mui/icons-material/SwapVert'
import SyncAlt from '@mui/icons-material/SyncAlt'
import type { SxProps, Theme } from '@mui/material/styles'

interface TransferDetailsCardProps {
  fromOrgId?: number | string
  fromOrganization?: string
  toOrgId?: number | string
  toOrganization?: string
  quantity?: number
  pricePerUnit?: number
  transferStatus?: string
  isGovernmentUser?: boolean
}

export const TransferDetailsCard = ({
  fromOrgId,
  fromOrganization,
  toOrgId,
  toOrganization,
  quantity,
  pricePerUnit,
  transferStatus,
  isGovernmentUser
}: TransferDetailsCardProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobileSize = useMediaQuery(theme.breakpoints.down('sm'))

  const iconSizeStyle: SxProps<Theme> = {
    fontSize: (theme) => `${theme.spacing(12)} !important`,
    marginTop: '-28px',
    marginBottom: '-25px'
  }

  const totalValue = calculateTotalValue(quantity ?? 0, pricePerUnit ?? 0)

  return (
    <BCBox data-test="transfer-details-card">
      <Stack
        spacing={4}
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="center"
      >
        <OrganizationBadge
          organizationId={fromOrgId ?? 0}
          organizationName={fromOrganization ?? ''}
          isGovernmentUser={isGovernmentUser ?? false}
          transferStatus={transferStatus ?? ''}
        />
        <Stack spacing={1} direction="column" justifyContent="center" pl={2}>
          <BCTypography variant="caption1" textAlign="center">
            {isMobileSize
              ? String(currencyFormatter({ value: totalValue }))
              : `${formatNumberWithCommas({ value: quantity })} ${t(
                  'transfer:complianceUnits'
                )}`}
          </BCTypography>
          <BCBox
            sx={{
              display: 'flex',
              alignContent: 'center',
              flexDirection: 'column',
              alignItems: 'center',
              py: 1
            }}
          >
            {isMobileSize ? (
              <SwapVert
                data-test="SwapVertIcon"
                color="primary"
                sx={{ ...iconSizeStyle }}
              />
            ) : (
              <SyncAlt
                data-test="SyncAltIcon"
                color="primary"
                sx={{ ...iconSizeStyle }}
              />
            )}
          </BCBox>
          <BCTypography variant="caption1" textAlign="center">
            {!isMobileSize
              ? String(currencyFormatter({ value: totalValue }))
              : `${formatNumberWithCommas({ value: quantity })} ${t(
                  'transfer:complianceUnits'
                )}`}
          </BCTypography>
        </Stack>
        <OrganizationBadge
          organizationId={toOrgId ?? 0}
          organizationName={toOrganization ?? ''}
          isGovernmentUser={isGovernmentUser ?? false}
          transferStatus={transferStatus ?? ''}
        />
      </Stack>
    </BCBox>
  )
}
