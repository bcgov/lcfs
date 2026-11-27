import useTheme from '@mui/material/styles/useTheme'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import BCTypography from '@/components/BCTypography'

// MUI Icons
import { useFormContext } from 'react-hook-form'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useParams } from 'react-router-dom'
import { useTransfer } from '@/hooks/useTransfer'
import HorizontalRule from '@mui/icons-material/HorizontalRule'
import SyncAlt from '@mui/icons-material/SyncAlt'
import TrendingFlat from '@mui/icons-material/TrendingFlat'
import type { SxProps, Theme } from '@mui/material/styles'

interface TransferGraphicFormValues {
  quantity: number | string
  pricePerUnit: number | string
  toOrganizationId: number | string
}

interface OrganizationOption {
  organizationId: number | string
  name?: string | null
}
interface TransferGraphicData {
  fromOrganization?: { name?: string }
}

function isOrganizationList(value: unknown): value is OrganizationOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (org: unknown) =>
        typeof org === 'object' &&
        org !== null &&
        'organizationId' in org &&
        (typeof org.organizationId === 'number' ||
          typeof org.organizationId === 'string')
    )
  )
}

function isTransferGraphicData(value: unknown): value is TransferGraphicData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fromOrganization' in value &&
    typeof value.fromOrganization === 'object' &&
    value.fromOrganization !== null &&
    'name' in value.fromOrganization &&
    typeof value.fromOrganization.name === 'string'
  )
}

export const TransferGraphic = () => {
  const theme = useTheme()

  const { watch } = useFormContext<TransferGraphicFormValues>()
  const { data: currentUser } = useCurrentUser()
  const { data: orgResult } = useRegExtOrgs({})
  const { transferId } = useParams()
  const { data: transferResult } = useTransfer(transferId, {
    enabled: !!transferId
  })
  const orgData = isOrganizationList(orgResult) ? orgResult : []
  const transferData = isTransferGraphicData(transferResult)
    ? transferResult
    : undefined

  const quantity = parseInt(String(watch('quantity')), 10)
  const creditsFrom = transferId
    ? transferData?.fromOrganization?.name
    : currentUser?.organization?.name
  const creditsTo =
    orgData.find(
      (org) =>
        (typeof org.organizationId === 'number'
          ? org.organizationId
          : parseInt(org.organizationId)) === Number(watch('toOrganizationId'))
    )?.name || ''

  const pricePerUnit = parseFloat(String(watch('pricePerUnit')))
  const totalValue = quantity && pricePerUnit ? quantity * pricePerUnit : 0

  const isNumberOfCreditsValid = (number: number) =>
    !isNaN(number) && number > 0
  const isTotalValueValid = (value: number) => value > 0
  const formatCurrency = (value: number) =>
    value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  const formattedNumberOfCredits = quantity
    ? quantity.toLocaleString('en-US')
    : null

  const iconSizeStyle: SxProps<Theme> = {
    fontSize: (theme) => `${theme.spacing(12)} !important`
  }

  const renderIcon = () => {
    if (isNumberOfCreditsValid(quantity) && isTotalValueValid(totalValue)) {
      return (
        <SyncAlt
          data-test="SyncAltIcon"
          color="primary"
          sx={{ ...iconSizeStyle, marginTop: '-20px', marginBottom: '-25px' }}
        />
      )
    } else if (isNumberOfCreditsValid(quantity)) {
      return (
        <TrendingFlat
          data-test="TrendingFlatIcon"
          color="primary"
          sx={{ ...iconSizeStyle, marginTop: '-37px' }}
        />
      )
    } else {
      return (
        <HorizontalRule
          data-test="HorizontalRuleIcon"
          color="primary"
          sx={iconSizeStyle}
        />
      )
    }
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={2}
      data-test="transfer-graphic"
    >
      <Paper
        elevation={0}
        sx={{
          minWidth: { md: 300 },
          p: 3,
          height: 90,
          borderRadius: '15px',
          border: `4px solid ${theme.palette.primary.main}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <BCTypography variant="subtitle1">{creditsFrom}</BCTypography>
      </Paper>

      <Box
        sx={{
          minWidth: { md: 140, lg: 225 },
          mx: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100px',
          p: 3
        }}
      >
        {isNumberOfCreditsValid(quantity) && (
          <BCTypography variant="body2" sx={{ mb: 1 }}>
            {`${formattedNumberOfCredits} compliance units`}
          </BCTypography>
        )}

        {renderIcon()}

        {isTotalValueValid(totalValue) && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
            <BCTypography variant="body2">
              {formatCurrency(totalValue)}
            </BCTypography>
          </Box>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          minWidth: { md: 300 },
          p: 3,
          height: 90,
          borderRadius: '15px',
          border: `4px solid ${theme.palette.primary.main}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <BCTypography variant="subtitle1">{creditsTo || ''}</BCTypography>
      </Paper>
    </Box>
  )
}
