import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Tooltip, Fade } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { Info } from '@mui/icons-material'

const OrgBalanceCard = () => {
  const { t } = useTranslation(['dashboard'])
  const {
    data: currentUser,
    isLoading: isUserLoading,
    isError: isUserError
  } = useCurrentUser()
  const {
    data: orgBalance,
    isLoading: isBalanceLoading,
    isError: isBalanceError
  } = useCurrentOrgBalance()

  const Content = () => {
    if (isUserLoading || isBalanceLoading) {
      return <Loading message={t('dashboard:orgBalance.loading')} />
    } else if (isUserError || isBalanceError || !orgBalance) {
      return (
        <BCTypography color="error" variant="body1" style={{ padding: '16px' }}>
          {t('dashboard:orgBalance.unableToFetchBalanceDetails')}
        </BCTypography>
      )
    } else {
      // Ensure reservedBalance is displayed as positive
      const formattedReservedBalance = Math.abs(
        orgBalance.reservedBalance
      ).toLocaleString()

      return (
        <>
          <BCTypography
            style={{ fontSize: '18px', color: '#003366', marginBottom: '-2px' }}
            gutterBottom
          >
            <strong>
              {currentUser?.organization?.name || t('dashboard:orgBalance.org')}
            </strong>
          </BCTypography>
          <BCTypography
            style={{ fontSize: '16px', color: '#003366', marginBottom: '-4px' }}
          >
            {t('dashboard:orgBalance.hasABalanceOf')}
          </BCTypography>
          <BCTypography
            style={{ fontSize: '32px', color: '#547D59', marginBottom: '-4px' }}
            component="span"
          >
            {orgBalance.totalBalance.toLocaleString()}
          </BCTypography>
          <BCTypography
            style={{ fontSize: '18px', color: '#003366', marginBottom: '-5px' }}
          >
            <strong>{t('dashboard:orgBalance.complianceUnits')}</strong>
          </BCTypography>
          <Box display="flex" alignItems="center" mt={1}>
            <BCTypography
              style={{ fontSize: '22px', color: '#547D59' }}
              component="span"
            >
              ({formattedReservedBalance} {t('dashboard:orgBalance.inReserve')})
            </BCTypography>
            <Tooltip
              title={t('dashboard:orgBalance.inReserveTooltip')}
              TransitionComponent={Fade}
              arrow
            >
              <Info style={{ marginLeft: '4px', color: '#547D59' }} />
            </Tooltip>
          </Box>
        </>
      )
    }
  }

  return (
    <Box
      p={2}
      paddingTop={4}
      paddingBottom={4}
      bgcolor="background.grey"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <Content />
    </Box>
  )
}

export default OrgBalanceCard
