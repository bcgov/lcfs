import PropTypes from 'prop-types'
import { useTheme, Box, Paper } from '@mui/material'
import BCTypography from '@/components/BCTypography'

// MUI Icons
import { useFormContext } from 'react-hook-form'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useParams } from 'react-router-dom'
import { useTransfer } from '@/hooks/useTransfer'
import { HorizontalRule, SyncAlt, TrendingFlat } from '@mui/icons-material'

export const TransferGraphic = () => {
  const theme = useTheme()

  const { watch } = useFormContext()
  const { data: currentUser } = useCurrentUser()
  const { data: orgData } = useRegExtOrgs()
  const { transferId } = useParams()
  const { data: transferData } = useTransfer(transferId, {
    enabled: !!transferId
  })

  const quantity = parseInt(watch('quantity'), 10)
  const creditsFrom = transferId
    ? transferData?.fromOrganization.name
    : currentUser?.organization?.name
  const creditsTo =
    orgData.find(
      (org) => parseInt(org.organizationId) === watch('toOrganizationId')
    )?.name || ''

  const pricePerUnit = parseFloat(watch('pricePerUnit'))
  const totalValue = quantity && pricePerUnit ? quantity * pricePerUnit : 0

  const isNumberOfCreditsValid = (number) => !isNaN(number) && number > 0
  const isTotalValueValid = (value) => typeof value === 'number' && value > 0
  const formatCurrency = (value) =>
    value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  const formattedNumberOfCredits = quantity
    ? parseInt(quantity, 10).toLocaleString('en-US')
    : null

  const iconSizeStyle = {
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

TransferGraphic.propTypes = {
  creditsFrom: PropTypes.string,
  creditsTo: PropTypes.string,
  numberOfCredits: PropTypes.number,
  totalValue: PropTypes.number
}
