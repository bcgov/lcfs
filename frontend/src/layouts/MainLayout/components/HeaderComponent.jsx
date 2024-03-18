import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import Icon from '@mui/material/Icon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export const HeaderComponent = () => {
  const { t } = useTranslation()
  const { data, isFetched } = useCurrentUser()
  const [showBalance, setShowBalance] = useState(
    !!+sessionStorage.getItem('showBalance') || false
  )

  const { data: orgBalance } = useOrganizationBalance(
    data.organization.organizationId
  )

  const toggleBalanceVisibility = () => {
    if (showBalance) {
      sessionStorage.setItem('showBalance', '0')
      setShowBalance(false)
    } else {
      sessionStorage.setItem('showBalance', '1')
      setShowBalance(true)
    }
  }

  return (
    isFetched && (
      <>
        <BCTypography
          className="organization_name"
          variant="body1"
          align="right"
        >
          {data?.organization?.name || t('govOrg')}
        </BCTypography>
        {data?.organization?.organizationId && orgBalance && (
          <BCBox component="div" className="organization_balance">
            <BCBox
              component="div"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <Icon
                style={{
                  fontSize: 20,
                  cursor: 'pointer',
                  margin: '5px'
                }}
                onClick={toggleBalanceVisibility}
              >
                {showBalance ? 'visibility' : 'visibility_off'}
              </Icon>
              <span>
                {t('balance')}:{' '}
                {showBalance
                  ? `${orgBalance?.totalBalance} (${orgBalance?.reservedBalance})`
                  : '****'}
              </span>
            </BCBox>
          </BCBox>
        )}
      </>
    )
  )
}
