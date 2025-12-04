import { useState, useEffect } from 'react'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { numberFormatter } from '@/utils/formatters'
import BCBox from '@/components/BCBox'
import Icon from '@mui/material/Icon'
import { useTranslation } from 'react-i18next'

const SupplierBalance = () => {
  const { t } = useTranslation()
  const [showBalance, setShowBalance] = useState<boolean>(
    !!+sessionStorage.getItem('showBalance') || true
  )

  // Update sessionStorage when showBalance changes
  useEffect(() => {
    sessionStorage.setItem('showBalance', showBalance ? '1' : '0')
  }, [showBalance])

  const { data: orgBalance } = useCurrentOrgBalance()
  const formattedTotalBalance =
    orgBalance?.totalBalance != null
      ? numberFormatter({ value: orgBalance.totalBalance })
      : 'N/A'
  const formattedReservedBalance =
    orgBalance?.reservedBalance != null
      ? numberFormatter({ value: Math.abs(orgBalance.reservedBalance) })
      : 'N/A'

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance)
  }

  return (
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
            ? `${formattedTotalBalance} (${formattedReservedBalance})`
            : '****'}
        </span>
      </BCBox>
    </BCBox>
  )
}

export default SupplierBalance
